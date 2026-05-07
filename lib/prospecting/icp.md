# 434 Media Ideal Customer Profile (ICP)

System context for the Leads-page prospecting feature. Concatenated into LLM
prompts that translate rep search queries into Apollo (or equivalent) filters
and score candidate matches against 434media's actual customer base.

Also serves as the team's working definition of "who we sell to" — review and
amend as the business evolves. Living document.

**Last reviewed:** 2026-05-06
**Status:** Signed off by sales / BD team 2026-05-06
**Source of truth:** [/work](https://www.434media.com/work) portfolio; sales team validation

---

## What 434media sells

The core differentiator is **owned audiences + activation**, not generic
marketing services. We earn business by giving brands access to specific
communities we built and operate, plus by producing storytelling for the
founders, programs, and institutions building Texas's cultural, health, and
tech ecosystems.

### Owned audiences and brand properties

| Property | Audience | Natural sponsor verticals |
|---|---|---|
| **TXMX Boxing** | Latino sports fans, fight culture, men's lifestyle (Texas + Mexico) | Sports gear, beverages, automotive, men's lifestyle, fight nutrition |
| **Digital Canvas** (with DEVSA) | Texas tech / dev community, AI builders, startup operators | Developer tools, B2B SaaS, AI products, recruiting platforms, edtech, cloud providers |
| **Vemos Vamos** | US Hispanic, bilingual Spanish/English audiences | Bilingual CPG, financial services for Hispanic markets, healthcare systems, civic orgs |
| **Univision partnerships** | National Spanish-language broadcast | National brands targeting Hispanic audiences |
| **AIM / VelocityTX / Health Cell events** | Texas health, biotech, military-medical ecosystem | Medical devices, life-science suppliers, pharma services, academic research |
| **Vanita Leo / cumbia / music IP** | Latino music + cultural fans | Apparel, beverage, festivals, music tech, Latin entertainment platforms |

### Service categories

- **Sponsorship activation** — selling access to the owned audiences above
- **Brand storytelling** — video, documentary, integrated campaign work
- **Event production** — conferences, summits, accelerator demo days
- **Bilingual / Spanish-language media campaigns**
- **Cohort storytelling** — for VCs, accelerators, programs amplifying their portfolios
- **Original IP development** — building owned brands (TXMX, Vemos Vamos, etc.)

What we explicitly **do not** sell:

- Generic SEO / paid-media services (no impression-buying agency work)
- Pure deliverable production without strategic context (no "make me a video" vendor work)
- Enterprise B2B marketing automation
- Performance marketing / direct response

---

## Buyer archetypes

We sell to four distinct buyer types. Each has different titles, budgets, and
timing. The prospecting feature should be able to score against all four.

### 1. Sponsor-buyers

Brands that buy audience access and sponsorship slots in our owned channels.

- **Examples:** brands sponsoring TXMX events, Univision concert partnerships, sponsors at AIM Health Summit
- **Titles:** CMO, VP Marketing, Brand Director, Sponsorship Manager, Head of Partnerships
- **Budget source:** marketing / partnerships / brand budget
- **Timing triggers:** campaign calendar alignment, fiscal year planning, product launches, expansion-into-Texas moments

### 2. Storytelling clients

Founders, programs, and institutions that need video, documentary, or brand work.

- **Examples:** Alt-Bionics (prosthetics startup), Vanita Leo (artist), Mission Road Ministries (nonprofit), Methodist Healthcare Ministries
- **Titles:** Founder/CEO (small orgs), Communications Director (institutional), Marketing Director (mid)
- **Budget source:** brand budget, founder discretionary spend, institutional comms, grant-funded campaigns
- **Timing triggers:** funding rounds, product/program milestones, public-moment opportunities, anniversary years

### 3. Event partners

Organizations running events that need production, promotion, or audience-building support.

- **Examples:** AIM Health R&D Summit, The Health Cell convenings, Tech Bloc events, VelocityTX programs
- **Titles:** Executive Director, Program Director, Director of Events, Founder/CEO
- **Budget source:** event budget, program budget, sometimes sponsorship-revenue-funded
- **Timing triggers:** 3–6 months before event date, annual event cycles

### 4. Ecosystem amplifiers

VCs, accelerators, and angel networks that buy cohort or portfolio storytelling.

- **Examples:** Builders VC, Alamo Angels, Nucleate Texas, VelocityTX
- **Titles:** Partner, Portfolio Marketing lead, Director of Storytelling, Program Director, Managing Partner
- **Budget source:** portfolio support, fund operations, LP-relations budget
- **Timing triggers:** cohort cycles, fund close events, portfolio-milestone moments

---

## Geography

Priority order:

1. **South Texas / San Antonio** — relationship depth, owned audiences strongest here
2. **Texas–Mexico border markets** — TXMX, bilingual reach, Latino cultural fluency
3. **Greater Texas** — Austin, Houston, Dallas, RGV
4. **National brands targeting US Hispanic / Latino audiences** — even if HQ is outside Texas
5. **Companies expanding into Texas** — strong "now is the moment" signal (recent press, hiring, office openings)

Not a priority unless there's a Texas or Hispanic angle: California, New York, generic East Coast B2B.

**Hard exclusion — EU member states (incl. UK + EEA + Switzerland) and Canada.** 434media does not pursue cold outbound to these jurisdictions due to strict consent laws (GDPR / CASL). Even a fit candidate in these regions is non-approvable. Enforced in `lib/prospecting/scorer.ts` (score = -1) and double-checked at the approval endpoint.

---

## Industries (positive signals)

- **Healthcare & life sciences** — hospitals, biotech, medtech, digital health, public health, military-medical research
- **Sports, fitness, lifestyle brands** — especially Latino-targeted
- **Tech & SaaS** — developer tools, AI products, edtech, recruiting platforms
- **Capital** — VC firms, angel networks, accelerators, family offices
- **Media & broadcast** — especially bilingual / Spanish-language
- **Education & workforce development** — institutions, training programs, technical education
- **Nonprofits & mission-driven orgs** — impact, civic, social-determinants
- **CPG / consumer brands** — with Hispanic audience focus
- **Civic-tech and economic-development orgs**

---

## Decision-maker titles

In rough priority order:

1. **Founders / Co-Founders** — especially early-stage; one person makes the call
2. **CEOs / Presidents** — small orgs, institutional leadership for larger
3. **CMOs / VP Marketing / Brand Directors**
4. **Heads of Partnerships / Sponsorships / BD**
5. **Communications / Community / Social Impact Directors** — institutional, nonprofit
6. **Portfolio Marketing leads** — VC firms, accelerators
7. **Sponsorship Managers** — specific role at sports, events, cultural orgs
8. **Executive / Program Directors** — at events, accelerators, programs

---

## Company size

Size is a fit signal, not a hard filter. Different ranges by buyer type:

- **For-profit growth-stage:** 10–500 employees (sweet spot)
- **Institutional** (nonprofit, broadcaster, healthcare system, university): no upper cap if Texas-relevant and mission-aligned
- **Early-stage startups:** 5+ employees if founder-led with a funding signal

---

## Growth / timing signals (intent boosts)

Score-lifters when surfaced alongside fit. These are the moments when buying conversations happen:

- Recent funding round (Series A+ for startups; fund close for VCs)
- New leadership appointment — especially CMO, Head of Brand, Head of Partnerships
- Expansion into Texas / new Texas office announced
- New program, cohort, or initiative launched
- Press coverage spike, industry awards, public milestone moments
- Recently launched product or brand refresh
- Hiring spike (signals scaling motion)

---

## Negative filters (always exclude)

- **Marketing agencies, PR firms, advertising firms** — competitors, not customers
- **EU and Canadian contacts** — 434media does not pursue cold outbound there (GDPR / CASL). Hard-excluded regardless of fit; see Geography section above.
- **Pure D2C** without a Texas or Hispanic angle
- **Enterprise IT / SaaS** without a community or ecosystem dimension
- **Generic "brand awareness" buyers** — we sell activation, not impressions
- **Companies whose audience or product has no overlap with our owned audiences** — score-zero fit

---

## Output expectations

When the LLM surfaces candidates, the high-value matches are companies + decision-makers likely to invest in:

- Sponsorship of 434media events or owned brands
- Co-produced content or branded storytelling
- Audience access through Univision / Vemos Vamos / Digital Canvas / TXMX channels
- Multi-channel campaigns targeting Texas or Hispanic markets
- Cohort / portfolio storytelling (for capital firms and accelerators)

NOT generic marketing services, vendor-style work, or commodity media buys.

---

## Scoring posture (for the prospecting feature)

Prompted leads enter the system with **fit-only** scores. They have zero intent
signals — they don't know 434media exists yet. The scoring breakdown:

- **Fit dimensions** (sum 0–80 before any intent applies):
  - Geography (Texas / border / Hispanic-targeted national)
  - Industry match (one of the positive-signal verticals above)
  - Title match (decision-maker tier)
  - Size band match (per buyer-type rules)
  - Growth-signal presence (funding, expansion, new leadership, etc.)
- **Intent dimensions** (added later as engagement signals arrive):
  - Email opens / clicks on Mailchimp campaigns
  - Replies to outreach
  - Site visits
  - Content downloads

**Approval threshold for entering the leads queue:** ≥ 50–60 fit score
(configurable). Below that, results stay in the prospecting tray as candidates
the rep can approve manually but aren't auto-promoted.

**Per-source archetype:** scoring weights may eventually differ by buyer
archetype (sponsor-buyer prompts weight industry-overlap-with-owned-audiences
heavily; ecosystem-amplifier prompts weight VC/accelerator industry tags
heavily). Start with one unified scorer; split when feedback warrants.

---

## When to update this doc

- New owned audience or property added (TXMX-style brand)
- Service category change (we start or stop offering something)
- New target industry validated, or one removed because it never converts
- ICP feedback from sales — leads that scored high but didn't convert, or low
  scores that did convert (signal that weights are off)
- Annual review with sales team minimum

Worth treating like a product spec: review quarterly, version-control the
changes, link the diff to the sales meeting that prompted it.
