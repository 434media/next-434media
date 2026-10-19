# Content pipeline replay: review-branch-b

Rules mcu-rules-2026-10-18.2 · head 8ace0c5 · 2026-10-19T02:09:11.642Z → 2026-10-19T02:18:55.432Z
Models: research anthropic/claude-haiku-5.5, write anthropic/claude-haiku-5.5, photoSearch anthropic/claude-haiku-5.5, photoPick anthropic/claude-sonnet-5.5, artworkCheck anthropic/claude-sonnet-5.5 · fact check anthropic/claude-sonnet-5.5 · seeds mcu-seeds-2026-10-17.json (0e7a9a32de345d02)

**Score: 4 of 18 pass** (reach Review safe and within limits). Reached the Canva step: 5; of those unsafe: 1. Held: 13 (0 for reasons v9 no longer holds for). Failed: 0. No draft: 0.
Hold reasons: limits 1, format 1, writer 3, photo 9.
**Cost: $0.6738** (Gateway credits, total used before and after).

Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).

| Story | Series | Replay | Why | Card copy | Gate rounds |
|---|---|---|---|---|---|
| raid-hunter | dt101 | held | limits, format: the copy still breaks the template rules after two rewrites: Benefit hook: each line at most 16 characters, counting letters, spaces and punctuation; line 2 "WITH GUIDED ROUNDS" is 18, 2 over; the caption needs its source on a line of its own: "Source: <organization>, <date>" |  | round 3 (nemotron): replaced; round 4 (nemotron): held |
| anduril-thunder | dt101 | held | writer: Hold: the source is Anduril's general company page with site navigation and boilerplate; it does not describe Thunder's capabilities, the variant, test or fielding status, or any figure, so no verified Defense Tech 101 card or mission brief can be written from it. No replacement subject qual |  | round 3 (nemotron): held |
| anduril-submarine | dt101 | held | photo: no relevant, licensed photo was found ("submarine industrial base shipyard Navy"): no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Candidate 0 is a render of the large waterfront submarine production facility. It matches the story's Anduril submarine industr | ANDURIL AND NAVY / TO EXPAND SUBS · SUBMARINE BASE / ANDURIL | round 3 (nemotron): held |
| pac3-edge | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin PAC-3 Edge interceptor"): no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject) (Candidate 0 is the only photo that shows the PAC-3 Edge interceptor. It's a clear, large hero view of the missile in flight abov | DEFENDS HIGHER / AND FARTHER OUT · PAC-3 EDGE / LOCKHEED MARTIN | round 3 (nemotron): replaced; round 4 (nemotron): replaced |
| skydio-f10 | dt101 | held | writer: Hold: source does not state the company headquarters city and state, and the backers or investors are not documented, so the mission brief cannot be completed without guessing. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is sea |  | round 3 (nemotron): held |
| l3harris-navy-vampire | dt101 | **pass** |  | A PORTABLE KIT / TARGETS DRONES · VAMPIRE / L3HARRIS | round 4 (nemotron): in_review |
| morfius-release | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS X-Rotor airborne high power microwave counter-drone system"): no candidate shows the subject itself (None of the candidates show the MORFIUS X-Rotor. They show an F-22, C-130s, a cockpit, and Lockheed Martin buildings. These are  | ONE FLIGHT CAN / DOWN 50+ DRONES · MORFIUS X-ROTOR / LOCKHEED MARTIN | round 4 (nemotron): replaced |
| morfius-product | dt101 | held | photo: no relevant, licensed photo was found ("Lockheed Martin MORFIUS high-power microwave counter-UAS interceptor"): no candidate shows the subject itself (No candidate clearly shows the MORFIUS interceptor. #0 is a Lockheed MORFIUS page graphic, but the pixels show only a desert, water and grass  | IT STOPS SWARMS / WITHOUT MISSILES · MORFIUS / LOCKHEED MARTIN | round 4 (nemotron): held |
| paravision-state | news | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (The only candidate is a Homeland Security logo graphic. It is not Paravision, its products or its people, and it is not a usable photo.); a representative photo (the people, unit or equipment the story is about) was | PARAVISION WINS UP TO $6.5M DEAL · Records do not say which Paravision products were bought. · BIOMETRIC UPDATE | round 4 (nemotron): held |
| seasats-lightfish | dt101 | **pass** |  | SOLAR BOATS HOLD / WATCH FOR MONTHS · LIGHTFISH / SEASATS | round 5 (haiku): held |
| l3harris-drone-guardian | dt101 | held | photo: no relevant, licensed photo was found ("L3Harris Drone Guardian counter-UAS system"): no candidate shows the subject itself (None of the candidates shows the Drone Guardian system or any L3Harris counter-UAS equipment. Candidate 0 shows a small quadcopter drone at a fence, which is a generic  | FEWER ALERTS TO / CHECK BY HAND · DRONE GUARDIAN / L3HARRIS | round 5 (haiku): held |
| anduril-eagleeye | dt101 | reached, unsafe | 📍Costa Mesa, CA — The source never gives a headquarters or location for Anduril, and Costa Mesa is not mentioned.; Private company — The source does not say whether Anduril is private or public. It only calls Anduril an American defense technology company. | WARNING ARRIVES / BEFORE CONTACT · EAGLEEYE / ANDURIL | round 5 (haiku): held |
| xtend-striker | news | held | photo: no relevant, licensed photo was found: no photo of the subject fits the 4:5 card (#0: the cropped photo is under 500 px wide) (Candidate 0 is a close, dramatic view of the XTEND drone with the Drone Dominance Program coin. It's the company's own release image and fits the story. Candidate 1 i | XTEND TO BUILD 6,000 STRIKERS FOR $40.5M · The company says it advances to Gauntlet III after its Gauntlet II result. · BUSINESS WIRE | round 5 (haiku): in_review |
| skydio-x10d | dt101 | **pass** |  | FLIES ON WHEN / GPS IS JAMMED · SKYDIO X10D / SKYDIO | round 6 (haiku): replaced |
| rtx-coyote | dt101 | **pass** |  | A ROCKET MOTOR / SPEEDS EACH SHOT · COYOTE / RAYTHEON | round 6 (haiku): in_review |
| setaf-gtead | news | held | photo: no relevant, licensed photo was found: no photo of the subject fits the 4:5 card (#0: the 4:5 crop cuts off the subject; the subject sits low, under the text block) (Close, dominant view of a counter-drone system (Bumblebee) being explained by a soldier during African Lion 26 in Morocco. It i | ARMY TO TEST COUNTER-DRONE TECH IN AFRICA · Soldiers will test systems in Morocco and aim to field them within 180 days. · ARMY.MIL | round 6 (haiku): held |
| antheia-osc | breaking | held | writer: Hold is not required; the item is marked as Breaking on the source's Oct. 18 timestamps, but the 24-hour window is closing and the photo step must still clear an image. No replacement subject qualified: replay: research is fixed to the captured story, so no replacement subject is searched |  | round 6 (haiku): held |
| icymi-week-2026-10-05 | icymi | held | photo: no relevant, licensed photo was found: no candidate shows the subject itself (no licensed candidates). | TOP DEFENSE DEVELOPMENTS · Microchip buys VORAGO rad-hard chips · Lockheed unveils PAC-3 Edge · Florida Guard tests drone picture | round 3 (nemotron): held; round 4 (nemotron): held; round 5 (haiku): held; round 6 (haiku): held |

## Tokens

| Step : model | Calls | Input | Output |
|---|---|---|---|
| write:anthropic/claude-haiku-5.5 | 57 | 496586 | 30047 |
| photoSearch:anthropic/claude-haiku-5.5 | 34 | 390113 | 27087 |
| photoPick:anthropic/claude-sonnet-5.5 | 14 | 150914 | 7685 |
| write:anthropic/claude-sonnet-5.5 (fact check) | 5 | 18670 | 1826 |
