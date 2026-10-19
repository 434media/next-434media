# Content pipeline replay set

The benchmark plan v9 asks for before any live gate round (Phase 1 direction 4): the real stories of gate rounds 3–6, replayed offline through the pipeline's text and check steps and its photo pick, and scored on the v9 pass bar. A change that lowers the score doesn't go to a live round.

## Rerun it

From a checkout with a Gateway credential in an env file (`vercel env pull` writes `VERCEL_OIDC_TOKEN` to `.env.local`; it lasts 12 hours):

```bash
npx tsx --env-file=.env.local scripts/content-replay/replay.ts --label <name> --seeds <path to the MCU seeds JSON>
```

- `--only raid-hunter,rtx-coyote` replays some stories; `--no-fact-check` skips the scorer's fact check.
- The seeds are the brand direction the writer gets (Firestore `content_pipeline_config/mcu_seeds` in production). They stay out of this public repository, so pass a local export, or set `REPLAY_SEEDS`.
- Output: `results/<name>.json` (every story's copy, photo, history, safety checks and calls) and `results/<name>.md` (the table).
- Cost: the Gateway's own figure, its credits' total used before and after the run. It includes the scorer's fact check.

Offline test (no network, scripted models): `npx tsx --test lib/__tests__/content-replay.test.ts`.

## What a replay runs

- **The real worker** (`lib/content-pipeline/worker.ts` `runDue`) on an in-memory store, with production's models and routing (`models.ts`), from writing through the copy checks, the targeted fresh-wording and fit passes, the photo search and the vision pick. It stops where the Canva fill would begin.
- **Research is fixed** to the captured story. A draft that production would move to another subject (no photo, a writer's hold) is held with its reason, since a replacement would be a different story.
- **Dated as the round dated it.** Each story carries the time its round drafted it, so the card date, the recency rules and the ICYMI week match the round.
- **ICYMI** runs the engine's own eligibility (`icymiStory`) over the week's posts, as the board held them.
- **Not run:** research, the Canva fill, the artwork check (it needs the export) and anything written to Firestore, the board or Slack.

## Scoring (the v9 pass bar)

A story **passes** when it reaches Review safe and within limits:

- it reaches the Canva step;
- every field is within its template limits, as the server measures them;
- every figure is in the source (`unsourcedNumbers`);
- every photo frame has a photo whose rights were read from its page. Company media counts, flagged for the reviewer to confirm its terms, as production sends it;
- no word on the card is cut off: a line's last word that the source doesn't use, and that begins a source word that is at least three letters longer ("PREC" for "precision"). The engine's own check knows only a fixed list;
- the fact check finds no statement that the source doesn't support. The check is the scorer's own: Claude Sonnet 5.5, separate from the writer.

The layout can only be seen on the Canva export, which the replay doesn't make, so a broken layout isn't scored here.

A held story's reason is sorted as v9 sorts it:

- **Kept as a hold under v9:** `photo`, `limits`, `figures`, `subject`, and `writer` (the writer judged the source can't support the facts).
- **Style** (v9 sends it to Review with a note): `originality`, `headline`, `format`.
- **Other:** `eligibility` and `error`.

To apply a scoring change to a recorded run without calling a model again, use `--rescore results/<name>.json`. The fact check's findings, the cost and the token counts are kept as recorded.

## Baseline (2026-10-19, main `f306279` plus this harness; engine unchanged)

**4 of 18 pass. $0.68 a run.** Full table: `results/baseline-2026-10-19.md`.

- **Passed:** `rtx-coyote`, `setaf-gtead`, `seasats-lightfish`, `paravision-state`. Paravision's primary page is an outlet's.
- **Reached the Canva step but unsafe: 3.**
  - `l3harris-navy-vampire`: hook "STOPS DRONES AT / SEA WITH PREC" has a cut-off word.
  - `skydio-x10d` and `skydio-f10`: the mission brief adds "📍San Mateo, CA" and "Private company", and the source states neither.
- **Held for a photo: 8.**
  - `raid-hunter`, `pac3-edge`, both MORFIUS stories, `l3harris-drone-guardian`: no candidate shows the subject.
  - `xtend-striker`: the crop is under 500 px wide.
  - `antheia-osc`: no candidate at all.
  - The ICYMI cover: no photo for a generic roundup.
- **Held by the writer: 3.** Two Anduril pages are boilerplate only, and EagleEye states no headquarters.
- **Held for style reasons that v9 drops: 0.** The copy-length and originality holds of rounds 5–6 no longer occur on main.

## Files

- `stories.json`: the replay set. For each story it records the source URL, the series, when it was drafted, the photo candidates seen (from the round's `[content-pipeline] media` logs) and what each round did. `notRebuilt` lists the attempts that can't be replayed, and why.
- `pages/`: each story's source pages, captured once with the pipeline's own fetcher (`capture.ts`; `--refresh` recaptures). Public pages only.
- `results/`: recorded runs. `baseline-2026-10-19` is the baseline on main `f306279`. `passbar-candidates-2026-10-19-comparison.md` sets plan v9 step (b) against it and against a rerun of main on the same photo cache: one run varies by about ±2 stories.
- `.replay-cache/` (repo root, gitignored) holds what the photo step fetched: the pages, the images and the archive searches. A rerun on the same machine sees the same candidates. The photos aren't 434's to publish, so they're never committed. Delete the folder to search afresh.

## How the set was built (2026-10-19, read-only)

- The drafts came from `GET /api/admin/content-pipeline/drafts/<id>` and the ICYMI posts from `GET /api/admin/crm/content-posts`, both read in the signed-in admin.
- The first story behind each round 4–6 draft and the photo candidates came from production's runtime logs, which Vercel keeps for one day.
- Round 3's logs had already expired. Its stories come from the drafts' own records, and three attempts whose URLs were never stored are listed under `notRebuilt`.
- Story attempts:
  - 18 can be replayed: 17 single stories and one ICYMI week drafted four times.
  - 3 can't be rebuilt.
  - 6 were research-only outcomes (no-content cards, "1 of 2 qualified"), which a replay with research fixed can't measure.

Known limits of the fixtures:

- Pages were captured on 2026-10-19 and may differ slightly from what the round read.
- Two anduril.com news pages give the fetcher only the site's boilerplate (1,245 characters each), and production read the same.
- `paravision-state` has an outlet as its primary page, which research on main would now skip.
