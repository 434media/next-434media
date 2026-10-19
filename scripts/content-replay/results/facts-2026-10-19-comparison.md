# Replay: fact extraction before writing (plan v10, step d), branch vs main (2026-10-19)

All runs one after another on one shared cache: a copy of the photo-first review's cache (#209), with DVIDS through the API and photo first on. Same set, rules `mcu-rules-2026-10-18.2` and seeds (sha `0e7a9a32de345d02`) as before. Main is `2dcdc43`.

The branch changed twice during the runs, each time after a run showed a gap, so its runs are on three heads. **The scored pair is the final head, `9937091`** (branch-d, branch-e) against main's two runs.

| Run (in order) | Engine | Pass | Photo first kept | Pass among kept | Invented place or ownership | Other fact errors | Writer holds | Cost | Write calls |
|---|---|---|---|---|---|---|---|---|---|
| facts-branch-a | `d1c13c5` | 6 | 7 | 6 | 1 ("Private company → Backers: not stated in source") | 0 | 0 | $0.9797 | 42 |
| facts-branch-b | `d1c13c5` | 2 | 6 | 2 | 0 | 1 | 2 (no headquarters among the facts) | $0.9922 | 38 |
| facts-main-b | main | 2 | 6 | 2 | 1 (📍San Mateo, CA) | 1 | 2 (no headquarters in the source) | $0.8631 | 25 |
| facts2-branch-c | `2895a95` | 5 | 7 | 5 | 1 (📍San Mateo, CA, with 28 sourced facts) | 1 | 0 | $0.9262 | 34 |
| facts-main-a | main | 2 | 6 | 2 | 3 (📍San Mateo ×2, 📍Costa Mesa + "Private company") | 1 | 0 | $0.9540 | 25 |
| **facts2-branch-d** | **`9937091`** | **2** | 7 | 2 | **0** | 3 | 1 ("unused") | $0.8922 | 45 |
| **facts3-branch-e** | **`9937091`** | **3** | 7 | 3 | **0** | 3 | 0 | $0.9748 | 42 |

Write calls include one fact extraction per written story on the branch; the scorer's fact check is not counted there but is in the cost.

**Scores on the final head:** branch 2 and 3 (mean 2.5); main 2 and 2 (mean 2.0). Inside the ±2 noise of this set.

**What fact extraction fixed:** the invented mission-brief lines. On the final head, no card in either run carries a place, headquarters or ownership the source doesn't state. Main carried one on 3 cards and 1 card, and its writer held 2 stories in main-b because no headquarters was stated.

**How it got there:**
- `d1c13c5`: facts first, writer from the facts. Run a passed 6 of the 7 kept stories. Run b showed the writer *holding* when a brief line had no fact, and run a showed a line filled with "not stated in source".
- `2895a95`: a missing line is left out, never a hold or a placeholder (prompt, and a code check on placeholder lines). Run c passed 5 of 7, but Skydio F10 still got "📍San Mateo, CA" from the writer's own knowledge, with 28 sourced facts in hand.
- `9937091`: on copy written from facts, a "City, ST" place or a private or public company claim that the source doesn't state is a safety problem, like an unsourced figure, so the rewrites remove it.

**What still loses among the kept stories (final head):** ordinary accuracy slips that the fact check catches, not filled-in lines.
- Attribution: a quote given to "company president" when the source names a division president (VAMPIRE); a company boilerplate figure put in the CEO's mouth (Seasats).
- A spec misread: "NIJ IIIA" for the source's "NIJ IIA" (EagleEye).
- A headline wider than the source ("near ships" for "littoral").
- A source line carrying a page address (`anduril.com/eagleeye`), which the scorer reads as unsupported though it is the story's own URL.
- One writer hold of "unused" (X10D, run d): model chatter that `meaningful()` doesn't yet read as no hold.
- Seasats and Paravision: originality holds (13 and 17 copied words) in some runs.

**Cost:** about the same as main: $0.89 and $0.97 against $0.95 and $0.86. The extraction call adds roughly 7 Haiku calls a run; photo first's skips keep the total down.

**Against the stopping point the coordinator proposed (about 6 of 7 photo-kept stories reaching Review safe):** not reached offline. The final head passes 2 and 3 of 7. The defect this step targets is gone; the losses left are the writer's accuracy on attribution and specs, which a live round will show alongside photo supply.
