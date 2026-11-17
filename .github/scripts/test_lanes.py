"""Tests for lanes.py against this repository's own CODEOWNERS.
Run from the repository root: python3 -I .github/scripts/test_lanes.py"""

import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
spec = importlib.util.spec_from_file_location("lanes", os.path.join(HERE, "lanes.py"))
lanes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lanes)
RULES = lanes.parse_codeowners(open(os.path.join(ROOT, ".github", "CODEOWNERS")).read())
WEBSITE = any(r[3] == "/app/**/*.tsx" for r in RULES)

if WEBSITE:
    EXPECT = {
        "CLAUDE.md": 1, ".claude/settings.json": 1, ".github/workflows/lanes.yml": 1,
        "lib/resend.ts": 1, "app/admin/finance/page.tsx": 1, "lib/auth.ts": 1,
        "components/Header.tsx": 3, "app/work/page.tsx": 3, "app/globals.css": 3,
        "lib/work-records.ts": 3, "public/logo.svg": 3,
        "lib/firestore-tasks.ts": 4, "package.json": 4, "scripts/foo.ts": 4, "app/api/health/route.ts": 4,
    }
else:
    EXPECT = {
        "CLAUDE.md": 1, ".claude/skills/x/SKILL.md": 1, ".github/workflows/lanes.yml": 1,
        "00 Governing/434_MEDIA_Policy.md": 1, "06 Standards/434_Security_Policy.md": 1,
        "03 Skills/intake/SKILL.md": 1, "05 Run Logs/security/434_Security_Log.md": 1,
        "04 Build/434_System_Map.md": 1, "05 System of Record/seed/rate_card.json": 1,
        "03 Skills/skills-index.json": 4, "03 Skills/deployed-state.jsonl": 4,
        "05 Run Logs/2026-11-17-1627-x.md": 4, "04 Build/434_Four_Lane_Setup.md": 4,
        "05 System of Record/seed/portfolio.json": 4,
    }

HEAD = "abc123"
FOUNDERS = {"434mediamgr"}


def review(login, state="APPROVED", commit=HEAD):
    return {"user": {"login": login}, "state": state, "commit_id": commit}


def judge(paths, reviews=(), comments=(), tripwire=False, patches=None):
    files = [{"filename": p, "status": "modified", "patch": (patches or {}).get(p, "+// ok")} for p in paths]
    return lanes.judge(files, RULES, list(reviews), list(comments), HEAD, FOUNDERS, "434-review[bot]", tripwire)


class LaneMap(unittest.TestCase):
    def test_expected_lanes(self):
        for path, lane in EXPECT.items():
            self.assertEqual(lanes.lane_of(path, RULES)[0], lane, path)

    def test_pattern_semantics(self):
        self.assertTrue(lanes.pattern_regex("/00*Governing/").match("00 Governing/a/b.md"))
        self.assertFalse(lanes.pattern_regex("/00*Governing/").match("x/00 Governing/a.md"))
        self.assertTrue(lanes.pattern_regex("/app/**/*.tsx").match("app/page.tsx"))
        self.assertTrue(lanes.pattern_regex("/app/**/*.tsx").match("app/a/b/page.tsx"))
        self.assertFalse(lanes.pattern_regex("/app/**/*.tsx").match("app/a/route.ts"))
        self.assertTrue(lanes.pattern_regex("/lib/quickbooks*").match("lib/quickbooks/sync.ts"))
        self.assertTrue(lanes.pattern_regex("README.md").match("docs/README.md"))


class Verdict(unittest.TestCase):
    def test_lane4_passes(self):
        path = [p for p, l in EXPECT.items() if l == 4][0]
        self.assertTrue(judge([path])[0])

    def test_owned_needs_founder_on_head(self):
        self.assertFalse(judge(["CLAUDE.md"])[0])
        self.assertFalse(judge(["CLAUDE.md"], [review("434mediamgr", commit="old")])[0])
        self.assertFalse(judge(["CLAUDE.md"], [review("434-review[bot]")])[0])
        self.assertTrue(judge(["CLAUDE.md"], [review("434mediamgr")])[0])

    def test_dismissed_approval_does_not_count(self):
        self.assertFalse(judge(["CLAUDE.md"], [review("434mediamgr"), review("434mediamgr", "DISMISSED")])[0])

    def test_rename_from_owned_path_is_owned(self):
        files = [{"filename": "notes/x.md", "previous_filename": "CLAUDE.md", "status": "renamed", "patch": ""}]
        self.assertFalse(lanes.judge(files, RULES, [], [], HEAD, FOUNDERS, "434-review[bot]", False)[0])

    @unittest.skipUnless(WEBSITE, "lane 3 exists only in the website")
    def test_lane3(self):
        seen = [{"user": {"login": "434mediamgr"}, "body": "/seen"}]
        self.assertFalse(judge(["components/Header.tsx"])[0])
        self.assertFalse(judge(["components/Header.tsx"], [review("434-review[bot]")])[0])
        self.assertTrue(judge(["components/Header.tsx"], [review("434-review[bot]")], seen)[0])
        self.assertTrue(judge(["components/Header.tsx"], [review("434mediamgr")], seen)[0])
        not_founder = [{"user": {"login": "434-jesse"}, "body": "/seen"}]
        self.assertFalse(judge(["components/Header.tsx"], [review("434-review[bot]")], not_founder)[0])

    def test_tripwire(self):
        path = "lib/new-thing.ts" if WEBSITE else "04 Build/new_thing.py"
        bad = {path: "+import { Resend } from 'resend'"}
        self.assertTrue(judge([path], tripwire=False, patches=bad)[0])
        self.assertFalse(judge([path], tripwire=True, patches=bad)[0])
        self.assertTrue(judge([path], [review("434mediamgr")], tripwire=True, patches=bad)[0])
        self.assertTrue(judge([path], tripwire=True)[0])
        self.assertFalse(judge([path], tripwire=True, patches={path: None})[0])


if __name__ == "__main__":
    unittest.main()
