# Content pipeline replay: review-main-b

Rules mcu-rules-2026-10-18.2 · head be3d23c · 2026-10-19T02:18:56.883Z → 2026-10-19T02:27:47.474Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 3 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 4. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 8, limits 1, writer 2.
**Cost: $0.7199** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo was found ("Raid Hunter 50mm gun-based air defense system"): no candidate shows the subject itself (No candidate clearly shows the Raid Hunter system. #0 and #1 are the official release imagery, but the pixels show a render of a drone from behind with explosions ov | GUIDED ROUNDS / STOP MASS RAIDS · RAID HUNTER / NORTHROP GRUMMAN | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo was found ("Anduril Thunder autonomous attack rotorcraft"): no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Candidate 1 is a close side view of the Thunder rotorcraft. It shows the  | ROTORCRAFT THAT / STRIKES UNCREWED · THUNDER / ANDURIL | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo was found ("Anduril submarine industrial base Navy investment"): no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Candidate 0 is the only photo that shows the subject: a rendering of the Anduril submarine industrial base facility.  | BUILDS SUBMARINE / PARTS AT SCALE · SUBMARINE BASE / ANDURIL | round 3 (nemotron): held |
| pac3-edge | dt101 | held | limits: the copy still breaks the template rules after two rewrites and 3 shortening attempts: Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 2 "AND MISSILE THREATS" is 19, 3 over |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so this place is unsupported.; Private company — The source does not say whether Skydio is privately held or publicly held, so this status is unsupported. | CUTS RURAL WAITS / FOR SCENES · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | KILLS DRONES AT / SEA WITH A SHOT · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | writer: Hold: the source gives no headquarters location and is not verifiable for the 📍 line, and the image is not yet cleared; the hook and subject are ready if the HQ location is confirmed from a company source. No replacement subject qualified: replay: research is fixed to the captured story, so |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS counter-UAS interceptor"): no candidate shows the subject itself (Candidate 1 is a clean render of an orange interceptor-style drone with a black nose, centered against sky and mountains. It is the only candidate that plausibly s | IT DOWNS DRONE / SWARMS, NO AMMO · MORFIUS / LOCKHEED MARTIN | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE TO PAY PARAVISION UP TO $6.5M · A five-year deal could reach $6.5 million for digital identity tools. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | held | writer: Hold: the source does not state a deployment date beyond the release date, and the fielding claim is a company and government announcement; the copy is supportable, so this hold is only a placeholder-free note that no hold is required. No replacement subject qualified: replay: research is fi |  | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo was found ("Drone Guardian counter-UAS L3Harris"): no candidate shows the subject itself (None of the candidates shows the L3Harris Drone Guardian system. Candidate 0 is a stock photo of a small quadcopter at a razor-wire fence. It is a generic scene, not the produ | IT CORRELATES / RADAR AND RF · DRONE GUARDIAN / L3HARRIS | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source never gives a location or headquarters for Anduril or EagleEye.; Private company — The source doesn't say whether Anduril is private or public. | SEE THREATS / FIRST, THEN ACT · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo was found ("XTEND STRIKER drone"): no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close, dramatic shot of a dark caged drone with cameras and a Drone Dominance Program coin, with XTEND branding. It is the story's press image | XTEND LANDS 6,000 STRIKER DRONE ORDER · The $40.5 million award follows a top Gauntlet II result in Close Quarters Battle. · BUSINESS WIRE | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or location, so this is not supported by the text.; Private company — The source does not say whether Skydio is privately held. The ownership status is not supported by the text. | FLIES ON WHEN / GPS IS JAMMED · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | reached, unsafe | Private company → Backers: Not stated in source. — The source does not describe Raytheon as a private company. It says Raytheon is a business of RTX, which is publicly traded (NYSE: RTX). The caption contradicts itself by also noting the NYSE listing. | FASTER SHOTS / AT DRONE THREATS · COYOTE BLOCK 2C+RM / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | **pass** |  | ARMY TO TEST COUNTER-DRONE TECH IN AFRICA · Soldiers will test emerging systems in Morocco before fielding them within 180 days. · U.S. ARMY | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo was found ("Antheia biosynthesis manufacturing facility, official company or public-domain U.S. government imagery"): no candidate shows the subject itself (no licensed candidates); a representative photo (the people, unit or equipment the story is about) was searc | PENTAGON OFFERS $80M LOAN FOR DRUG INGREDIENTS · The conditional loan would help Antheia build U.S. production. · PR NEWSWIRE | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found ("ICYMI cover"): no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO rad-hard chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| write:anthropic/claude-haiku-5.5 | 55 | 484909 | 26898 |
| photoSearch:anthropic/claude-haiku-5.5 | 36 | 378373 | 27843 |
| photoPick:anthropic/claude-sonnet-5.5 | 14 | 169275 | 5794 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 28127 | 2572 |
