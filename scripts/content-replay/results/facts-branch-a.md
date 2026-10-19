# Content pipeline replay: facts-branch-a

Rules mcu-rules-2026-10-18.2 · head d1c13c5 · 2026-10-19T11:42:24.059Z → 2026-10-19T11:52:02.883Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 6 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 1. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 11.
Photo first: on; 7 stories had their photo confirmed before writing, 10 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 2.
**Cost: $0.9797** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate visibly shows the Raid Hunter gun system itself. The two Raid Hunter images are a rendered night scene of explosions and a drone, and #1 adds a |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft in a large side profile w |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate tied to the story. It is the Anduril rendering of a waterfront shipyard or manufacturing facility with numbered bays, which fits the submarin |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows a PAC-3 Edge interceptor or any PAC-3 missile. They show F-16s in Alaska, an F-22, a C-130J, and Lockheed Martin buildings. The |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Only candidate that shows the F10 Lightrunner and MegaDock. It is a render, and the aircraft is small, but the d |  | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | IT STOPS DRONES / AT SEA AND SHORE · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor. They are an F-22, C-130Js and Hercules, and Lockheed Martin buildings, all generic Lockheed Martin imagery |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is a promotional graphic with only faint aircraft shadows and overlaid text, so the interceptor itself is |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE DEPARTMENT BUYS FACE CHECKS · The contract could reach $6.5 million, but records do not name the products. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | PATROLS THE GULF / WITHOUT A CREW · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the L3Harris Drone Guardian system or an operator screen with a correlated sensor picture. #0 is a generic drone at a razor-wir |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | Private company → Backers: not stated in source — The source never says Anduril is a private company. It calls Anduril an American defense technology company and gives no ownership or funding status. | WARFIGHTERS SEE / THREATS SOONER · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of the black XTEND drone with cameras and cage, with a Drone Dominance Program coin in front. It i |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | **pass** |  | FINDS ITS WAY / BACK WITHOUT GPS · X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | IT FIRES FASTER / TO STOP DRONES · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | **pass** |  | ARMY TO TEST COUNTER-DRONE GEAR IN AFRICA · Soldiers would receive tested systems within 180 days under the new partnership. · U.S. ARMY | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. The photos show a firefighter portrait, a funeral at Ar |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found ("ICYMI"): no candidate shows the subject itself (All eight candidates show F-35B Lightning II operations on JS Kaga. None shows anything from the three stories: Microchip/VORAGO rad-hard chips, Lockheed's PAC-3 Edge, or the Florida Guard drone picture. T | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO rad-hard chips · Lockheed unveils PAC-3 Edge entry · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 57 | 430591 | 29155 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 288461 | 7367 |
| write:anthropic/claude-haiku-5.5 | 42 | 311440 | 31853 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 29004 | 1896 |
