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
import re
import sys
from datetime import date
from pathlib import Path

GOV = Path.home() / "434" / "docs" / "context" / "00 Governing"
MASTER = GOV / "434_MEDIA_Master_Contextual_Document_v2_0_Locked.md"

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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--emit-web", metavar="PATH")
    args = ap.parse_args()

    try:
        ver, vdate, records = parse()
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
        manifest = Path(args.emit_web).parent / "master-manifest.json"
        manifest.write_text(json.dumps({
            "masterVersion": ver,
            "masterDate": vdate,
            "generated": date.today().isoformat(),
            "artifacts": {Path(args.emit_web).name: digest},
        }, indent=2) + "\n", encoding="utf-8")
        print(f"  manifest -> {manifest}")
    else:
        print("\nParse only. Pass --emit-web PATH to write the record file.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
