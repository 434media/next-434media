# docs/standards/

Governing documents from the 434 MEDIA context store that are mirrored into the
repo because they govern code, and because reviewing a PR against a document
nobody on the review side can open is not a review.

## What is here, and what deliberately is not

Only documents with **no commercial sensitivity** are mirrored. This repository
is **public**, and a commit to a public repository cannot be retracted — forks
and clones survive a later visibility change.

Excluded on those grounds, and reachable only through the context store:

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

That list is a judgement, not a rule. Re-check it before mirroring anything new,
and when in doubt leave it in the context store.

## Verified against, not just read

The Work page is generated from Section 4 rather than transcribed from it.
[lib/work-records.ts](../../lib/work-records.ts) is written by
[scripts/master_extract.py](../../scripts/master_extract.py) from the canonical
master, and the page renders those records directly — there is no second copy of
the fields to drift out of step.

    python3 scripts/master_extract.py --check   parse and report, write nothing
    python3 scripts/master_extract.py --emit-web lib/work-records.ts
    python3 scripts/check_drift.py              has the master moved since?

`check_drift.py` is a local tool, not a CI check: it compares the manifest
against the master, and a clone without the Drive mount cannot reach the master,
so in CI it would pass unconditionally.

What CI does check is that the page still renders every published record —
[scripts/verify-work-page.ts](../../scripts/verify-work-page.ts). A hash cannot
catch a record that silently stops rendering; that check can.

A previous pair of scripts extracted the same fields into a committed JSON file
and diffed the page's literals against it. That was a second extraction path
from one source, and it verified literals the page no longer has. Both it and
`portfolio-records.json` were retired when the page became generated.

## Mirrors, not sources

| Document | Mirrored version | Canonical source |
|---|---|---|
| [display-and-design-standard.md](display-and-design-standard.md) | 1.0 — September 10, 2026 | `00 Governing/434_Display_and_Design_Standard.md` |

Files here are copied **byte-identical**. Do not edit them in the repo.

The context store remains single-writer: changes go through the founder. A mirror
can therefore fall behind its source, which is the cost of having it readable
here at all. The version line at the top of each file is how you detect that —
check it against the source before relying on the document, the same rule that
applies to the context store itself.

If a mirror should instead *become* the source of truth for its document, that is
a governance decision for the founder, not something to settle in a PR.
