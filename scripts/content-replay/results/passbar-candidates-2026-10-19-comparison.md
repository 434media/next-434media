# Replay comparison: safety-only pass bar + copy candidates vs main (2026-10-19)

Same replay set (18 stories), same rules (mcu-rules-2026-10-18.2), seeds `mcu-seeds-2026-10-17.json` (sha `0e7a9a32de345d02`), and the same photo cache (copied from the baseline run's `.replay-cache`), so every run saw the same photo candidates.

| Run | Engine | Pass | Reached Canva | Holds | Cost |
|---|---|---|---|---|---|
| baseline-2026-10-19 | main `f306279` + harness | **4** | 7 | photo 8, writer 3 | $0.6849 |
| main-be3d23c-rerun-2026-10-19 | main `be3d23c` (unchanged engine) | **2** | 5 | photo 10, limits 3 | not separable* |
| passbar-candidates-2026-10-19 | branch, before the no-hold fix | **2** | 4 | photo 10, writer 4 | $0.5686 |
| passbar-candidates-2026-10-19-run2 | branch `8626109` (final engine) | **4** | 7 | photo 7, writer 4 | not separable* |

\* The last two ran in parallel; the Gateway's credits before and after cover both: $1.35 together. By tokens, the branch made 48 write calls (421,591 in / 25,912 out) against main's 61 (556,446 / 28,016); photo search and pick are the same within noise.

**Reading.** The unchanged engine scores 2 or 4 on the same set, so one run moves by about ±2. The final branch run equals the baseline (4) and is not below it. What holds across runs:
- **Copy-length holds:** main's rerun held 3 drafts on limits (Raid Hunter, PAC-3 Edge, Lightfish); the branch held none in either run. Candidates measured in code replace the shortening loop.
- **The cut-off word is gone:** VAMPIRE passes in both branch runs ("IT DOWNS DRONES / FROM A TRUCK") and in neither main run (baseline: "SEA WITH PREC"; rerun: photo).
- **Fewer write calls** (48 vs 61): the fit pass rarely runs.
- **What still loses:** photos (7–10 of 18), unchanged by this step; the Skydio briefs' "📍San Mateo, CA" / "Private company" and RTX's "Private company" (fact errors, plan v9 step c, fact extraction); writer holds on boilerplate or headquarters-less sources (Anduril ×3, PAC-3 Edge in run2).
- The first branch run lost Lightfish and Skydio F10 to writer answers "Hold: none." and "Not held. …" read as holds; `meaningful()` now reads them as no hold (tested), and run2 has neither.

| Story | baseline | main rerun | branch 1 | branch 2 |
|---|---|---|---|---|
| raid-hunter | photo | limits | photo | photo |
| anduril-thunder | writer | photo | photo | writer |
| anduril-submarine | writer | photo | writer | writer |
| pac3-edge | photo | limits | photo | writer |
| skydio-f10 | unsafe | unsafe | writer | unsafe |
| l3harris-navy-vampire | unsafe (PREC) | photo | **pass** | **pass** |
| morfius-release | photo | photo | photo | photo |
| morfius-product | photo | photo | photo | photo |
| paravision-state | **pass** | **pass** | **pass** | **pass** |
| seasats-lightfish | **pass** | limits | writer ("Hold: none.") | **pass** |
| l3harris-drone-guardian | photo | photo | photo | photo |
| anduril-eagleeye | writer | unsafe | writer | writer |
| xtend-striker | photo | photo | photo | photo |
| skydio-x10d | unsafe | unsafe | unsafe | unsafe |
| rtx-coyote | **pass** | **pass** | unsafe | unsafe |
| setaf-gtead | **pass** | photo | photo | **pass** |
| antheia-osc | photo | photo | photo | photo |
| icymi-week-2026-10-05 | photo | photo | photo | photo |

No draft in any branch run went to Review with a style note: every one that reached the Canva step had none left after the rewrites.
