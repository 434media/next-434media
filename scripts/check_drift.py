#!/usr/bin/env python3
"""
Is the generated work-record extract still current?

Two questions, both cheap:

  1. Has the master moved since the artifacts were written? The manifest
     records the master version it was generated from; compare it with the
     version line in the master itself.
  2. Has anything hand-edited an extract? The manifest records a sha256
     prefix of each generated artifact; re-hash and compare.

  python3 scripts/check_drift.py

Exit 0 when current, or when the master is not reachable. Exit 1 when the
artifacts are stale or have been edited.

Not reaching the master is not a failure. `docs/context` is a symlink to the
Google shared drive, so a clone without the mount — CI, a new machine, a
contributor without Drive — simply cannot answer question 1. It says so and
exits 0 rather than failing a build over a missing mount. Question 2 needs no
master and still runs.

The manifest records both the master's version and a sha256 prefix of the
master file, because the master has been edited in place without a version bump
more than once. A version match alone would mean "not obviously stale"; the
hash is what makes it "provably current".

Written for Python 3.9 (the machine's interpreter). Do not use PEP 604
annotations here.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "lib" / "master-manifest.json"
# Every generated artifact, by the name the manifest records it under.
ARTIFACTS = {
    "work-records.ts": ROOT / "lib" / "work-records.ts",
    "brand-records.ts": ROOT / "lib" / "brand-records.ts",
    "work-sections.ts": ROOT / "lib" / "work-sections.ts",
    "commercial-models.ts": ROOT / "lib" / "commercial-models.ts",
    "work-media.ts": ROOT / "lib" / "work-media.ts",
}
MASTER = (
    ROOT
    / "docs"
    / "context"
    / "00 Governing"
    / "434_MEDIA_Master_Contextual_Document_v2_0_Locked.md"
)
# The records are canonical in the seed, not in the master. brand-records.ts is
# still master-derived, so the two artifacts now have two different sources and
# two different staleness questions.
SEED = (
    ROOT / "docs" / "context" / "05 System of Record" / "seed" / "portfolio_records.json"
)
SECTIONS_SEED = (
    ROOT / "docs" / "context" / "05 System of Record" / "seed" / "work_page_sections.json"
)
# The media map's source is the manifest published beside the objects, not a
# seed and not the master — a third kind of source, so a third hash.
RECORDS_MANIFEST = ROOT / "docs" / "context" / "04 Build" / "records-media-manifest.json"

REGENERATE = (
    'python3 docs/context/"05 System of Record"/scripts/emit_work_records.py \\\n'
    '          docs/context/"05 System of Record"/seed lib/work-records.ts\n'
    '        python3 docs/context/"05 System of Record"/scripts/emit_work_sections.py \\\n'
    '          docs/context/"05 System of Record"/seed lib/work-sections.ts\n'
    '        python3 docs/context/"04 Build"/master_extract.py \\\n'
    "          --emit-brand lib/brand-records.ts --emit-models lib/commercial-models.ts\n"
    '        python3 docs/context/"04 Build"/emit_work_media.py \\\n'
    '          docs/context/"04 Build"/records-media-manifest.json lib/work-media.ts'
)

OK = "ok"
STALE = "stale"
UNKNOWN = "unknown"


def digest_of(path: Path) -> Optional[str]:
    """sha256 prefix of a seed file, or None if unreachable."""
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def seed_digest() -> Optional[str]:
    return digest_of(SEED)


def master_digest() -> Optional[str]:
    """sha256 prefix of the master file, or None if unreachable."""
    if not MASTER.exists():
        return None
    try:
        return hashlib.sha256(MASTER.read_bytes()).hexdigest()[:16]
    except OSError:
        return None


def master_version() -> Optional[Tuple[str, str]]:
    """(version, date) from the master's version line, or None if unreachable."""
    if not MASTER.exists():
        return None
    try:
        lines = MASTER.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    for line in lines[:8]:
        if line.startswith("**Version"):
            m = re.match(r"\*\*Version\s+([0-9.]+)\s+—\s+([^*]+)\*\*", line)
            if m:
                return m.group(1), m.group(2).strip()
    return None


def main() -> int:
    if not MANIFEST.exists():
        print(f"MISSING  {MANIFEST.relative_to(ROOT)} not found.")
        print(f"         Generate the artifacts first: {REGENERATE}")
        return 1
    for name, path in ARTIFACTS.items():
        if not path.exists():
            print(f"MISSING  {path.relative_to(ROOT)} not found.")
            print(f"         Generate it:\n        {REGENERATE}")
            return 1

    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"UNREADABLE  {MANIFEST.relative_to(ROOT)}: {exc}")
        return 1

    generated_from = manifest.get("masterVersion")
    generated_hash = manifest.get("masterSha256")
    generated_on = manifest.get("generated")
    generated_seed = manifest.get("seedSha256")
    generated_sections = manifest.get("sectionsSeedSha256")
    generated_media = manifest.get("recordsManifestSha256")
    recorded = manifest.get("artifacts") or {}

    # ── 2. Hand-edit check. Needs no master, so it always runs. ──────────────
    # Reported per artifact: which file drifted is the first thing you need.
    checked = []
    for name, path in ARTIFACTS.items():
        actual = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
        expected = recorded.get(name)
        checked.append((name, expected, actual, expected is not None and actual != expected))
    edited = any(c[3] for c in checked)

    # ── 1. Staleness check. Needs the master. ────────────────────────────────
    found = master_version()
    current_hash = master_digest()
    edited_in_place = False
    if found is None:
        version_state = UNKNOWN
        current_version, current_date = None, None
    else:
        current_version, current_date = found
        if current_version != generated_from:
            version_state = STALE
        elif generated_hash is not None and current_hash != generated_hash:
            # Same version, different bytes. This is the case a version check
            # alone cannot see, and it has happened.
            version_state = STALE
            edited_in_place = True
        else:
            version_state = OK

    # ── 1b. Seed staleness, for the artifact the seed now owns. ─────────────
    current_media = digest_of(RECORDS_MANIFEST)
    media_stale = (current_media is not None and generated_media is not None
                   and current_media != generated_media)
    current_sections = digest_of(SECTIONS_SEED)
    sections_stale = (current_sections is not None and generated_sections is not None
                      and current_sections != generated_sections)
    current_seed = seed_digest()
    if current_seed is None:
        seed_state = UNKNOWN
    elif generated_seed is None:
        seed_state = UNKNOWN
    elif current_seed != generated_seed:
        seed_state = STALE
    else:
        seed_state = OK

    print(f"artifacts generated from master v{generated_from} on {generated_on}")

    if seed_state is UNKNOWN and current_seed is None:
        print("seed           not reachable — docs/context is not mounted")
    elif generated_seed is None:
        print("seed           manifest predates seedSha256 — cannot verify work-records.ts")
    elif seed_state == STALE:
        print(f"seed           MOVED — manifest {generated_seed}, file {current_seed}")
    else:
        print(f"seed           {current_seed} — matches")
    if media_stale:
        print(f"records man.   MOVED — manifest {generated_media}, file {current_media}")
    elif current_media is not None and generated_media is not None:
        print(f"records man.   {current_media} — matches")
    if sections_stale:
        print(f"sections seed  MOVED — manifest {generated_sections}, file {current_sections}")
    elif current_sections is not None and generated_sections is not None:
        print(f"sections seed  {current_sections} — matches")

    if version_state is UNKNOWN:
        print("master         not reachable — docs/context is not mounted")
        print("               cannot tell whether the master has moved")
    elif version_state == OK:
        print(f"master         v{current_version} ({current_date}) {current_hash} — matches")
    elif edited_in_place:
        print(f"master         v{current_version} ({current_date}) — EDITED IN PLACE")
        print(f"               manifest {generated_hash}, file {current_hash}")
    else:
        print(f"master         v{current_version} ({current_date}) — MOVED")

    if generated_hash is None:
        print("               manifest predates masterSha256 — version check only")

    for name, expected, actual, drifted in checked:
        label = name[:-3]
        if expected is None:
            print(f"{label:14} no hash recorded in the manifest — cannot verify")
        elif drifted:
            print(f"{label:14} EDITED — manifest {expected}, file {actual}")
        else:
            print(f"{label:14} {actual} — matches the manifest")

    print()

    if edited:
        drifted = [c[0] for c in checked if c[3]]
        print(f"FAIL  {', '.join(drifted)} does not match its manifest hash.")
        print("      Generated output. Either it was hand-edited, or a formatter")
        print("      rewrote it. Do not fix it by hand — regenerate:")
        print(f"        {REGENERATE}")
        return 1

    if media_stale:
        print("FAIL  04 Build/records-media-manifest.json has changed since")
        print("      lib/work-media.ts was written. Regenerate:")
        print(f"        {REGENERATE}")
        return 1

    if sections_stale:
        print("FAIL  seed/work_page_sections.json has changed since lib/work-sections.ts")
        print("      was written. The page order is canonical in the seed; regenerate:")
        print(f"        {REGENERATE}")
        return 1

    if seed_state == STALE:
        print("FAIL  seed/portfolio_records.json has changed since lib/work-records.ts")
        print("      was written. The records are canonical in the seed; regenerate:")
        print(f"        {REGENERATE}")
        return 1

    if version_state == STALE and edited_in_place:
        print(f"FAIL  the master is still v{current_version} but its contents have")
        print("      changed since the artifacts were written — an in-place edit")
        print("      with no version bump. Regenerate before relying on them:")
        print(f"        {REGENERATE}")
        return 1

    if version_state == STALE:
        print(f"FAIL  the master is v{current_version}; the artifacts were built")
        print(f"      from v{generated_from}. Regenerate before relying on them:")
        print(f"        {REGENERATE}")
        return 1

    if version_state is UNKNOWN:
        print("OK    no drift detectable without the master. The extract is")
        print("      intact; whether it is current cannot be checked here.")
        return 0

    print("OK    artifacts are current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
