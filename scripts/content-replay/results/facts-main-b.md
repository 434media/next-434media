# Content pipeline replay: facts-main-b

Rules mcu-rules-2026-10-18.2 · head 2dcdc43 · 2026-10-19T12:01:57.419Z → 2026-10-19T12:11:00.181Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 2 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 4; of those unsafe: 2. Held: 14 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: photo 12, writer 2.
Photo first: on; 6 stories had their photo confirmed before writing, 11 were skipped for want of one (production would try its next story; the replay can't). DVIDS API: on; cards with a DVIDS photo: 1.
**Cost: $0.8631** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (None of the candidates shows the Raid Hunter gun system. #0 and #1 are a CGI night scene of a drone being intercepted, with explosions and HUD overlays, and |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#1: the 4:5 crop cuts off the subject · #0: the subject sits low, under the text block) (Photo #1 shows the Thunder rotorcraft fuselage in a close side  |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (Only candidate that fits the submarine industrial base story. It is a render of a large waterfront shipyard or production facility with numbered bays and pi |  | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#4: the 4:5 crop cuts off the subject) (Candidate 4 is the only image that shows the PAC-3 Edge interceptor. It's a rendering of the missile in flight w |  | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Candidate 0 is a render of the F10 Lightrunner flying above a Skydio dock. It is the only image that clearly sho |  | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | reached, unsafe | fact check failed: Unexpected non-whitespace character after JSON at position 2 | IT HUNTS DRONES / FROM A TRUCK BED · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate shows the MORFIUS X-Rotor. They are an F-22, C-130Js, a cockpit and Lockheed Martin buildings, and none is the counter-drone microwave system.) |  | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (No candidate clearly shows the MORFIUS X-Rotor. Candidate 0 is a promotional graphic. It has only faint aircraft shadows on desert, water and grass, with ov |  | round 4 (nemotron): held |
| paravision-state | news | **pass** |  | STATE PICKS PARAVISION FOR UP TO $6.5M · The five-year contract covers digital identity assurance, per federal records. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | UNCREWED BOATS / WATCH THE GULF · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (The only candidate is a stock photo of a quadcopter drone flying near a razor-wire fence. It doesn't show the L3Harris Drone Guardian system or its operatin |  | round 5 (haiku): held |
| anduril-eagleeye | dt101 | held | writer: Hold: the source is an unscoped product page with no publish date and no fielding or test status for EagleEye, and the headquarters location is not stated in the source, so the Traction and location lines cannot be verified from the text provided. No replacement subject qualified: replay: re |  | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Close-up of a dark XTEND drone with cameras and cage, plus a Drone Dominance Program challenge coin. It's a |  | round 5 (haiku): in_review |
| skydio-x10d | dt101 | reached, unsafe | 📍San Mateo, CA — The source never states Skydio's headquarters or any location, so San Mateo, CA is not supported by it. | LANDS BACK HOME / ON VISION ALONE · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | held | writer: Hold: the source does not state the company headquarters city on the card text beyond the RTX release dateline context, and the Coyote Block 2C+RM traction status is a developmental test result only. No replacement subject qualified: replay: research is fixed to the captured story, so no rep |  | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no photo of the subject fits the 4:5 card (#2: the 4:5 crop cuts off the subject · #1: the 4:5 crop cuts off the subject · #0: the 4:5 crop cuts off the subject) (Close, dominant soldier holding  |  | round 6 (haiku): held |
| antheia-osc | breaking | held | photo: no relevant, licensed photo of the subject was found before writing, so the next story was tried: no candidate shows the subject itself (no licensed candidates); a representative photo was searched for too, and none was found |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO for chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| photoSearch:anthropic/claude-haiku-5.5 | 59 | 431377 | 29928 |
| photoPick:anthropic/claude-sonnet-5.5 | 17 | 250427 | 7844 |
| write:anthropic/claude-haiku-5.5 | 25 | 220130 | 13115 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 4 | 18153 | 1507 |
