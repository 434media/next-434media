# Content pipeline replay: facts-main-a

Rules mcu-rules-2026-10-18.2 · head 2dcdc43 · 2026-10-19T12:20:19.474Z → 2026-10-19T12:28:37.392Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 2 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 6; of those unsafe: 4. Held: 12 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 11, limits 1, format 1.
Photo first: on; 6 stories had their photo confirmed before writing, 11 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 1.
**Cost: $0.9540** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate shows the actual Raid Hunter gun system. #0 and #1 are CGI scenes of explosions and a drone seen from behind. The gun isn't visible, and #1 als |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 is a close, large side view of the Thunder rotorcraft  |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Candidate 0 is the only image that shows the story's subject. It is a rendering of a large shipyard or submarine production facility with numbered bays on a |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows a PAC-3 Edge or any PAC-3 interceptor missile. They show F-16s in Alaska, an F-22, a C-130J, and Lockheed Martin buildings. All |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source doesn't state Skydio's headquarters or location. The instruction allows a headquarters only when the source states it, and this source doesn't. | ONE DOCK COVERS / A WHOLE COUNTY · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | A KIT ON A TRUCK / STRIKES DRONES · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor. They are an F-22, C-130s, a cockpit and Lockheed Martin buildings. All are unrelated to the counter-drone  |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is a promotional graphic with only faint shadows of an aircraft and overlaid text on mostly empty terrain |  | round 4 (nemotron): held |
| paravision-state | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate on topic. It shows a face with a facial-recognition mesh overlay on a screen, which is the story's own article image. It is generic stock, no |  | round 4 (nemotron): held |
| seasats-lightfish | dt101 | reached, unsafe | The work extends an autonomous surveillance effort the company says it supported for federal agencies on the southern border — The source says the deployment expands an existing program under the Office of the Assistant Secretary of War for Homeland Defense and Americas Security Affairs and builds o | BOATS THAT STAY / OUT FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (The only candidate is a stock photo of a quadcopter drone near a razor-wire fence. It doesn't show the L3Harris Drone Guardian system or its operating-pictu |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source never gives a location or headquarters for Anduril, so Costa Mesa, CA is unsupported.; Private company — The source describes Anduril as an American defense technology company. It doesn't say the company is private. | DRONES TASKED / WITH EYES UP · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (The image is a close-up of the XTEND STRIKER drone with its cameras and cage frame. A Drone Dominance Progr |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so this place is not supported by the source text. | KEEPS FLYING / WHEN GPS FAILS · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | QUICKER LAUNCHES / AGAINST DRONES · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the subject sits low, under the text block) (The only candidate shows a soldier in the Moroccan desert carrying a small unmanned ground vehicle. Tha |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. They show a firefighter portrait, a funeral at Arlingto |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | limits, format: the copy still breaks the template rules after two rewrites: Story 2 runs past 1 line (about 38 characters); shorten it: "Lockheed unveils PAC-3 Edge interceptor" is 39 characters and wraps to 2 lines of at most 38; the caption needs its source on a line of its own: "Source: <organiz |  | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 59 | 511153 | 33235 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 252061 | 7439 |
| write:anthropic/claude-haiku-5.5 | 25 | 218604 | 12717 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 6 | 23808 | 1393 |
