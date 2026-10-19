# Content pipeline replay: review-pf-branch-b

Rules mcu-rules-2026-10-18.2 · head 1aa0f04 · 2026-10-19T03:54:24.736Z → 2026-10-19T04:03:42.881Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 6 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 8; of those unsafe: 2. Held: 10 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 10.
Photo first: on; 8 stories had their photo confirmed before writing, 9 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 2.
**Cost: $0.9609** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates visibly shows the Raid Hunter gun system. #0 and #1 are CGI renders of a drone and explosions over water. They show targets, not the  |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft in a large side view with |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate tied to the story's subject. It is an Anduril-page render of a large numbered-bay waterfront shipbuilding facility, which fits the submarine  |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows a PAC-3 Edge or any PAC-3 interceptor missile. They show F-16s in Alaska, an F-22, a C-130J, and Lockheed Martin buildings. The |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or location, so this location is not supported by the source. | IT GETS EYES ON / A SCENE FASTER · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | HITS DRONES FROM / A PORTABLE KIT · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor. They show other Lockheed Martin aircraft (an F-22 and C-130s), company buildings, and a cockpit interior.  |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS interceptor. #0 is a promo graphic with text, faint shadows and mostly empty space, so the interceptor itself isn't v |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE PICKS PARAVISION FOR DIGITAL ID WORK · A five-year firm-fixed-price contract could reach $6.5 million, with $1.3 million obligated first. · BIOMETRIC UPDA | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | UNCREWED BOATS / COVER OPEN WATER · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the L3Harris Drone Guardian system or a multi-sensor operator display. #0 is a stock photo of a drone at a fence. #1 through #4 |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source never gives a location or headquarters for Anduril. It only calls the company an American defense technology company.; Source: Anduril Industries, 2026. — The source is undated, so the year 2026 is invented. The caption's own line that no published date is stated contra | PUTS BATTLE DATA / IN FRONT OF EYES · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (The photo is a close-up of an XTEND drone with cameras and a cage frame. A Drone Dominance Program challeng |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | **pass** |  | KEEPS FLYING IN / JAMMED AIRSPACE · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | ROCKET MOTOR / SPEEDS LAUNCHES · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | **pass** |  | ARMY TO TEST COUNTER-DRONE TOOLS IN AFRICA · The first accelerated capability event is set for spring 2027 in Morocco. · U.S. ARMY | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. The photos show a firefighter portrait, a funeral at Ar |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO rad-hard unit · Lockheed unveils PAC-3 Edge for Army · Florida Guard tests connected drones | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 59 | 445560 | 30732 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 274195 | 8250 |
| write:anthropic/claude-haiku-5.5 | 30 | 273131 | 16766 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 8 | 34150 | 1305 |
