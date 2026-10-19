# Replay after the #208 review: branch `8ace0c5` vs main `be3d23c`, twice each (2026-10-19)

Run one after another (branch, main, branch, main) on one shared photo cache, so each run's Gateway cost is its own. Same set, rules mcu-rules-2026-10-18.2 and seeds (sha `0e7a9a32de345d02`) as the baseline.

| Run | Engine | Pass | Reached Canva | Unsafe there | Holds | Cost | Write calls (in / out tokens) |
|---|---|---|---|---|---|---|---|
| review-branch-a | branch `8ace0c5` | **2** | 6 | 4 | photo 7, writer 5 | $0.6374 | 56 (501,264 / 31,939) |
| review-main-a | main `be3d23c` | **1** | 4 | 3 | photo 8, limits 4, writer 2, format 1 | $0.5500 | 63 (572,566 / 29,937) |
| review-branch-b | branch `8ace0c5` | **4** | 5 | 1 | photo 9, writer 3, limits 1, format 1 | $0.6738 | 57 (496,586 / 30,047) |
| review-main-b | main `be3d23c` | **3** | 7 | 4 | photo 8, writer 2, limits 1 | $0.7199 | 55 (484,909 / 26,898) |

**Scores across every run on this set:**
- **Main, four runs:** 4 (the baseline), 2, 1 and 3, a mean of 2.5.
- **Branch, four runs:** 2 and 4 at `8626109`, then 2 and 4 at `8ace0c5`, a mean of 3.0.
- **Noise:** one run moves by about ±2. The branch is not below main, and the difference is inside the noise.
- **Cost:** branch $0.64 and $0.67 a run, main $0.55 and $0.72. Same range.

**What differs consistently:**
- **Copy-length holds.** Main 0, 3, 4 and 1. Branch 0, 0, 0 and 1. The branch's one is Raid Hunter in run b, where no candidate fit after 2 batches and the caption also lacked its source line, which is a safety hold.
- **Cut-off words on a card that reached Canva.** Main had "PREC" (baseline, VAMPIRE) and "MIN" (rerun, Skydio F10). The branch had none in four runs.

**What doesn't differ:**
- **VAMPIRE** passes on main too in both review runs, so its pass is not evidence by itself.
- **Write calls** are within noise: branch 56 and 57, main 63 and 55.

**Still losing on both engines:**
- photos, 7–9 of 18;
- the mission briefs' invented "📍San Mateo, CA", "📍Costa Mesa, CA" and "Private company" (Skydio, Anduril EagleEye, RTX on main): fact errors, which step (c), fact extraction, targets;
- writer holds on boilerplate pages.

**Harness fault in review-branch-a:**
- Skydio F10's fact check returned its list as a JSON string ("out.map is not a function"), and the story was counted unsafe.
- Every other run of that story found the same invented San Mateo line, so the count likely stands.
- The scorer now accepts the string form (`replay.ts`); the recorded runs are left as they ran.

**Style notes:** no draft in any branch run went to Review with one. Every draft that reached Canva had none left after the rewrites, so that path is proven by the offline tests only.
