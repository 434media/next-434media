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

[portfolio-records.json](portfolio-records.json) is the **public half** of the
Section 4 portfolio record — the fields the Work page renders, which are public
by definition because they are on the website. Client, 434 MEDIA role, founder
and creative credits, year, status, public description. Nothing else: internal
context, proof assets, categories and credit rules stay in the context store,
and records marked `Work page: Not published` are excluded entirely.

It exists so CI can check the Work page without the context document. The
document cannot live in a public repository; this subset already does, on the
site itself.

    scripts/extract-portfolio-records.ts   run locally with MASTER_CONTEXT_PATH
                                           set; regenerates the JSON
    scripts/verify-portfolio-records.ts    runs in CI; fails on any deviation

When the context store changes, re-run the extract and commit the JSON with the
page change. The workflow catches an abridged description, a swapped apostrophe,
a concatenated field, or a held-back record being published — all of which
reading missed during the Work page rebuild.

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
