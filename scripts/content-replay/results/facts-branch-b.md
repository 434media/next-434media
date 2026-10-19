# Content pipeline replay: facts-branch-b

Rules mcu-rules-2026-10-18.2 · head d1c13c5 · 2026-10-19T11:52:05.332Z → 2026-10-19T12:01:54.693Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 2 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 3; of those unsafe: 1. Held: 15 (1 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 11, writer 2, originality 1, limits 1.
Photo first: on; 6 stories had their photo confirmed before writing, 11 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 1.
**Cost: $0.9922** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the Raid Hunter gun system. #0 and #1 are the release's CGI scene: a one-way attack drone seen from behind, with explosions ove |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft's fuselage, tilted rotor  |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate tied to the story. It's a rendering of the Anduril shipyard facility with numbered bays and piers on the water, which fits the submarine indu |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#4: the 4:5 crop cuts off the subject) (Candidate 4 is the only photo that visibly shows the PAC-3 Edge interceptor. It is a large, clear render of the  |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Only candidate 0 clearly shows the F10 Lightrunner fixed-wing aircraft together with the MegaDock. The aircraft  |  | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | held | writer: The Navy selection and delivery is a source-stated selection to deliver; no deliveries to the Navy are stated, so Traction is limited to the selection. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is searched |  | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates show the MORFIUS X-Rotor. They are an F-22, C-130s, a cockpit interior and Lockheed buildings. These are generic Lockheed Martin imag |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate visibly shows the MORFIUS interceptor. #0 is a promo graphic with only faint shadows of an aircraft and overlaid text, so the subject isn't rec |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE DEPARTMENT BUYS PARAVISION TECH · A small-business deal could reach $6.5 million through 2031. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | held | originality: the copy still breaks the template rules after two rewrites and 3 rewording attempts: the caption copies 13 words in a row from the source ("modular payload bay has carried electro-optical and infrared cameras signals payloads and sonar"): write it fresh, and quote only in quotation mar |  | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the L3Harris Drone Guardian system. #0 is a generic stock drone at a fence. The others show Marines with satellite terminals an |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | held | writer: Hold: the source page gives no publication date, and the Tech 101 card cannot be verified as current without it; the headquarters location and Traction status are also not stated in the facts. No replacement subject qualified: replay: research is fixed to the captured story, so no replacemen |  | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of the XTEND drone with cameras and cage, with the Drone Dominance Program coin. It is dramatic an |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | **pass** |  | FINDS ITS WAY / BACK WITHOUT GPS · X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | reached, unsafe | Raytheon's Tom Laliberty, president of Land & Air Defense Systems, framed the tests as support for an urgent joint U.S. military mission against changing drone threats. — The source attributes the urgent joint U.S. military mission language to the press release narrative, not to Laliberty. His quote | A ROCKET MOTOR / SPEEDS EACH SHOT · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Both photos show a Bumblebee counter-drone system at African Lion 26 in Morocco. That is a related counter-UAS t |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke or Antheia. They show a firefighter portrait, a funeral at Arlington, a Mars rover concept and a kids' sci |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | limits: the copy still breaks the template rules after two rewrites and 3 shortening attempts: Story 2 runs past 1 line (about 38 characters); shorten it: "Lockheed unveils PAC-3 Edge interceptor" is 39 characters and wraps to 2 lines of at most 38 |  | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 57 | 508093 | 32541 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 277056 | 8045 |
| write:anthropic/claude-haiku-5.5 | 38 | 279029 | 27604 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 3 | 11730 | 954 |
