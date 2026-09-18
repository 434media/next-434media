# docs/standards/

Where to find the governing documents that govern code in this repository.

Nothing governing is copied here. This directory holds pointers and the
reasoning that belongs to this repository — not the documents themselves.

## The standards that govern this repository

| Document | Canonical source | Reached from a clone |
|---|---|---|
| Display and Design Standard | `434media/434-context` → `00 Governing/434_Display_and_Design_Standard.md` | `docs/context/"00 Governing"/434_Display_and_Design_Standard.md` |

That is the only source. Read the version line in its header and work from the
version you read; there is no copy in this repository to check it against, and
that is deliberate — a copy can be stale while looking authoritative, and a
reader has no way to tell from inside the clone.

`docs/context` is a gitignored symlink to a local clone of the context repo. A
clone without it cannot read the standard. When you cannot reach it, say so in
the PR rather than working from memory of what it said.

It governs the Work page and any surface that renders Section 4 portfolio
records: which records appear, what a card shows, what a detail view shows in
what order, and — from version 1.1 — delivered sizes, formats and byte budgets
for tiles, detail-view media, posters and logos.

**A previous version of this directory carried a byte-identical mirror of that
document.** The mirror was removed in favour of this pointer: the context store
is single-writer, so a mirror can only fall behind, and the master rule that
every consumer of a governing document is generated from it, points at it, or
does not carry it at all (master 11.3) leaves no room for a third copy that is
merely correct today.

## What is deliberately not here, and why

Only documents with **no commercial sensitivity** could ever be readable from
this repository. It is **public**, and a commit to a public repository cannot be
retracted — forks and clones survive a later visibility change.

Reachable only through the context store, and never to be committed here:

| Document | Why it stays out |
|---|---|
| Master Contextual Document | Qualification ladder, engagement bands, records marked `Not published` |
| Pricing Architecture | Rates and gates |
| Implementation Decisions Register | Gates |
| Process Log & SOP | Internal operations, gates |
| Developer Build Brief · Outbound Workflow | Gates and thresholds |
| ICP (source) | Revenue test, participation gate, decline and routing rules |
| Skills and evals | Qualification logic |
| Voice System | No figures, but the outbound overlay is the outbound playbook |
| Founder biographies | Public copy, but carries editorial instructions about it |

That list is a judgement, not a rule. Re-check it before pointing at anything
new, and when in doubt leave it in the context store.

## Verified against, not just read

The Work page is generated from Section 4 rather than transcribed from it.
[lib/work-records.ts](../../lib/work-records.ts) is written by
`docs/context/"04 Build"/master_extract.py` from the canonical
master, and the page renders those records directly — there is no second copy of
the fields to drift out of step.

    python3 docs/context/"04 Build"/master_extract.py --check
        parse and report, write nothing
    python3 docs/context/"04 Build"/master_extract.py --emit-web lib/work-records.ts
    python3 scripts/check_drift.py              has the master moved since?

`check_drift.py` is a local tool, not a CI check: it compares the manifest
against the master, and a clone without the context repo cannot reach the
master, so in CI it would pass unconditionally.

What CI does check is that the page still renders every published record —
[scripts/verify-work-page.ts](../../scripts/verify-work-page.ts). A hash cannot
catch a record that silently stops rendering; that check can.

A previous pair of scripts extracted the same fields into a committed JSON file
and diffed the page's literals against it. That was a second extraction path
from one source, and it verified literals the page no longer has. Both it and
`portfolio-records.json` were retired when the page became generated.
