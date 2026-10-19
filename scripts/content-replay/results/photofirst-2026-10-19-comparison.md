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
