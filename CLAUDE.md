# 434 Media — admin platform

Next.js (App Router) marketing site + internal admin platform for 434 Media, a
San Antonio media company. The public site serves the brand; `/admin` is a
custom CRM, content studio, and outbound pipeline built on Firestore.

Read [README.md](README.md) for the full tour — folder structure, env vars,
module-by-module detail. This file is only the things that will bite you.

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

**"Platforms" means CRM brands.** When the ask says platforms, it means the
brand roster (TXMX Boxing, VemosVamos, MilCityUSA, DEVSA, Digital Canvas).
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

## Verifying

`npx tsc --noEmit` currently reports pre-existing errors in the Instagram,
Shopify, and framer-motion code plus stale `.next` validator types. Check that
your files are clean rather than expecting a zero exit.
