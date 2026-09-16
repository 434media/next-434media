#!/usr/bin/env python3
"""
434 master extraction layer.

One parser, many emitters. This module reads the canonical master into
structured records; thin emitters write whatever a consumer needs. Adding a
consumer means adding an emitter, not another parser.

  python3 master_extract.py --check      parse and report, write nothing
  python3 master_extract.py --emit-web   write the website record file

Strictness is the point: a field key outside the 4.5 vocabulary stops the run.
A record that invents a field breaks the build rather than silently not
rendering.

Written for Python 3.9 (the machine's interpreter). Do not use PEP 604
annotations here.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

MASTER_FILENAME = "434_MEDIA_Master_Contextual_Document_v2_0_Locked.md"

# Where the master is looked for, in order. The default was a single hardcoded
# path under ~/434, which meant only a machine laid out that way could
# regenerate — and that is not even the repo's own documented docs/context
# symlink. Anyone else got "master not found" with no way to point it elsewhere,
# so the ability to update the Work page from the record sat on one machine.
#
# MASTER_CONTEXT_PATH is the convention already used by the ICP tooling; it may
# name the document itself or the directory holding it.
def default_master_candidates() -> list[Path]:
    return [
        Path(__file__).resolve().parent.parent / "docs" / "context" / "00 Governing" / MASTER_FILENAME,
        Path.home() / "434" / "docs" / "context" / "00 Governing" / MASTER_FILENAME,
    ]


def resolve_master(explicit: str | None) -> Path:
    """--master wins, then MASTER_CONTEXT_PATH, then the known locations."""
    for raw in (explicit, os.environ.get("MASTER_CONTEXT_PATH")):
        if raw:
            p = Path(raw).expanduser()
            # Accept either the file or the directory containing it.
            if p.is_dir():
                p = p / MASTER_FILENAME
            return p
    for candidate in default_master_candidates():
        if candidate.exists():
            return candidate
    return default_master_candidates()[0]


GOV = Path.home() / "434" / "docs" / "context" / "00 Governing"
MASTER = GOV / MASTER_FILENAME

# The 4.5 vocabulary. Anything else is an error.
FIELDS = [
    "Production categories", "Client or partner", "434 MEDIA role",
    "Founder credit", "Collaborator credits", "Years", "Operating status",
    "Work page", "Public URL", "Approved public description",
    "Internal context", "Proof assets", "Restrictions",
]

# section number -> commercial model, per 4.3
MODELS = {
    "4.8": "Original IP",
    "4.9": "Platforms for Brands",
    "4.10": "Productions for Brands",
}

NONE = {"\u2014", "-", "none", "None", ""}

FIELD_RE = re.compile(r"^\s*-\s+\*\*([^:*]+):\*\*\s*(.*)$")
REC_RE = re.compile(r"^(#{4,5})\s+(.+?)\s*$")
SEC_RE = re.compile(r"^#{2,4}\s+(4\.\d+)\b")


class MasterError(Exception):
    pass


def version(lines):
    for l in lines[:8]:
        if l.startswith("**Version"):
            m = re.match(r"\*\*Version\s+([0-9.]+)\s+\u2014\s+([^*]+)\*\*", l)
            if m:
                return m.group(1), m.group(2).strip()
    raise MasterError("no version line found in the first 8 lines")


def file_digest(path):
    """sha256 prefix of a file's bytes."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def parse(path=MASTER):
    """Return (version, date, [record]) for sections 4.8 through 4.10."""
    if not path.exists():
        raise MasterError(f"master not found: {path}")
    lines = path.read_text(encoding="utf-8").splitlines()
    ver, vdate = version(lines)

    records = []
    section = None
    current = None
    errors = []

    for i, line in enumerate(lines):
        s = SEC_RE.match(line)
        if s:
            num = s.group(1)
            if num in MODELS:
                section = num
            elif section is not None:
                section = None  # left the portfolio sections
            current = None
            continue
        if section is None:
            continue

        r = REC_RE.match(line)
        if r:
            current = {
                "name": r.group(2),
                "model": MODELS[section],
                "section": section,
                "nested": len(r.group(1)) == 5,
                "line": i + 1,
                "fields": {},
            }
            records.append(current)
            continue

        f = FIELD_RE.match(line)
        if f and current is not None:
            key, value = f.group(1).strip(), f.group(2).strip()
            if key not in FIELDS:
                errors.append(f"line {i+1}: record {current['name']!r} uses "
                              f"field {key!r}, which is not in the 4.5 vocabulary")
                continue
            if key in current["fields"]:
                errors.append(f"line {i+1}: record {current['name']!r} repeats "
                              f"field {key!r}")
                continue
            current["fields"][key] = value

    if errors:
        raise MasterError("\n".join(errors))
    return ver, vdate, records


def is_none(value):
    return value.strip() in NONE


def published(rec):
    wp = rec["fields"].get("Work page", "").strip().lower()
    return not wp.startswith("not published")


def gaps(records):
    """Records missing a public URL, and records missing proof media."""
    no_url, no_media = [], []
    for r in records:
        if not published(r):
            continue
        if is_none(r["fields"].get("Public URL", "\u2014")):
            no_url.append(r["name"])
        proof = r["fields"].get("Proof assets", "")
        if is_none(proof) or "to be supplied" in proof.lower():
            no_media.append(r["name"])
    return no_url, no_media


def ts(value):
    """A TypeScript string literal, or null for an em dash."""
    if is_none(value):
        return "null"
    return json.dumps(value, ensure_ascii=False)


def emit_web(ver, vdate, records, out_path):
    pub = [r for r in records if published(r)]
    body = []
    for r in pub:
        f = r["fields"]
        body.append("  {\n" + "".join(
            f"    {k}: {v},\n" for k, v in [
                ("title", json.dumps(r["name"], ensure_ascii=False)),
                ("model", json.dumps(r["model"], ensure_ascii=False)),
                ("categories", ts(f.get("Production categories", "\u2014"))),
                ("client", ts(f.get("Client or partner", "\u2014"))),
                ("role", ts(f.get("434 MEDIA role", "\u2014"))),
                ("founderCredit", ts(f.get("Founder credit", "\u2014"))),
                ("collaboratorCredit", ts(f.get("Collaborator credits", "\u2014"))),
                ("years", ts(f.get("Years", "\u2014"))),
                ("status", ts(f.get("Operating status", "\u2014"))),
                ("publicUrl", ts(f.get("Public URL", "\u2014"))),
                ("description", ts(f.get("Approved public description", "\u2014"))),
            ]) + "  }")

    src = (
        "// GENERATED FILE - DO NOT EDIT BY HAND.\n"
        "// Written by scripts/master_extract.py from the canonical master.\n"
        f"// Master version {ver} ({vdate}). Regenerate after any section 4 change.\n"
        "// Internal context, proof assets and restrictions are deliberately\n"
        "// excluded - they are not for public display.\n\n"
        "export interface WorkRecord {\n"
        "  title: string\n  model: string\n  categories: string | null\n"
        "  client: string | null\n  role: string | null\n"
        "  founderCredit: string | null\n  collaboratorCredit: string | null\n"
        "  years: string | null\n  status: string | null\n"
        "  publicUrl: string | null\n  description: string | null\n}\n\n"
        "export const WORK_RECORDS: WorkRecord[] = [\n"
        + ",\n".join(body) + "\n]\n"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(src, encoding="utf-8")
    return len(pub), hashlib.sha256(src.encode()).hexdigest()[:16]


SEC1_RE = re.compile(r"^###\s+1\.(\d+)\s+(.*)$")
BOLD_RE = re.compile(r"^\*\*(.+?)\*\*\s*$")
TICK_RE = re.compile(r"`([^`]+)`")


def _sec1_lines(path):
    """The lines of section 1, as a list."""
    lines = path.read_text(encoding="utf-8").splitlines()
    tops = [i for i, l in enumerate(lines) if l.startswith("## ")]
    if len(tops) < 2:
        raise MasterError("could not locate section boundaries")
    return lines[tops[0]:tops[1]]


def _first_bold_under(lines, num):
    """First standalone bold line under subsection 1.<num>."""
    start = None
    for i, l in enumerate(lines):
        m = SEC1_RE.match(l)
        if m and m.group(1) == str(num):
            start = i
            continue
        if start is not None and SEC1_RE.match(l):
            break
        if start is not None:
            b = BOLD_RE.match(l.strip())
            if b:
                return b.group(1).strip()
    return None


def _bold_after_label(lines, label):
    """First standalone bold line following a line containing label."""
    seen = False
    for l in lines:
        if not seen and label in l:
            seen = True
            continue
        if seen:
            b = BOLD_RE.match(l.strip())
            if b:
                return b.group(1).strip()
    return None


def _ticked_in_bullet(lines, label):
    """The backticked value in a bullet whose key is label."""
    for l in lines:
        if l.lstrip().startswith("-") and label in l:
            m = TICK_RE.search(l)
            if m:
                return m.group(1).strip()
    return None


def parse_brand(path=MASTER):
    """Return the governed section 1 strings, or raise."""
    lines = _sec1_lines(path)
    brand = {
        "canonicalDefinition": _first_bold_under(lines, 1),
        "shortDescriptor": _bold_after_label(lines, "Approved short descriptor:"),
        "spokenIntroduction": _bold_after_label(lines, "Approved spoken introduction:"),
        "mottoPlain": _ticked_in_bullet(lines, "Plain form:"),
        "mottoStyled": _ticked_in_bullet(lines, "Styled form:"),
    }
    missing = [k for k, v in brand.items() if not v]
    if missing:
        raise MasterError(
            "section 1 strings not found: " + ", ".join(missing) +
            ". The emitter anchors on the heading and label wording in 1.1, "
            "1.3 and 1.4; if that wording changed, the emitter changes with it "
            "rather than emitting an empty field.")
    return brand


def emit_brand(ver, vdate, brand, out_path):
    src = (
        "// GENERATED FILE - DO NOT EDIT BY HAND.\n"
        "// Written by scripts/master_extract.py from the canonical master.\n"
        f"// Master version {ver} ({vdate}). Regenerate after any section 1 change.\n"
        "//\n"
        "// mottoPlain is for machine-read fields: JSON-LD slogan, image alt text,\n"
        "// meta. mottoStyled is for visual display. Both are verbatim per 1.4 and\n"
        "// neither may be reworded, recapitalized, or re-spaced. The motto is not a\n"
        "// definition and never substitutes for canonicalDefinition on primary\n"
        "// company materials, and must never be extended with an outcome claim.\n\n"
        "export const BRAND_RECORDS = {\n"
        + "".join(f"  {k}: {json.dumps(v, ensure_ascii=False)},\n"
                 for k, v in brand.items())
        + "} as const\n"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(src, encoding="utf-8")
    return hashlib.sha256(src.encode()).hexdigest()[:16]


def update_manifest(out_path, ver, vdate, master, name, digest):
    """Merge one artifact hash into the manifest beside it, keeping the others.

    Each emitter writes its own artifact, so the manifest is merged rather than
    replaced — running --emit-brand alone must not drop the work-records hash,
    and vice versa.
    """
    manifest = Path(out_path).parent / "master-manifest.json"
    existing = {}
    if manifest.exists():
        try:
            existing = json.loads(manifest.read_text(encoding="utf-8"))
        except ValueError:
            existing = {}
    artifacts = dict(existing.get("artifacts") or {})
    artifacts[name] = digest
    manifest.write_text(json.dumps({
        "masterVersion": ver,
        "masterDate": vdate,
        # The master has been edited in place without a version bump, so the
        # version alone cannot answer "is this current?". Hash it too.
        "masterSha256": file_digest(master),
        "generated": date.today().isoformat(),
        "artifacts": artifacts,
    }, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--emit-web", metavar="PATH")
    ap.add_argument("--emit-brand", metavar="PATH")
    ap.add_argument(
        "--master",
        metavar="PATH",
        help="the master document, or the directory holding it. "
        "Falls back to MASTER_CONTEXT_PATH, then the repo's docs/context symlink, "
        "then ~/434/docs/context.",
    )
    args = ap.parse_args()

    master = resolve_master(args.master)
    if not master.exists():
        print(
            f"MASTER ERROR\nmaster not found: {master}\n\n"
            "Point at it with --master, or set MASTER_CONTEXT_PATH. It may name the\n"
            "document itself or the directory containing it.",
            file=sys.stderr,
        )
        return 1

    try:
        ver, vdate, records = parse(master)
    except MasterError as e:
        print(f"MASTER ERROR\n{e}", file=sys.stderr)
        return 1

    pub = [r for r in records if published(r)]
    print(f"master v{ver} ({vdate})")
    print(f"{len(records)} record(s), {len(pub)} published\n")

    for model in ("Original IP", "Platforms for Brands", "Productions for Brands"):
        names = [r["name"] for r in pub if r["model"] == model]
        print(f"  {model}: {len(names)}")

    no_url, no_media = gaps(records)
    print(f"\n=== outstanding ===")
    print(f"  {len(no_url)} published record(s) without a public URL")
    for n in no_url:
        print(f"      {n}")
    print(f"  {len(no_media)} published record(s) without proof media")
    for n in no_media:
        print(f"      {n}")

    if args.emit_web:
        count, digest = emit_web(ver, vdate, records, Path(args.emit_web))
        print(f"\nwrote {count} record(s) -> {args.emit_web}")
        print(f"  master v{ver} | sha256 {digest}")
        manifest = update_manifest(
            args.emit_web, ver, vdate, master, Path(args.emit_web).name, digest)
        print(f"  manifest -> {manifest}")

    if args.emit_brand:
        try:
            brand = parse_brand(master)
        except MasterError as e:
            print(f"BRAND ERROR\n{e}", file=sys.stderr)
            return 1
        digest = emit_brand(ver, vdate, brand, Path(args.emit_brand))
        print(f"\nwrote {len(brand)} brand string(s) -> {args.emit_brand}")
        print(f"  master v{ver} | sha256 {digest}")
        for k, v in brand.items():
            print(f"      {k}: {v}")
        manifest = update_manifest(
            args.emit_brand, ver, vdate, master, Path(args.emit_brand).name, digest)
        print(f"  manifest -> {manifest}")

    if not args.emit_web and not args.emit_brand:
        print("\nParse only. Pass --emit-web PATH or --emit-brand PATH to write.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
