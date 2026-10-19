# Content pipeline replay: facts3-branch-e

Rules mcu-rules-2026-10-18.2 · head 9937091 · 2026-10-19T12:38:14.719Z → 2026-10-19T12:47:16.252Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 3 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 6; of those unsafe: 3. Held: 12 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 10, limits 2, originality 1, format 1.
Photo first: on; 7 stories had their photo confirmed before writing, 10 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 0.
**Cost: $0.9748** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the Raid Hunter gun system. #0 and #1 are CGI scenes of a drone and explosions, and #1 also has a text overlay. The gun system  |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft in a close side view that |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate tied to the story. It's a rendering of a large waterfront shipyard facility with numbered berths, which fits a submarine industrial base expa |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the PAC-3 Edge interceptor or any PAC-3 missile. They show F-16s at an Arctic Edge exercise, an F-22, a C-130J, and Lockheed Ma |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | **pass** |  | GIVES LEADERS A / LIVE AERIAL VIEW · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | reached, unsafe | Card headline: "IT DOWNS DRONES / NEAR SHIPS" — The source says VAMPIRE was selected for littoral (coastal) C-UxS defense and offers reconnaissance and precision strike against drones. It says nothing about use near ships. It also doesn't say the system has downed drones. | IT DOWNS DRONES / NEAR SHIPS · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates show the MORFIUS X-Rotor. They show an F-22, C-130 transports, a cockpit and Lockheed Martin buildings. All are generic Lockheed Mart |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS interceptor. #0 is a promotional graphic with text, empty haze and only faint shadows of an aircraft, so the product  |  | round 4 (nemotron): held |
| paravision-state | news | held | limits, originality, format: the copy still breaks the template rules after two rewrites: Headline runs past 3 lines (about 45 characters); shorten it: "STATE DEPT. AWARDS PARAVISION UP TO $6.5M" is 41 characters and wraps to 4 lines of at most 15; the headline copies 5 words in a row from the sourc |  | round 4 (nemotron): held |
| seasats-lightfish | dt101 | reached, unsafe | Mike Flanigan, CEO of Seasats, has said the company has over $100 million in U.S. government contracts. — The $100 million figure comes from the unattributed 'About Seasats' boilerplate. Flanigan's quote in the source says nothing about contracts, so the caption wrongly attributes the claim to him. | IT DETECTS DRUG / RUNNERS AT SEA · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate shows the Drone Guardian operator console or a multi-sensor radar/RF/EO-IR picture. They show a generic drone at a fence, a briefing with a han |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | The ballistic shell is rated NIJ IIIA Level. — The source says "NIJ IIA Level Ballistic Shell", not IIIA. | WARFIGHTERS SEE / THREATS FIRST · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of the XTEND drone, with cameras and a protective cage, next to a Drone Dominance Program challeng |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | **pass** |  | FLIES WITHOUT A / CLOUD CONNECTION · X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | NEW MOTOR SPEEDS / COYOTE LAUNCHES · COYOTE / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the subject sits low, under the text block · #2: the subject sits low, under the text block) (Photos 1 and 2 are the same shot, with captions that t |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. They show a firefighter portrait, a funeral at Arlingto |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | limits: the copy still breaks the template rules after two rewrites and 3 shortening attempts: Story 2 runs past 1 line (about 38 characters); shorten it: "Lockheed unveils PAC-3 Edge interceptor" is 39 characters and wraps to 2 lines of at most 38; Story 3 runs past 1 line (about 38 characters); sh |  | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 57 | 426283 | 30006 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 279148 | 7983 |
| write:anthropic/claude-haiku-5.5 | 42 | 309655 | 28224 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 6 | 23833 | 2442 |
