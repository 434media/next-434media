"""The lanes check: is this pull request cleared for its lane? (Four-lane setup, step 4.)

Master 7.6 and Contributor Standard section 10. The lane map is the BASE branch's
`.github/CODEOWNERS`, so a pull request cannot change the map that judges it:
- a file whose last matching line has an owner is lane 1 or 2: a founder must have
  approved the pull request's head commit;
- an ownerless line inside the `# ── Lane 3` block is lane 3: a founder's `/seen`
  comment, and an approval of the head commit from the review App (or, until the review
  workflow exists, from a founder);
- anything else is lane 4: it passes.
A pull request takes the strictest lane of any file it changes, old names of renamed
files included.

The tripwire (TRIPWIRE=1): an added line in a lane-3 or lane-4 code file that calls a
sending, posting, payment or admin-permission path counts as lane 2. A code file whose
patch GitHub omits counts as tripped, so the founder looks.

The verdict is written as the commit status `lanes` on the head commit, with the
workflow's GITHUB_TOKEN; that status is the required check. The pull request's code is
never checked out or run: the changed files and their patches come from the API.

Standard library only. Env: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER (or HEAD_SHA),
FOUNDER_LOGINS (comma-separated), REVIEW_LOGIN, TRIPWIRE, DRY_RUN.
"""

import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.github.com"
STATUS_CONTEXT = "lanes"

TRIPWIRE_PATTERNS = [
    re.compile(r"""(?:from|require\(|import\()\s*['"][^'"]*(?:resend|mailchimp|stripe|shopify|owned-meta|instagram-publishing|email-templates)[^'"]*['"]""", re.I),
    re.compile(r"api\.resend\.com|mandrillapp|api\.mailchimp\.com|\.api\.mailchimp\.com", re.I),
    re.compile(r"graph\.facebook\.com|media_publish|/feed\b.*\bPOST\b", re.I),
    re.compile(r"chat\.postMessage|hooks\.slack\.com|chat_postMessage", re.I),
    re.compile(r"api\.stripe\.com|checkout\.sessions|cartCreate|checkoutCreate"),
    re.compile(r"\brequireAdmin\b|\bfounderGuard\b|\brequireFounder\b"),
]
CODE_FILE = re.compile(r"\.(?:ts|tsx|js|jsx|mjs|cjs|py)$")
LANE_HEADING = re.compile(r"^#\s*─+\s*Lane\s+(\d)")


# ── The lane map ───────────────────────────────────────────────────────────────────

def pattern_regex(pattern):
    """CODEOWNERS (gitignore-style) pattern to a regex over a repository-relative path."""
    anchored = pattern.startswith("/") or "/" in pattern.rstrip("/")
    body = pattern.strip("/") if pattern.endswith("/") else pattern.lstrip("/")
    out, i = [], 0
    while i < len(body):
        if body.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif body.startswith("**", i):
            out.append(".*")
            i += 2
        elif body[i] == "*":
            out.append("[^/]*")
            i += 1
        elif body[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(body[i]))
            i += 1
    prefix = "^" if anchored else "^(?:.*/)?"
    return re.compile(prefix + "".join(out) + "(?:/.*)?$")


def parse_codeowners(text):
    """Returns rules in file order: (regex, has_owner, in_lane3, line)."""
    rules, lane = [], None
    for raw in text.splitlines():
        line = raw.strip()
        heading = LANE_HEADING.match(line)
        if heading:
            lane = int(heading.group(1))
            continue
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        rules.append((pattern_regex(parts[0]), len(parts) > 1, lane == 3, parts[0]))
    return rules


def lane_of(path, rules):
    """1 (owned: lanes 1 and 2 alike, the founder approves), 3 or 4."""
    match = None
    for rule in rules:
        if rule[0].match(path):
            match = rule
    if match is None:
        return 4, None
    if match[1]:
        return 1, match[3]
    return (3 if match[2] else 4), match[3]


def tripped(patch):
    if patch is None:
        return True
    for line in patch.splitlines():
        if line.startswith("+") and not line.startswith("+++"):
            if any(p.search(line) for p in TRIPWIRE_PATTERNS):
                return True
    return False


# ── The verdict ────────────────────────────────────────────────────────────────────

def judge(files, rules, reviews, comments, head_sha, founders, review_login, tripwire):
    """Returns (passed, description)."""
    strictest, owned_by, trip = 4, [], []
    for f in files:
        for name in [f["filename"]] + ([f["previous_filename"]] if f.get("previous_filename") else []):
            lane, _ = lane_of(name, rules)
            if lane == 1:
                owned_by.append(name)
            elif tripwire and lane in (3, 4) and CODE_FILE.search(name) and f.get("status") != "removed" \
                    and tripped(f.get("patch")):
                trip.append(name)
                lane = 1
            strictest = min(strictest, lane)

    latest = {}
    for r in reviews:
        login = (r.get("user") or {}).get("login", "")
        if r.get("state") in ("APPROVED", "CHANGES_REQUESTED", "DISMISSED"):
            latest[login] = r
    def approved_head(logins):
        return any(r.get("state") == "APPROVED" and r.get("commit_id") == head_sha
                   for login, r in latest.items() if login in logins)
    founder_ok = approved_head(founders)

    if strictest == 1:
        why = "tripwire: " + trip[0] if trip and not owned_by else owned_by[0] if owned_by else trip[0]
        if founder_ok:
            return True, "Lane 1-2: founder approved the head commit"
        return False, "Lane 1-2 (%s): waiting for the founder's approval of the head commit" % why
    if strictest == 3:
        seen = any((c.get("user") or {}).get("login") in founders
                   and c.get("body", "").strip().lower().startswith("/seen") for c in comments)
        reviewed = approved_head({review_login}) or founder_ok
        if seen and reviewed:
            return True, "Lane 3: seen by the founder and approved"
        missing = [x for x, ok in (("founder's /seen", seen), ("review approval of the head commit", reviewed)) if not ok]
        return False, "Lane 3: waiting for " + " and ".join(missing)
    return True, "Lane 4: merges on its checks"


# ── GitHub ─────────────────────────────────────────────────────────────────────────

def api(method, path, body=None):
    req = urllib.request.Request(
        API + path, method=method, data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"],
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "434-lanes"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def paged(path):
    items, page = [], 1
    while True:
        sep = "&" if "?" in path else "?"
        batch = api("GET", "%s%sper_page=100&page=%d" % (path, sep, page))
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    number = os.environ.get("PR_NUMBER", "").strip()
    if not number and os.environ.get("HEAD_SHA"):
        pulls = api("GET", "/repos/%s/commits/%s/pulls" % (repo, os.environ["HEAD_SHA"]))
        number = str(pulls[0]["number"]) if pulls else ""
    if not number:
        print("No pull request to judge.")
        return 0
    pr = api("GET", "/repos/%s/pulls/%s" % (repo, number))
    if pr["state"] != "open":
        print("Pull request #%s is %s; nothing to judge." % (number, pr["state"]))
        return 0
    head_sha, base_ref = pr["head"]["sha"], pr["base"]["ref"]
    owners = api("GET", "/repos/%s/contents/.github/CODEOWNERS?ref=%s" % (repo, urllib.parse.quote(base_ref)))
    rules = parse_codeowners(base64.b64decode(owners["content"]).decode("utf-8"))
    files = paged("/repos/%s/pulls/%s/files" % (repo, number))
    reviews = paged("/repos/%s/pulls/%s/reviews" % (repo, number))
    comments = paged("/repos/%s/issues/%s/comments" % (repo, number))
    founders = {s.strip() for s in os.environ.get("FOUNDER_LOGINS", "434mediamgr").split(",") if s.strip()}
    passed, description = judge(files, rules, reviews, comments, head_sha, founders,
                                os.environ.get("REVIEW_LOGIN", "434-review[bot]"),
                                os.environ.get("TRIPWIRE") == "1")
    print("#%s %s: %s" % (number, "pass" if passed else "wait", description))
    if os.environ.get("DRY_RUN") != "1":
        api("POST", "/repos/%s/statuses/%s" % (repo, head_sha), {
            "state": "success" if passed else "failure",
            "context": STATUS_CONTEXT,
            "description": description[:140],
            "target_url": "%s/%s/actions/runs/%s" % (os.environ.get("GITHUB_SERVER_URL", "https://github.com"),
                                                     repo, os.environ.get("GITHUB_RUN_ID", "")),
        })
    return 0


if __name__ == "__main__":
    sys.exit(main())
