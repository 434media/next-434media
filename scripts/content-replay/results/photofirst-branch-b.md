# Content pipeline replay: photofirst-branch-b

Rules mcu-rules-2026-10-18.2 · head a388c09 · 2026-10-19T03:07:59.563Z → 2026-10-19T03:16:54.083Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 3 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 6; of those unsafe: 3. Held: 12 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 11, writer 1.
Photo first: on; 7 stories had their photo confirmed before writing, 10 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 1.
**Cost: $0.9170** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the Raid Hunter gun system itself. #0 and #1 are CGI-style frames of a drone being engaged, with explosions, a night sky and a  |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft in a close side view that |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate tied to the story: a rendering of the large waterfront shipyard/production facility with numbered bays, cranes and piers. The other candidate |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the PAC-3 Edge interceptor. They show F-16s in snow, YF-12s, an F-22, a C-130J, and Lockheed Martin buildings. Each is either a |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so this location is unsupported. | IT FLIES FAR AND / FAST ON ITS OWN · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | held | writer: Hold: the source does not identify the Navy contract value or delivery quantities, and the Traction line relies on the company's own announcement; post only after the requester confirms the status wording. No replacement subject qualified: replay: research is fixed to the captured story, so  |  | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor system. They show an F-22, C-130Js, and Lockheed Martin buildings. All are related only through the company |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is a promo graphic with text and only faint shadows of an aircraft, so the interceptor isn't visible and  |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | PARAVISION WINS UP TO $6.5M STATE CONTRACT · The award is for digital identity assurance, a category tied to deepfake and liveness tools. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | SOLAR BOATS / WATCH FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (The only candidate is a stock photo of a small quadcopter drone flying beside a razor-wire fence. It shows no L3Harris Drone Guardian system, operator, or m |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source never gives a headquarters or location. Costa Mesa is not mentioned anywhere in it. | AI VISION FLAGS / THREATS EARLY · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of the XTEND drone (cameras, cage frame) with a Drone Dominance Program coin and XTEND logo; it is |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍Redwood City, CA — The source never gives Skydio's headquarters or location. Redwood City is not mentioned anywhere in it.; Private company — The source says nothing about Skydio's ownership or funding status, so it does not support calling it a private company. | FLIES ON WITHOUT / GPS WHEN JAMMED · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | FASTER COYOTE / SHOTS AT DRONES · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the subject sits low, under the text block) (Photo 0 shows a Soldier carrying a small remote-controlled ground vehicle in the Moroccan desert. That  |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows Dr. Christina Smolke, Antheia, or the Office of Strategic Capital loan. The photos show a firefighter, a mine, a CSM portrait,  |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO rad-hard chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 59 | 442526 | 31710 |
| photoPick:anthropic/claude-sonnet-5.5 | 18 | 261662 | 7295 |
| write:anthropic/claude-haiku-5.5 | 25 | 222023 | 14623 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 6 | 25230 | 2099 |
