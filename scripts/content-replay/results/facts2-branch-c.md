# Content pipeline replay: facts2-branch-c

Rules mcu-rules-2026-10-18.2 · head 2895a95 · 2026-10-19T12:11:03.677Z → 2026-10-19T12:20:17.104Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 5 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 2. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 11.
Photo first: on; 7 stories had their photo confirmed before writing, 10 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 1.
**Cost: $0.9262** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the Raid Hunter gun system. #0 and #1 are the official release images, but the pixels show a dark night scene of a drone, explosi |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Candidate 1 is a close side view of the Thunder rotorcraft with |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Only candidate tied to the story. It's an Anduril rendering of a large waterfront shipyard or production facilit |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate shows the PAC-3 Edge interceptor. The photos show F-16s at Arctic Edge, an F-22, a C-130J, and Lockheed Martin buildings. These are unrelated o |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so this place is not supported by the text. | A PLANE THAT / LAUNCHES ITSELF · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | IT FINDS DRONES / AND STRIKES THEM · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor. They are an F-22, C-130s, a cockpit interior and Lockheed Martin buildings, and all of them are related at |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is a promotional graphic with text and only faint shadows of an aircraft, so the interceptor isn't visibl |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | PARAVISION WINS UP TO $6.5M STATE DEAL · The award is for digital identity assurance, and records do not name the products bought. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | SMALL BOATS SPOT / SMUGGLING AT SEA · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (The only candidate is a stock photo of a quadcopter drone flying near a razor-wire fence. It shows no L3Harris Drone Guardian system and none of its sensors |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | **pass** |  | SEE BEFORE BEING / SEEN WITH AI · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of the XTEND drone, with cameras and a protective cage, next to a Drone Dominance Program coin. It |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | Source: Skydio, undated product page (skydio.com/x10d) — The source text gives no URL. The skydio.com/x10d address is not supported by the source. | LAUNCHES IN / UNDER 40 SECONDS · X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | NEW ROCKET MOTOR / SPEEDS LAUNCHES · COYOTE / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#4: the 4:5 crop cuts off the subject) (Candidate 4 is the exact photo named in the story. It shows Sgt. Edlund mounting the line charge system onto the |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. They show an Air Force firefighter portrait, a funeral  |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO for chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 59 | 550902 | 34390 |
| photoPick:anthropic/claude-sonnet-5.5 | 17 | 247119 | 6754 |
| write:anthropic/claude-haiku-5.5 | 34 | 238546 | 25212 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 27820 | 1904 |
