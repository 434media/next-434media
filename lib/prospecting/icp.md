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

## Buyer archetypes (Apollo WHO/WHEN persona model)

We sell to four distinct buyer types. Each is defined on two axes, per the Apollo
prospecting framework:

- **WHO** — account-level firmographics (industry, size, revenue, location) +
  persona tiers (who *inside* the account we reach).
- **WHEN** — the buying signals that make outreach timely. Start each campaign
  from 1–2 of these, not from firmographics alone.

Persona tiers follow Apollo's model:
- **Tier 1 · Economic Buyer** — controls the budget, signs the deal.
- **Tier 2 · Champion** — feels the pain, sells it internally; usually the best
  first-touch.
- **Tier 3 · End User / Influencer** — lives with the work; validates fit.

The prospecting feature should be able to score against all four archetypes and,
where possible, target the Champion (Tier 2) as the opening move.

---

### 1. Sponsor-buyers

Brands that buy audience access and sponsorship slots in our owned channels
(TXMX Boxing, Univision, Vemos Vamos, AIM Health events).

**WHO — account**
- **Industries:** CPG / consumer brands (Hispanic-focus), sports & lifestyle,
  automotive, beverage, financial services, healthcare systems
- **Keywords:** "Hispanic marketing," "multicultural marketing," "sponsorship,"
  "brand activation," "experiential"
- **Headcount:** 50–1,000+ (brands with a real marketing org)
- **Revenue:** $20M+ (has a sponsorship line item)
- **Location:** Texas-HQ, national brands targeting US Hispanic audiences, or
  companies expanding into Texas

**WHO — persona tiers**
| Tier | Titles | Management level |
|---|---|---|
| 1 · Economic Buyer | CMO, VP Marketing, VP Brand | C-suite / VP |
| 2 · Champion | Head of Partnerships, Head of Sponsorships, Brand Director, Multicultural/Hispanic Marketing Lead | Director / Head |
| 3 · End User | Sponsorship Manager, Brand Manager, Field/Experiential Marketing Manager | Manager |

**WHEN — signals (start with 1–2)**
- Expansion into Texas / new Texas office announced *(highest-value trigger)*
- New CMO / VP Brand / Head of Partnerships appointment
- Product launch or brand refresh aligned to a campaign calendar
- Fiscal-year planning window
- Buying-intent topics: "sponsorship," "multicultural marketing," "brand activation"

---

### 2. Storytelling clients

Founders, programs, and institutions that need video, documentary, or brand work
(Alt-Bionics, Vanita Leo, Mission Road Ministries, Methodist Healthcare Ministries).

**WHO — account**
- **Industries:** healthcare & life sciences, biotech/medtech, nonprofits &
  mission-driven orgs, education/workforce, founder-led startups
- **Keywords:** "brand storytelling," "documentary," "content production,"
  "founder story," "impact campaign"
- **Headcount:** 5–500 (founder-led up through mid-size institutions; no upper
  cap for mission-aligned institutions)
- **Revenue:** $500K+ for-profit; grant/institutional budget for nonprofits
- **Location:** South Texas / San Antonio priority; Greater Texas; Hispanic angle

**WHO — persona tiers**
| Tier | Titles | Management level |
|---|---|---|
| 1 · Economic Buyer | Founder / CEO (small orgs), Executive Director (institutional) | Founder / C-suite |
| 2 · Champion | Communications Director, Marketing Director, Head of Brand | Director / Head |
| 3 · End User | Marketing Manager, Content Manager, Comms Manager | Manager |

**WHEN — signals (start with 1–2)**
- Recent funding round (Series A+ for startups) *(top trigger)*
- Program / product milestone or public-moment opportunity (anniversary, launch)
- New Communications or Marketing Director appointment
- Grant awarded (nonprofits) → funded campaign window
- Press-coverage spike or industry award

---

### 3. Event partners

Organizations running events that need production, promotion, or audience-building
support (AIM Health R&D Summit, The Health Cell, Tech Bloc, VelocityTX).

**WHO — account**
- **Industries:** health/biotech ecosystem orgs, economic-development & civic-tech,
  accelerators, industry associations
- **Keywords:** "summit," "conference," "demo day," "convening," "annual event"
- **Headcount:** any — event/program orgs are often small teams with large events
- **Revenue:** event budget or sponsorship-revenue-funded; not a for-profit gate
- **Location:** Texas ecosystem, San Antonio priority

**WHO — persona tiers**
| Tier | Titles | Management level |
|---|---|---|
| 1 · Economic Buyer | Executive Director, Founder / CEO | Founder / C-suite |
| 2 · Champion | Program Director, Director of Events | Director |
| 3 · End User | Events Manager, Program Manager, Marketing Coordinator | Manager / senior |

**WHEN — signals (start with 1–2)**
- 3–6 months before a known annual event date *(the defining trigger)*
- New program / cohort / initiative launched
- Hiring for events or program roles (job-posting signal)
- Expanded event footprint or new event announced

---

### 4. Ecosystem amplifiers

VCs, accelerators, and angel networks that buy cohort or portfolio storytelling
(Builders VC, Alamo Angels, Nucleate Texas, VelocityTX).

**WHO — account**
- **Industries:** venture capital, accelerators, angel networks, family offices
- **Keywords:** "portfolio," "cohort," "accelerator," "fund," "founder community"
- **Headcount:** 2–100 (fund/program teams are lean)
- **Revenue:** n/a — filter on fund/program signals, not company revenue
- **Location:** Texas-focused funds; national funds with Texas or Hispanic thesis

**WHO — persona tiers**
| Tier | Titles | Management level |
|---|---|---|
| 1 · Economic Buyer | Managing Partner, General Partner, Fund Principal | Partner / C-suite |
| 2 · Champion | Partner, Director of Storytelling, Head of Platform | Director / Head |
| 3 · End User | Portfolio Marketing Lead, Platform Manager, Program Manager | Manager / senior |

**WHEN — signals (start with 1–2)**
- New fund close *(top trigger — fresh platform budget)*
- New cohort / batch announced
- Portfolio-company milestone (raise, launch) they'll want to amplify
- New Head of Platform / Portfolio Marketing appointment

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

## Scoring posture — the canonical ICP rubric (Step 2)

There is **one** ICP fit score (0–100, company-level) — the single source of
truth in `lib/icp/rubric.ts` (taxonomy in `lib/icp/taxonomy.ts`). The same
scorer runs on the prospecting path and the lead path, so a prospect's fit +
grade travel into the lead and the opportunity **unchanged**. Title and intent
are separate axes, deliberately NOT folded into fit.

### Fit dimensions (canonical, reconciled to the Canva ICP template)

| Dimension | Max | Source | Status |
|---|---|---|---|
| Industry | 25 | org industry / name (+ filter keywords on Free plan) | live |
| **Location** | **20** | city/state (+ filter locations) | live — weighted heavier than Canva's 10 (434's South-Texas thesis) |
| Company Size | 15 | Apollo `estimated_num_employees`; unknown = 0 | live |
| Funding Stage | 15 | Apollo `annual_revenue` (a maturity proxy — no round data) | live (revenue-based) |
| Growth Stage | 20 | expansion / round signals — **needs research/enrichment** | dormant |
| Event Activity | 15 | hosts conferences / meetups / webinars — **needs research** | dormant |

**Normalization (hybrid).** Core dimensions (Industry, Location, Size) are
always in the denominator — unknown scores 0, per the rubric. Extended
dimensions (Funding, Growth, Event) join the denominator **only when their data
is present**, so activating them never craters scores for leads that lack the
data. `fit = round(rawPoints / activeMax × 100)`.

### Grades

`A+ 90–100 · A 80–89 · B 70–79 · C 60–69 · D <60`

- **Approve into the leads queue:** fit ≥ 60 (grade C), env-configurable
  (`PROSPECTING_FIT_THRESHOLD`).
- **Quality "ICP-matched" (Funnel KPI):** fit ≥ 70 (grade B), `ICP_MATCH_THRESHOLD`.

### Title & intent (separate axes)

- **Title** is a *contact qualifier* (is this the right person?) — scored 0–20,
  surfaced beside fit, not part of it.
- **Intent** (engagement, sponsor tag, event-sourced) lives in `intent_score`.
  The full intent model (website / hiring / business signals) is Step 6.

**Per-source archetype:** weights may eventually differ by buyer archetype.
Start with one unified scorer; split when feedback warrants.

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
