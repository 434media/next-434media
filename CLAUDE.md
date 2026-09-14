# 434 Media — admin platform

Next.js (App Router) marketing site + internal admin platform for 434 Media, a
San Antonio media company. The public site serves the brand; `/admin` is a
custom CRM, content studio, and outbound pipeline built on Firestore.

Read [README.md](README.md) for the full tour — folder structure, env vars,
module-by-module detail. This file is only the things that will bite you.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Gotchas

**pnpm only.** `packageManager` is pinned and `package-lock.json` is
gitignored. Running `npm install` creates a competing lockfile and drifts the
tree — use `pnpm install` / `pnpm add`. Transitive CVE pins live in
`pnpm.overrides` in [package.json](package.json).

**Never run `vercel --prod`.** The GitHub integration auto-deploys `main` to
production. A manual deploy creates a duplicate. Push and let it fire.

**Don't commit to `main` unprompted.** Present the diff and wait for a call.

**Jurisdiction policy is one constant.** 434 Media does not cold-outreach the
EU/UK/EEA/Switzerland/Canada (GDPR/CASL). The single source of truth is
`EXCLUDED_COUNTRIES` in [lib/prospecting/scorer.ts](lib/prospecting/scorer.ts).
Any new outbound surface must gate on it rather than re-listing countries.

**Mailchimp tags are code-owned.** Exactly one live audience (`434 Media`,
`7fa6fbcb82`) segmented by the taxonomy in
[lib/mailchimp-tags.ts](lib/mailchimp-tags.ts). The app is the *sole* writer —
hand-tagging in the Mailchimp UI shows up as drift. Never invent a tag string
outside that module.

**"Properties" — and still "platforms" — means the CRM brand roster.** TXMX
Boxing, VemosVamos, MilCityUSA, DEVSA, Digital Canvas. The admin UI says
**Property** ("Property Goals", "Property fit", "All properties"); the code
still says `brand` and `platform` — field names, the `Brand` type, `BRANDS`,
`PLATFORM_OPTIONS`, the `brand-goals` tab key. That mismatch is deliberate:
renaming identifiers would break stored Firestore values for no user benefit.
So expect either word in a request, and never rename the identifiers to match.

It was renamed away from "platforms" because that collided with **"Platforms
for Brands"**, which in Section 4.3 is a commercial model for *client* work —
close to the opposite of 434-owned IP.

**Not to be confused with a GA4 property.** `propertyId` and `?property=` in
`analytics-web` and `analytics-portfolio` are Google Analytics properties, an
unrelated sense of the word. `components/analytics/BrandPeekDrawerWeb.tsx`
already renders "Property" in that sense.

This roster is the internal taxonomy, not public display text, and is
intentionally separate from the master's Section 4 names.
Brands are defined in code; their targets are runtime-editable in settings.

**Firestore is the source of truth.** The CRM reads from single canonical
collections. Named databases are read directly and normalized *at read time* —
they are deliberately not migrated into the default DB.

**Task fields that look dead aren't.** `is_opportunity`, `disposition`, and
`doc` on a task are load-bearing in the kanban. Don't prune them.

**No `Sparkles` or `Wand2` icons.** Pick something semantically grounded
instead — these read as generic AI filler.

## Working on the AI paths

All model calls route through the Vercel AI Gateway via
[lib/ai-gateway-text.ts](lib/ai-gateway-text.ts) — one key, one billing
surface. Model slugs are Gateway-style (`anthropic/claude-opus-5`); verify a
new slug exists at `https://ai-gateway.vercel.sh/v1/models` before adding it.

**The token trap:** on Claude 5 models thinking is on by default and
`maxTokens` caps thinking *plus* visible text together. A budget sized for the
answer alone gets eaten by reasoning and the response truncates mid-sentence
with `finishReason: "length"` — no exception, just a cut-off email. Leave
generous headroom (unused headroom is free; output bills per token generated)
and prefer `effort: "low"` over disabling thinking. Disabling it on Opus 5 can
make the model emit tool calls as plain text that silently never run, which
would break the translator's forced-tool contract.

Large, byte-stable system prefixes should set `cacheSystem: true` — the ICP doc
alone drops a translation from ~$0.019 to ~$0.0052 on the cached path.

## Reference

- [docs/README.md](docs/README.md) — status index for `docs/`. Says which plans
  are live intent and which are shipped. Check it before actioning any plan;
  `docs/archive/` describes finished work, not current intent.
- [lib/prospecting/icp.md](lib/prospecting/icp.md) — the ICP the prospecting
  translator is prompted with. Editing it changes live filter behavior.
- [docs/standards/](docs/standards/) — governing documents mirrored from the 434
  context store because they govern code. Currently the Display and Design
  Standard, which governs the Work page and any surface rendering portfolio
  records. Mirrors are byte-identical and never edited here; check the version
  line against the source before relying on one. Commercially sensitive
  documents — pricing, the ICP source, qualification — are deliberately absent,
  because this repository is public. See
  [docs/standards/README.md](docs/standards/README.md).

## Verifying

`npx tsc --noEmit` currently reports pre-existing errors in the Instagram,
Shopify, and framer-motion code plus stale `.next` validator types. Check that
your files are clean rather than expecting a zero exit.

## Generated from the master — never hand-edited

[lib/work-records.ts](lib/work-records.ts) and
[lib/master-manifest.json](lib/master-manifest.json) are build output, written
by [scripts/master_extract.py](scripts/master_extract.py) from Section 4 of the
canonical master. **Do not hand-edit either file, and do not let a formatter
touch them.** The manifest records a sha256 prefix of `work-records.ts`, so any
rewrite — a stray edit, a Prettier run, `eslint --fix` — changes the hash and
trips the drift check. Both paths are excluded in `.prettierignore` and
`eslint.config.mjs` for that reason.

**Before any work touching Section 4 content or those files, check for drift:**

```
python3 scripts/check_drift.py
```

It reports whether the master has moved since the artifacts were written and
re-hashes the extract to catch a hand edit. It exits 0 when the master is not
reachable — `docs/context` is a symlink to the shared drive, and a clone
without the mount cannot answer the question. That is why it is a local tool
and **not** a CI check: in CI it would pass unconditionally. What CI checks
instead is that the page still renders every published record
([scripts/verify-work-page.ts](scripts/verify-work-page.ts)) — the failure a
hash cannot catch.

**After any Section 4 change, regenerate:**

```
python3 scripts/master_extract.py --emit-web lib/work-records.ts
```

The generator finds the master via `--master`, then `MASTER_CONTEXT_PATH`, then
the repo's own `docs/context` symlink, then `~/434/docs/context`. Either of the
first two may name the document itself or the directory holding it — so a clone
without the symlink can still regenerate by pointing at a local copy.

**A master edit and its regeneration are one motion, not two.** A Section 4
change that is not regenerated leaves the site rendering the previous version
of the record, and nothing in the page will look wrong.

The generator is strict: a field key outside the Section 4.5 vocabulary stops
the run, as does a repeated field, so a record that invents a field breaks the
build rather than silently not rendering. Records marked `Work page: Not
published` are parsed and reported but excluded from the emitted file.

The manifest records both the master's version and a sha256 of the master file,
so an in-place edit with no version bump is caught too — that has happened more
than once.

## Context files — canonical source and read rules

`docs/context/` is a **symlink to the canonical Google shared drive** ("434 MEDIA — Master Operations_434MediaMGR" → "434 MEDIA — Master Context"). Files read through it are live and authoritative. It is gitignored and never committed.

### Paths

| What | Path |
|---|---|
| Master Contextual Document | `docs/context/00 Governing/434_MEDIA_Master_Contextual_Document_v2_0_Locked.md` |
| Implementation Decisions Register | `docs/context/00 Governing/434_MEDIA_Master_Document_Implementation_Decisions_Register.md` |
| Pricing Architecture | `docs/context/00 Governing/434_Pricing_Architecture.md` |
| Process Log & SOP | `docs/context/00 Governing/434_Process_Log_and_SOP.md` |
| Display and Design Standard | **`docs/standards/display-and-design-standard.md`** — mirrored into the repo so it is readable in every clone. Source: `docs/context/00 Governing/434_Display_and_Design_Standard.md` |
| Engagement Handoff (historical) | `docs/context/00 Governing/HANDOFF.md` |
| Voice router | `docs/context/01 Voice System/00-VOICE-ROUTER.md` |
| Brand voice | `docs/context/01 Voice System/01-434-MEDIA-BRAND-VOICE.md` |
| Founder voice | `docs/context/01 Voice System/02-MARCOS-RESENDEZ-FOUNDER-VOICE.md` |
| Build-inbox overlay | `docs/context/01 Voice System/03-BUILD-INBOX-VOICE-OVERLAY.md` |
| Outbound overlay | `docs/context/01 Voice System/04-OUTBOUND-VOICE-OVERLAY.md` |
| Founder bios | `docs/context/02 Founder/` |
| Build brief, generated ICP, sync script | `docs/context/04 Build/` |

Paths contain spaces. Quote them.

### Rules

**Read-only. Never write to `docs/context/`.** It is the canonical governing store and is single-writer by policy — changes go through the founder, not through this repo. Do not create, edit, move, or delete anything under that path, including generated artifacts. Write generated output into the repo (`lib/`, `scripts/`) instead.

**Report the version before relying on the master.** Read its header and state the version you are working from. If it is not the version you were told to expect, **stop and say so.** Do not search the filesystem for another copy, do not check Downloads or backup folders, and do not proceed against an older one. There is exactly one canonical source and it is reached through this symlink.

**If `docs/context/` is missing or empty**, the drive is not mounted. Stop and report it. Never fall back to a local copy.

**Section 1 definitions and Section 4 brand names are verbatim.** Never reword, shorten, or split them. Correct spellings, one word: **MilCityUSA**, **VemosVamos**, **TXMX Boxing**, **Salute to Troops**, **AMPD Project**, **¿Qué es SDOH?**, **AIM Health R&D Summit**, **OVERDRIVE**. **This governs display text only** — see the identifier rule below before renaming anything. `"Vemos Vamos"` two-word is a TypeScript union member and a stored Firestore value in 22 files; renaming those breaks live CRM data.

**The brand motto is verbatim, in two forms (Section 1.4).** Neither may be reworded, recapitalized, or re-spaced. Plain **`Actions Speak Louder`** wherever the motto is parsed rather than seen — structured data, `slogan` fields, metadata, alt text. Styled **`Actions.Speak.Louder`** for visual display. The motto is not a definition and never substitutes for the Section 1.1 canonical company definition; it may appear alongside it. It is not a claim of results and must not be extended into one.

**The master governs display names, not identifiers.** Slugs, database keys, TypeScript union members, storage paths, and analytics labels are separate from public display text and are not renamed to match the master. If changing a display string would force a change to a type member or a stored value, stop and report rather than cascading.

**Never resolve a master/codebase conflict by changing the master.** Report it.

**Never position 434 MEDIA as an AI consultant, technical agency, or white-label provider** (master Section 2). Never quote gates, rates, target ranges, or internal pricing to anything client-facing.
