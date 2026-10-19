# Content pipeline replay: photofirst-branch-a

Rules mcu-rules-2026-10-18.2 · head a388c09 · 2026-10-19T02:51:33.549Z → 2026-10-19T03:00:51.792Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 3 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 5; of those unsafe: 2. Held: 13 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 10, writer 2, limits 1.
Photo first: on; 7 stories had their photo confirmed before writing, 10 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 2.
**Cost: $0.8902** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate visibly shows the Raid Hunter gun system. #0 and #1 are rendered scenes of explosions and a drone over water. The gun is not visible, and #1 ha |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft itself in a large side vi |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Only candidate tied to the story. It's the Anduril release image, a rendering of the large numbered-bay waterfro |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the PAC-3 Edge interceptor. They show F-16s in snow, YF-12s in flight, an F-22, a C-130J, and Lockheed Martin buildings. These  |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | held | writer: Hold: the source does not give Skydio's headquarters city, so the mission brief location line cannot be verified from the source text. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is searched |  | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | PRECISION STRIKE / ON DRONES AT SEA · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor. They are an F-22, C-130s, Lockheed buildings and a cockpit. These are generic Lockheed Martin imagery, not |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is a promotional graphic with only faint shadows and overlaid text, so the interceptor itself isn't visib |  | round 4 (nemotron): held |
| paravision-state | news | held | writer: Not submitted: this draft could not be completed under the rules because the source does not establish the purpose of the award. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is searched |  | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | IT FINDS ILLEGAL / BOATS OFFSHORE · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (The only candidate is a stock photo of a small quadcopter drone flying by a razor-wire fence. It doesn't show the L3Harris Drone Guardian system or an opera |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source never gives Anduril's headquarters or any location. Costa Mesa is not in the text.; IT FLAGS THREATS / BEFORE THEY FIRE — The source says EagleEye detects threats and gives alerts. It never says it flags threats before they fire.; Private company — The source does not s | IT FLAGS THREATS / BEFORE THEY FIRE · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (The photo is a close-up of the XTEND STRIKER drone with cameras and a cage frame. A Drone Dominance Program |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location in San Mateo, CA.; Private company — The source does not say whether Skydio is privately held. | FINDS ITS WAY / HOME WITHOUT GPS · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | QUICKER SECOND / SHOTS AT DRONES · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #2: the 4:5 crop cuts off the subject) (Photo 1 shows a U.S. Army soldier holding a counter-drone system in Moro |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. The photos show a firefighter, a mine, a CSM retirement |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | limits: the copy still breaks the template rules after two rewrites and 3 shortening attempts: Story 2 runs past 1 line (about 38 characters); shorten it: "Lockheed unveils PAC-3 Edge interceptor" is 39 characters and wraps to 2 lines of at most 38; Story 3 runs past 1 line (about 38 characters); sh |  | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 57 | 445128 | 30375 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 270745 | 6995 |
| write:anthropic/claude-haiku-5.5 | 21 | 180512 | 11867 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 5 | 18687 | 1017 |
