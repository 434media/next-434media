# Content pipeline replay: photofirst-main-a

Rules mcu-rules-2026-10-18.2 · head 38b94e0 · 2026-10-19T03:00:54.622Z → 2026-10-19T03:07:57.107Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 4 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 7; of those unsafe: 3. Held: 11 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: writer 7, photo 4.
**Cost: $0.5471** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | writer: Source's publication date is August 11, 2026, and the status is an announced system with planned testing, so it is run as a concept; the caption and card keep that status without a testing claim. No replacement subject qualified: replay: research is fixed to the captured story, so no replace |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | writer: Hold: the source is a company product page for Thunder that does not state what Thunder has done. It gives no field test, flight, delivery, customer, or specification data, so the Defense Tech 101 mission brief cannot state a verified traction status or variant. No replacement subject qualif |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | writer: The source is a company announcement that does not give the specific system, its operational status, or the stated mechanism behind any benefit, so it cannot support a verified Defense Tech 101 card; the claims in my draft are not supported by the source text. No replacement subject qualifie |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | writer: Lockheed Martin's headquarters location (Bethesda, MD) is not in the source, so the mission brief cannot be completed as sourced; no city, state or Tech/Platform label beyond the source's description can be verified. Hold until the HQ city and state are confirmed from the source. No replacem |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so this is unsupported by the source.; Private company — The source doesn't say whether Skydio is privately held or publicly traded. | SEES A COUNTY / FROM ONE DOCK · F10 LIGHTRUNNER / SKYDIO | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | STRIKES DRONES / FROM A TRUCK BED · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS X-Rotor airborne high power microwave counter-drone system"): no candidate shows the subject itself (No candidate shows the MORFIUS X-Rotor. The photos show an F-22, C-130s, a cockpit and Lockheed Martin buildings. None of these  | ONE FLIGHT CAN / DOWN 50+ DRONES · MORFIUS X-ROTOR / LOCKHEED MARTIN | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS high-power microwave counter-UAS interceptor"): no candidate shows the subject itself (No candidate shows MORFIUS. #0 is a promo graphic with text and only faint aircraft shadows over empty terrain. The others show an Iranian Kar | IT JAMS DRONE / SWARMS IN FLIGHT · MORFIUS / LOCKHEED MARTIN | round 4 (nemotron): held |
| paravision-state | news | reached, unsafe | cut-off word SEPT | STATE PICKS PARAVISION FOR DIGITAL ID · A five-year contract worth up to $6.5 million was awarded Sept. 23. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | UNCREWED BOATS / WATCH FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | writer: Hold: the source page states no publication date, and the headquarters city was not stated in the source text provided; the supporting article does not give a headquarters location either. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement su |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | held | writer: Hold: the source page gives no publication date and no test, purchase or fielding status, and the company headquarters location is not stated in the source text, so the mission brief cannot be fully verified. No replacement subject qualified: replay: research is fixed to the captured story,  |  | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo was found: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of the XTEND drone, which is the STRIKER, with the Drone Dominance Program coin. It fills the frame and is on topic for the story. The coin and logo are a mi | XTEND GETS $40.5M ORDER FOR STRIKER · XTEND advances to Gauntlet III after ranking as a top performer in Close Quarters Battle. · BUSINESS WIRE | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so this place is not supported by it.; Private company — The source doesn't say whether Skydio is private or public, so this status is not supported by it. | NAVIGATES IN / GPS-DENIED AIR · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | ROCKET MOTOR / SPEEDS EACH SHOT · COYOTE / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | **pass** |  | ARMY TO TEST COUNTER-DRONE GEAR IN AFRICA · Selected systems would reach Soldiers within 180 days, the Army said. · U.S. ARMY | round 6 (haiku): held |
| antheia-osc | breaking | held | writer: Breaking gate and headline checks are unresolved; the source supports a conditional commitment only, and the Breaking freshness evidence is an RSS time and a company release time that cannot be fully verified from the source text alone, so this item is held pending a primary war.gov timestam |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found ("ICYMI cover, 18OCT26"): no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO rad-hard chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone data link | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| write:anthropic/claude-haiku-5.5 | 48 | 427466 | 25846 |
| photoSearch:anthropic/claude-haiku-5.5 | 24 | 213048 | 16198 |
| photoPick:anthropic/claude-sonnet-5.5 | 10 | 121598 | 6548 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 7 | 31953 | 2374 |
