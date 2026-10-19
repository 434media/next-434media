# Replay: photo first and the DVIDS API (plan v10, step c), branch vs main, twice each (2026-10-19)

Run one after another (branch, main, branch, main) on one shared photo cache: a copy of the #208 review's cache, which the branch then added its DVIDS API searches to. Same set, rules mcu-rules-2026-10-18.2 and seeds (sha `0e7a9a32de345d02`) as the baseline. Branch engine `9782ee3` (the runs record `a388c09`, a README-only commit on top). Main `38b94e0`.

| Run | Engine | Pass | Reached Canva | Unsafe there | Holds | Photo first: kept / skipped | Cards with a DVIDS photo | Cost | Write calls | Photo calls (search / pick) |
|---|---|---|---|---|---|---|---|---|---|---|
| photofirst-branch-a | branch | **3** | 5 | 2 | photo 10, writer 2, limits 1 | 7 / 10 | 2 | $0.8902 | 21 | 57 / 18 |
| photofirst-main-a | main | **4** | 7 | 3 | writer 7, photo 4 | — | — | $0.5471 | 48 | 24 / 10 |
| photofirst-branch-b | branch | **3** | 6 | 3 | photo 11, writer 1 | 7 / 10 | 1 | $0.9170 | 25 | 59 / 18 |
| photofirst-main-b | main | **2** | 4 | 2 | photo 9, writer 5 | — | — | $0.5562 | 46 | 32 / 11 |

**Scores:** branch 3 and 3 (mean 3.0); main 4 and 2 (mean 3.0). Every main run on this set so far: 4, 2, 1, 3, 4, 2 (mean 2.7). Inside the ±2 noise: photo first neither raises nor lowers the replay score.

**What photo first did, the same in both branch runs:**
- **Skipped 10 of the 17 single stories before writing:** raid-hunter, anduril-thunder, anduril-submarine, pac3-edge, both MORFIUS stories, l3harris-drone-guardian, xtend-striker, setaf-gtead and antheia-osc.
- **9 of those 10 failed on main in both main runs too** (held for a photo or by the writer). The one exception is setaf-gtead, which passed in main-a and was held for a photo in main-b: photo first judged its best photo a cut-off crop before the writer's own photo query could find another.
- **Kept 7**, and each kept story's card used the photo confirmed before writing; no second search or pick ran for it.
- Production would try the next candidate story for each skip. **The replay can't show that**: research is fixed to the captured story, so a skip counts as a fail here.

**The DVIDS API:** two cards in branch-a and one in branch-b carry a DVIDS photo found through the API (Seasats Lightfish, credited "U.S. Army photo by Spc. Jacob D. Harrell", in both; Skydio X10D in branch-a). No story the old search lost was won by DVIDS alone: the losses are products that DVIDS does not show (PAC-3 Edge, MORFIUS, Drone Guardian, Raid Hunter).

**Cost:** about $0.35 more a run ($0.89 and $0.92 against $0.55 and $0.56), from checking every story's photo, including the ten that main reaches only after writing or never. Writing falls by half (21 and 25 write calls against 48 and 46), because skipped stories are never written. Per story checked: about 3.4 text calls (the subject, the photo search, the representative search) and 1.1 vision calls, roughly $0.02.

**Still losing among the 7 kept stories:** invented mission-brief lines ("📍San Mateo, CA", "📍Redwood City, CA", "📍Costa Mesa, CA", "Private company") on Skydio X10D, Skydio F10 and Anduril EagleEye, which is step (d), fact extraction; writer holds (Skydio F10 in a, Paravision in a, VAMPIRE in b).

**The stopping point (about 10 of 18 after steps c and d):** on this set, with photo first on, at most 7 single stories and the ICYMI week can reach Review, because 10 of the 17 have no usable photo in any source searched. If fact extraction fixed every one of the 7, the score would be about 7–8 of 18. The replay as built can't reach 10 with photo first, by construction, so the stopping point needs a measure that counts a skipped story's replacement (a live round, or a replay set that records a research pass's other candidates).

## After the coordinator's review (branch `1aa0f04`), rerun the same way

The fixes: each photo check is its own saved step; a DVIDS photo is offered only with a U.S. government credit line and nothing saying otherwise; the confirmed photo is placed only when the card names the subject it was confirmed for. The DVIDS part of the cache was cleared first, so the branch searched DVIDS again under the new rights rule. The rest of the cache is the one above.

| Run | Engine | Pass | Reached Canva | Unsafe there | Holds | Photo first: kept / skipped | Cost | Write calls | Photo calls (search / pick) |
|---|---|---|---|---|---|---|---|---|---|
| review-pf-branch-a | branch `1aa0f04` | **2** | 5 | 3 | photo 9, writer 3, limits 1 | 8 / 9 | $0.8843 | 22 | 55 / 17 |
| review-pf-main-a | main `38b94e0` | **4** | 7 | 3 | photo 8, writer 2, limits 1 | — | $0.7643 | 50 | 36 / 15 |
| review-pf-branch-b | branch `1aa0f04` | **6** | 8 | 2 | photo 10 | 8 / 9 | $0.9609 | 30 | 59 / 18 |
| review-pf-main-b | main `38b94e0` | **4** | 7 | 3 | photo 9, writer 2 | — | $0.6849 | 60 | 38 / 15 |

- **Scores:** branch 2 and 6 (mean 4.0); main 4 and 4 (mean 4.0). Inside the noise again.
  - Every main run on this set: 4, 2, 1, 3, 4, 2, 4, 4 (mean 3.0).
  - Every branch run of this step: 3, 3, 2, 6 (mean 3.5).
- **Photo first** kept 8 and skipped 9 in both runs. setaf-gtead is now kept, because the subject re-check let its card get its own pick. The 9 skipped stories failed on main in all four main runs.
- **Unsafe at the Canva step:** almost all fact errors in the mission briefs, which is step (d):
  - "📍San Mateo, CA" and "Costa Mesa, CA" lines;
  - a "Private company" line on Raytheon;
  - one "Goal:" line that widens the source's "Gulf of America" to "U.S. waters".
- **DVIDS through the API:**
  - Branch-a has one card with an API-found photo: Seasats, "U.S. Army photo by Spc. Jacob D. Harrell".
  - Branch-b has two: Skydio X10D (U.S. Air Force) and setaf-gtead (U.S. Army).
  - Main's DVIDS photos come from DVIDS pages its web photo search found, the old path, which the branch keeps.
- **Cost:** $0.88 and $0.96 against $0.76 and $0.68, about $0.20 more a run. Write calls are about half (22 and 30, against 50 and 60).
- **Stopping point:** photo first keeps 8 single stories on this set, plus the ICYMI week. 10 of 18 stays out of reach offline, by construction, as above.
