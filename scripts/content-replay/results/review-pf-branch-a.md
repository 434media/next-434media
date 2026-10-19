# Content pipeline replay: review-pf-branch-a

Rules mcu-rules-2026-10-18.2 · head 1aa0f04 · 2026-10-19T03:35:42.112Z → 2026-10-19T03:44:36.852Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 2 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 5; of those unsafe: 3. Held: 13 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 9, writer 3, limits 1.
Photo first: on; 8 stories had their photo confirmed before writing, 9 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 1.
**Cost: $0.8843** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate shows the Raid Hunter gun system itself. #0 and #1 are dark CGI frames of a target drone with explosions over water, and #1 is a title graphic. |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft in a large side view with |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Only candidate tied to the story. It's the Anduril release image, a rendering of a large waterfront production f |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#3: the 4:5 crop cuts off the subject) (Only candidate that shows the PAC-3 Edge missile itself: a silver interceptor in flight above clouds. The others |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or location, so this location is unsupported.; Traction: Concept only. — The source doesn't call F10 a concept. It describes a specific aircraft with defined features that is deploying to customers in 2027, and it says sales is taking o | SENDS EYES OVER / A RURAL COUNTY · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | DOWNS DRONES AT / SEA AND ASHORE · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is the only MORFIUS-related image, but it's a marketing banner. It shows only faint aircraft shadows on d |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is a promotional graphic with text and only faint shadows of an aircraft over a desert, water and grass.  |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | PARAVISION WINS UP TO $6.5M STATE CONTRACT · The award covers digital identity assurance, but public records do not name the products bought. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | reached, unsafe | Goal: Detect illegal maritime activity ... across U.S. waters. — The source describes surveillance across the Gulf of America and the southern border, not U.S. waters generally. This overgeneralizes the scope. | SOLAR BOATS HOLD / WATCH FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (The only candidate is a stock photo of a quadcopter drone near a razor-wire fence. It doesn't show the L3Harris Drone Guardian system or a multi-sensor oper |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | held | writer: Hold: the source page gives no publication date and no test, purchase or fielding status, and it does not state the company's headquarters city, so the mission brief cannot be completed from the source alone. No replacement subject qualified: replay: research is fixed to the captured story,  |  | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of an XTEND drone with cameras and cage, plus Drone Dominance Program coin; matches the story and  |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | held | writer: Hold is not required; the card copy is ready. Note: the source page gives no publish date, and the Traction line relies on the Blue UAS Cleared list mention, which is a listing rather than a fielding or delivery claim. No replacement subject qualified: replay: research is fixed to the captur |  | round 6 (haiku): replaced |
| rtx-coyote | dt101 | reached, unsafe | Private company → Backers: Not disclosed in source. — The source describes Raytheon as an RTX (NYSE: RTX) business, so it is part of a publicly traded company. It is not a private company. The source also says the tests were Raytheon-funded. | ROCKET MOTOR / SPEEDS LAUNCH · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | writer: Not held for a single reason to hold; submitted as News for the copy above. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is searched |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. They show a firefighter portrait, a funeral at Arlingto |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | limits: the copy still breaks the template rules after two rewrites and 3 shortening attempts: Story 2 runs past 1 line (about 38 characters); shorten it: "Lockheed unveils PAC-3 Edge interceptor" is 39 characters and wraps to 2 lines of at most 38; Story 3 runs past 1 line (about 38 characters); sh |  | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 55 | 390917 | 28378 |
| photoPick:anthropic/claude-sonnet-5.5 | 17 | 261970 | 8512 |
| write:anthropic/claude-haiku-5.5 | 22 | 195465 | 13210 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 5 | 20688 | 1687 |
