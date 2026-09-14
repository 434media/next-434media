#!/usr/bin/env python3
"""
Is the generated work-record extract still current?

Two questions, both cheap:

  1. Has the master moved since the artifacts were written? The manifest
     records the master version it was generated from; compare it with the
     version line in the master itself.
  2. Has anything hand-edited the extract? The manifest records a sha256
     prefix of work-records.ts; re-hash and compare.

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
RECORDS = ROOT / "lib" / "work-records.ts"
MASTER = (
    ROOT
    / "docs"
    / "context"
    / "00 Governing"
    / "434_MEDIA_Master_Contextual_Document_v2_0_Locked.md"
)

REGENERATE = "python3 scripts/master_extract.py --emit-web lib/work-records.ts"

OK = "ok"
STALE = "stale"
UNKNOWN = "unknown"


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
    if not RECORDS.exists():
        print(f"MISSING  {RECORDS.relative_to(ROOT)} not found.")
        print(f"         Generate it: {REGENERATE}")
        return 1

    try:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"UNREADABLE  {MANIFEST.relative_to(ROOT)}: {exc}")
        return 1

    generated_from = manifest.get("masterVersion")
    generated_hash = manifest.get("masterSha256")
    generated_on = manifest.get("generated")
    recorded_hash = (manifest.get("artifacts") or {}).get("work-records.ts")

    # ── 2. Hand-edit check. Needs no master, so it always runs. ──────────────
    actual_hash = hashlib.sha256(RECORDS.read_bytes()).hexdigest()[:16]
    edited = recorded_hash is not None and actual_hash != recorded_hash

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

    print(f"artifacts generated from master v{generated_from} on {generated_on}")

    if version_state is UNKNOWN:
        print("master       not reachable — docs/context is not mounted")
        print("             cannot tell whether the master has moved")
    elif version_state == OK:
        print(f"master       v{current_version} ({current_date}) {current_hash} — matches")
    elif edited_in_place:
        print(f"master       v{current_version} ({current_date}) — EDITED IN PLACE")
        print(f"             manifest {generated_hash}, file {current_hash}")
    else:
        print(f"master       v{current_version} ({current_date}) — MOVED")

    if generated_hash is None:
        print("             manifest predates masterSha256 — version check only")

    if recorded_hash is None:
        print("work-records no hash recorded in the manifest — cannot verify")
    elif edited:
        print(f"work-records EDITED — manifest {recorded_hash}, file {actual_hash}")
    else:
        print(f"work-records {actual_hash} — matches the manifest")

    print()

    if edited:
        print("FAIL  lib/work-records.ts does not match its manifest hash.")
        print("      It is generated output. Either it was hand-edited, or a")
        print("      formatter rewrote it. Do not fix it by hand — regenerate:")
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
