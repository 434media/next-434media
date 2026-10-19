# Content pipeline replay: passbar-candidates-2026-10-19-run2

Rules mcu-rules-2026-10-18.2 · head 8626109 · 2026-10-19T01:34:57.015Z → 2026-10-19T01:43:49.517Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 4 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 3. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 7, writer 4.
**Cost: not separable.** This run overlapped another replay (the branch and main ran in parallel), so the Gateway credits used before and after, $1.3451, cover both runs together.

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo was found ("Raid Hunter 50mm gun-based air defense system Northrop Grumman"): no candidate shows the subject itself (None of the candidates visibly shows the Raid Hunter gun system. #0 and #1 are a rendered scene of a drone and explosions at dusk. The gun system is | DOWNS MASS RAIDS / AT LOWER COST · RAID HUNTER / NORTHROP GRUMMAN | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | writer: Hold: the source is a general Anduril company and product-family page with boilerplate and no Thunder specifications, variant details, status, dates or traction, so no Defense Tech 101 card or mission brief can be supported without inventing facts. No replacement subject qualified: replay: r |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | writer: Hold: the source is a company page that describes a $6.6 billion Navy investment to expand the submarine industrial base but gives no system name, variant, status or fielding detail. A Defense Tech 101 card needs a specific system and its status, and neither is in the source text, so no post |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | writer: Hold: the source gives Dallas as the release dateline, not the company's headquarters city, and does not state the headquarters location, so the required 📍 line cannot be supported from the source. Please confirm the headquarters city before this DT101 post runs. No replacement subject qual |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never gives Skydio's headquarters or location, so this location is unsupported.; Private company — The source does not say whether Skydio is privately held, so this ownership status is unsupported. | ONE DOCK WATCHES / AN ENTIRE COUNTY · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | IT TARGETS AND / STRIKES DRONES · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS X-Rotor airborne high power microwave counter-drone system"): no candidate shows the subject itself (None of the candidates shows the MORFIUS X-Rotor. They show an F-22, C-130 aircraft, Lockheed buildings and a cockpit interior.  | ONE LAUNCH COULD / DOWN 50+ DRONES · MORFIUS X-ROTOR / LOCKHEED MARTIN | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS high-power microwave counter-UAS interceptor"): no candidate shows the subject itself (No candidate clearly shows the MORFIUS interceptor. #0 is a promo graphic with only faint shadows and text, no visible vehicle. The others sho | IT STOPS DRONES / WITHOUT MISSILES · MORFIUS / LOCKHEED MARTIN | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | PARAVISION WINS UP TO $6.5M STATE DEAL · The award covers digital identity assurance, with $1.3 million obligated at signing. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | SOLAR BOATS HOLD / WATCH FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo was found ("Drone Guardian counter-UAS L3Harris"): no candidate shows the subject itself (None of the candidates show the L3Harris Drone Guardian system. #0 is a generic quadcopter at a fence, not a counter-UAS system. #1–#7 are MQ-9 Reaper aircraft, which are a di | IT HELPS CUT / NUISANCE ALERTS · DRONE GUARDIAN / L3HARRIS | round 5 (haiku): held |
| anduril-eagleeye | dt101 | held | writer: Hold: the source does not state a publication date, and the company headquarters location is not given in the source text, so the caption's city line cannot be verified from it. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is se |  | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo was found ("XTEND STRIKER drone close quarters battle"): no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (The photo is a close, dark hero shot of an XTEND drone with cameras and a cage frame. A Drone Dominance Program challeng | XTEND SECURES 6,000 STRIKER SYSTEMS · The company says the order follows its Gauntlet II top-performer selection. · BUSINESS WIRE | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA — The source never gives a headquarters or location for Skydio, so this place is not supported.; Private company — The source does not say whether Skydio is privately held or public, so this status is not supported. | NAVIGATES HOME / WITHOUT GPS · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | reached, unsafe | Private company → Backers: Not stated in source. — The source describes Raytheon as an RTX (NYSE: RTX) business, so it is part of a publicly traded company. It is not a private company. | LAUNCHES FASTER / TO STOP DRONES · COYOTE / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | **pass** |  | ARMY TO TEST COUNTER-DRONE TECH IN AFRICA · The effort aims to deliver field-ready systems to Soldiers within 180 days. · U.S. ARMY | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo was found ("Antheia biosynthesis manufacturing facility"): no candidate shows the subject itself (no licensed candidates); a representative photo (the people, unit or equipment the story is about) was searched for too, and none was found. No replacement subject qua | OSC OFFERS ANTHEIA UP TO $80M LOAN · The conditional loan would support Antheia's U.S. drug ingredient manufacturing. · PR NEWSWIRE | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found ("ICYMI roundup cover"): no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO for space chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| write:anthropic/claude-haiku-5.5 | 48 | 421591 | 25912 |
| photoSearch:anthropic/claude-haiku-5.5 | 32 | 377618 | 25009 |
| photoPick:anthropic/claude-sonnet-5.5 | 12 | 149433 | 5754 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 32111 | 1640 |
