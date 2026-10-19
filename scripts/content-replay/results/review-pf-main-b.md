# Content pipeline replay: review-pf-main-b

Rules mcu-rules-2026-10-18.2 · head 38b94e0 · 2026-10-19T04:03:45.191Z → 2026-10-19T04:12:21.604Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 4 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 3. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 9, writer 2.
**Cost: $0.6849** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo was found ("Raid Hunter 50mm gun-based air defense system Northrop Grumman"): no candidate shows the subject itself (None of the candidates shows the Raid Hunter gun system itself. #0 is the press-release render of a one-way attack drone seen from behind with inter | STOPS MASS RAIDS / AT LOWER COST · RAID HUNTER / NORTHROP GRUMMAN | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | writer: Hold: the source is Anduril's Thunder page, but the text provided contains only generic company boilerplate and product-family descriptions. It does not state Thunder's specifications, variant, tech or status (concept, in development, testing or fielded), so no verifiable mission brief can b |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | writer: The source is a company announcement of a $6.6 billion Navy investment to expand the submarine industrial base, but it does not describe a specific Defense Tech 101 technology in enough detail (capability, platform, status or test) to support a mission brief without inventing facts. Only gen |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin PAC-3 interceptor official company media"): no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Candidate 0 is the only photo that shows the PAC-3 Edge interceptor. It is a rendering of the missile in fligh | REACHES HIGHER / THREATS SOONER · PAC-3 EDGE / LOCKHEED MARTIN | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any San Mateo location, so this location is unsupported. | ONE LAUNCH SITE / WATCHES A COUNTY · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | CLOSE-IN STRIKE / ON DRONE THREATS · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS X-Rotor airborne high power microwave counter-drone system"): no candidate shows the subject itself (None of the candidates show the MORFIUS X-Rotor. They show an F-22, C-130s, Lockheed buildings and a cockpit interior, so all ar | IT CAN STOP / A 50-DRONE SWARM · MORFIUS X-ROTOR / LOCKHEED MARTIN | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS counter-UAS high-power microwave interceptor product imagery, public or openly licensed"): no candidate shows the subject itself (None of the candidates clearly shows the MORFIUS interceptor. #0 is a promotional graphic with text | IT HALTS DRONES / WITH MICROWAVES · MORFIUS / LOCKHEED MARTIN | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE WIDENS ID CHECKS · The award is up to $6.5 million through 2031. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | UNCREWED BOATS / GUARD THE GULF · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo was found ("Drone Guardian counter-UAS L3Harris"): no candidate shows the subject itself (None of the candidates shows Drone Guardian or any L3Harris counter-UAS equipment. Candidate 0 is a stock photo of a small quadcopter at a razor-wire fence, which is the threa | IT TRACKS SWARMS / AS ONE PICTURE · DRONE GUARDIAN / L3HARRIS | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | IT SPOTS DRONES AT ONE KILOMETER — The source gives 1 km range for general threat detection with EO and LWIR cameras. It doesn't say drones are detected at 1 km. Drone detection is only mentioned for the microphone array, with no range given.; 📍Costa Mesa, CA — The source never states a location or | IT SPOTS DRONES / AT ONE KILOMETER · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo was found: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of an XTEND drone (caged, dual cameras) with the Drone Dominance Program coin; dominant, dark, recognizable subject tied to the story.); a representative pho | XTEND TO BUILD 6,000 STRIKER DRONES · The $40.5 million order follows a top Gauntlet II finish in close quarters combat. · XTEND | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Francisco, CA — The source never states Skydio's headquarters or location. San Francisco is unsupported, and Skydio is actually based in San Mateo, CA. | STAYS LINKED / WHEN JAMMED · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | FASTER LAUNCHES / TO STOP DRONES · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo was found: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Close, dominant view of a Soldier handling a counter-drone system (Bumblebee) in Morocco during African Lion 26. It is representative of counter-drone tech in Africa, thou | ARMY TO TEST COUNTER-DRONE TECH IN AFRICA · The partnership aims to deliver tested systems to Soldiers within 180 days. · ARMY.MIL | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (no licensed candidates); a representative photo (the people, unit or equipment the story is about) was searched for too, and none was found. No replacement subject qualified: replay: research is fixed to the capture | ANTHEIA GETS CONDITIONAL $80M LOAN OFFER · The Office of Strategic Capital would fund onshoring of critical drug ingredients. · WAR.GOV | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found ("ICYMI cover, 3 published MCU stories, week of Oct. 5, 2026"): no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO chip maker · Lockheed unveils PAC-3 Edge design · Florida Guard tests drone data link | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| write:anthropic/claude-haiku-5.5 | 60 | 528107 | 29399 |
| photoSearch:anthropic/claude-haiku-5.5 | 38 | 390050 | 26279 |
| photoPick:anthropic/claude-sonnet-5.5 | 15 | 140235 | 7451 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 27999 | 2488 |
