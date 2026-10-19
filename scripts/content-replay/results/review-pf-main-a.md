# Content pipeline replay: review-pf-main-a

Rules mcu-rules-2026-10-18.2 · head 38b94e0 · 2026-10-19T03:44:39.150Z → 2026-10-19T03:54:21.417Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 4 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 3. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 8, writer 2, limits 1.
**Cost: $0.7643** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo was found ("Raid Hunter 50mm gun-based air defense system Northrop Grumman"): no candidate shows the subject itself (No candidate visibly shows the Raid Hunter gun system. #0 and #1 are a rendered night scene of a one-way attack drone with explosions and HUD overla | STOPS MASSED / DRONE SWARMS · RAID HUNTER / NORTHROP GRUMMAN | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | writer: Hold: the source is a company product page for Thunder that gives no specific variant, test, delivery or fielding status, so the Traction line and the mission brief cannot be supported from the text provided, and the Thunder name alone does not establish a verifiable Defense Tech 101 claim.  |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo was found ("Anduril undersea autonomous vehicle submarine industrial base"): no candidate shows the subject itself (Candidate 0 is the only photo tied to the story. It shows a rendering of the large Anduril shipyard or production facility, which fits the submarine  | WIDENS SUBMARINE / SUPPLY CHAIN · UNDERSEA / ANDURIL | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin PAC-3 interceptor"): no candidate shows the subject itself (None of the candidates clearly shows the PAC-3 Edge interceptor. Candidates 0, 4, 5 and 6 show Patriot launchers, which are related but not the Edge. Candidate 1 is concept art  | DOWNS HYPERSONIC / THREATS FARTHER · PAC-3 EDGE / LOCKHEED MARTIN | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | held | writer: Hold: the source does not give the company's headquarters city, so the 📍 location line cannot be verified; headquarters must be confirmed before this brief can run. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is searched |  | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | PRECISION STRIKE / AGAINST DRONES · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS X-Rotor counter-drone system"): no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. #0 is the only MORFIUS-related image, but it is a promotional graphic. It has only faint aircraft shadows on d | ONE FLIGHT CAN / DOWN 50+ DRONES · MORFIUS X-ROTOR / LOCKHEED MARTIN | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS counter-UAS high-power microwave interceptor product image"): no candidate shows the subject itself (No candidate visibly shows the MORFIUS interceptor. #0 is a promotional banner with text and only faint aircraft shadows, so the | IT STOPS DRONES / IN SWARM ATTACKS · MORFIUS / LOCKHEED MARTIN | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE TO SPEND UP TO $6.5M ON IDENTITY CHECKS · The award to Paravision runs through September 2031. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | SOLAR POWERED / WATCH FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo was found ("Drone Guardian counter-UAS L3Harris"): no candidate shows the subject itself (None of the candidates shows the L3Harris Drone Guardian system. Photo 0 shows a small quadcopter drone at a fence, which is a generic drone and not the counter-UAS product. P | IT CUTS FALSE / ALARMS FOR TEAMS · DRONE GUARDIAN / L3HARRIS | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source does not give a location or headquarters for Anduril. Costa Mesa is invented. | IT CALLS FIRES / WITH EYES UP · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo was found ("XTEND STRIKER drone close quarters battle"): no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject; the cropped photo is under 500 px wide) (Close dark shot of an XTEND drone (cameras, cage) with a Drone Dominance Program chal | XTEND SECURES 6,000 STRIKER SYSTEMS ORDER · The $40.5 million award follows a Gauntlet II result in the Close Quarters Battle segment. · XTEND | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA (Skydio headquarters location) — The source never gives a headquarters or any location for Skydio. The caption also implies the page states it, which it doesn't.; Private company — The source says nothing about Skydio's ownership or funding status, so calling it a private company is  | FINDS ITS WAY / HOME WITHOUT GPS · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | reached, unsafe | The upgrade integrates a rocket motor, a new seeker and a new warhead. — The source says the effort only "intends to integrate" a rocket motor, new seeker and warhead. The tests confirmed first launches with a rocket motor and initial integration with the counter-drone architecture. They did not sho | QUICKER LAUNCHES / AGAINST DRONES · COYOTE / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | **pass** |  | ARMY TO TEST COUNTER-DRONE TECH IN AFRICA · The partnership aims to deliver tested systems to Soldiers within 180 days. · U.S. ARMY | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo was found ("Antheia pharmaceutical biosynthesis manufacturing facility"): no candidate shows the subject itself (no licensed candidates); a representative photo (the people, unit or equipment the story is about) was searched for too, and none was found. No replacem | OSC OFFERS ANTHEIA UP TO $80M LOAN · The conditional loan would support Antheia's U.S. plan to onshore critical drug ingredients. · PR NEWSWIRE | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | limits: the copy still breaks the template rules after two rewrites and 3 shortening attempts: Story 2 runs past 1 line (about 38 characters); shorten it: "Lockheed unveils PAC-3 Edge interceptor" is 39 characters and wraps to 2 lines of at most 38 |  | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| write:anthropic/claude-haiku-5.5 | 50 | 427100 | 26008 |
| photoSearch:anthropic/claude-haiku-5.5 | 36 | 557098 | 30661 |
| photoPick:anthropic/claude-sonnet-5.5 | 15 | 158393 | 6541 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 28456 | 1972 |
