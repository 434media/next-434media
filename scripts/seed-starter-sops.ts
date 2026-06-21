/**
 * Seed a "Start Here" SOP for every 434 Media (company) category in the
 * Knowledge Base (pm_sops). Each one orients the reader and doubles as a backlog
 * of the SOPs that category still needs.
 *
 * Idempotent reconcile: a missing doc is created; an existing doc is UPDATED
 * only when it's still seed-authored (owner "434 Media") and its content or
 * description drifted from this file — so re-running converges the starters
 * without ever clobbering a doc someone has since hand-edited or re-owned.
 *
 *   npx tsx --env-file=.env.local scripts/seed-starter-sops.ts
 */
import {
  getSOPsFromFirestore,
  createSOPInFirestore,
  updateSOPInFirestore,
} from "../lib/firestore-project-management"

const SEED_OWNER = "434 Media"

interface Starter {
  category: string
  title: string
  description: string
  content: string
  tags: string[]
}

const STARTERS: Starter[] = [
  {
    category: "Operations",
    title: "Start Here — Welcome to the 434 Media Hub",
    description: "What 434 Media does, our values, and how this knowledge base is organized.",
    tags: ["onboarding", "start-here"],
    content: `# Welcome to the 434 Media Hub

This is the central knowledge base for 434 Media and the Digital Canvas Builder Program. Everything we know how to do lives here as a document — **if it isn't documented, it isn't done.**

## Our mission
Bold ideas, excellence in execution.

## What we do
Full-service brand storytelling, broadcast & digital media strategy, video production, web development, and event production — across our family of brands.

## Our attitude
**Actions speak louder.** Vision to action drives everything from creative ideation to final execution.

## Core values
- **Integrity** — Do what you say you're going to do. Trust but verify.
- **Creativity** — Stay curious, challenge the status quo, solve problems, think big.
- **Collaboration** — We don't do it alone. You are the company you keep.
- **Excellence** — If you're going to do it, do it right. Be accountable.
- **Impact** — Your time is valuable, so is everyone else's. Make it matter.

## Office
Fine Silver — 816 Camaron St., Suite 1.11, San Antonio, TX 78212

## How this hub is organized
Documents live in two spaces.

### 434 Media — how we run the company
- **Brand & Design** — guidelines, identity, voice & tone, the design system
- **Content & Production** — content studio, social, video, broadcast & event production
- **Sales & CRM** — pipeline ops: audiences, leads, outreach, consent & compliance
- **Analytics & Reporting** — GA4, Instagram & portfolio reporting, brand goals
- **Web & Tech** — web standards, CMS, deployment, technical docs
- **Operations** — onboarding, finance, HR, process & general resources

### Digital Canvas Program — the cohort pipeline
One pipeline, five owners: **GTM** finds it · **Underwriter Onboarding** frames it · **Builders** ship it · **Storytellers** tell it · **Analytics** proves it.

Use the **vertical filter** at the top to cut across the program by industry (Cybersecurity, Health, Aerospace, and more).

## Where we talk
Day-to-day chat and idea-swapping happen in the **DevSA Discord** (https://discord.gg/cvHHzThrEw) — one channel per squad. This hub and the admin hold the durable work; Discord holds the conversation. See **Operations → How We Communicate**.
`,
  },
  {
    category: "Operations",
    title: "Start Here — How We Communicate",
    description: "Where the cohort talks vs. where work is recorded — Discord + the admin.",
    tags: ["start-here", "communication", "discord", "cohort"],
    content: `# How We Communicate

Two places, two jobs. Keep them straight and nothing gets lost.

## Daily chat & idea-swapping → Discord
Day-to-day conversation runs in the **DevSA Discord**: quick questions, idea-swapping, feedback, standups, "is this any good?", sharing links and screenshots.

**Join:** https://discord.gg/cvHHzThrEw

Each squad has its own channel (GTM, Onboarding, Builders, Storytellers, Analytics) plus a general cohort channel. Talk in your squad channel; cross-post to general when it's for everyone.

## Decisions, work & deliverables → the admin
The admin platform is the **system of record**. Anything that needs to persist lives here, not in a Discord thread that scrolls away:
- **Tasks & deliverables** → the cohort board (Cohorts)
- **Leads, scores, kept/removed decisions** → Leads + Funnel KPIs
- **Sourced problems** → Problem Library
- **Playbooks, frameworks & templates** → SOPs (this knowledge base)

## The rule of thumb
> If it's a **conversation**, it goes in Discord. If it's a **decision, a record, or a deliverable**, it goes in the admin.

When a Discord discussion produces a decision, capture the outcome in the admin so it isn't lost.
`,
  },
  {
    category: "Brand & Design",
    title: "Start Here — Brand & Design",
    description: "How 434 and its brands show up — identity, voice, and the design system.",
    tags: ["start-here", "brand"],
    content: `# Brand & Design

How 434 Media and every brand under it look, sound, and feel — so anyone can produce on-brand work without guessing.

## What lives here
- The 434 Media master brand guide
- Per-brand identity guides — 434 Media, Vemos Vamos, DEVSA, Digital Canvas, TXMX Boxing, AIMSATX
- Voice & tone
- Logo usage, color, and typography
- The design system and reusable templates

## How it connects to the admin
- Brand goals & targets are set in **CRM → Settings**
- Generated assets live in **Content → AI Studio**
- A brand is a *facet*, not a folder — keep one guide per brand here

## SOPs to write
- The 434 Media master brand guide
- One identity guide per brand
- Voice & tone guide
- Logo & asset usage rules
- Color & typography reference
- Template library (decks, social, thumbnails)
`,
  },
  {
    category: "Content & Production",
    title: "Start Here — Content & Production",
    description: "How we make and ship media — content studio, social, video, broadcast & events.",
    tags: ["start-here", "content", "production"],
    content: `# Content & Production

Everything about making media and getting it out the door — from an AI-generated asset, to a produced video, to an event on the floor.

## What lives here
- Social content & calendar SOPs
- The AI generation pipeline (Higgsfield)
- Content approval & publishing workflow
- Video production — pre-production, shoot, post
- Broadcast & livestream
- Event production — run-of-show, AV, gear

## How it connects to the admin
- Generate assets in **Content → AI Studio**
- Plan & schedule in **Content → Calendar**
- Publish to the site via **Feed** and **Blog**
- Posts move through ai_drafted → needs_approval → approved → posted

## SOPs to write
- Social posting & scheduling SOP
- AI generation pipeline (models, prompts, approval)
- Content approval workflow (who approves what)
- Video production checklist (pre / prod / post)
- Event production run-of-show template
- Demo-day production runbook (cross-ref Analytics)
`,
  },
  {
    category: "Sales & CRM",
    title: "Start Here — Sales & CRM",
    description: "How we run the pipeline — prospecting, outreach, consent, and compliance.",
    tags: ["start-here", "sales", "crm", "compliance"],
    content: `# Sales & CRM

How revenue moves through 434: from an audience or a prospected lead, to outreach, to a won opportunity — and the rules that keep it compliant.

## What lives here
- Lead qualification & scoring
- Prospecting workflow (Apollo)
- Outreach & email (Resend) + consent rules
- Outreach compliance — the jurisdiction policy
- Opportunity stages & dispositions
- Mailchimp tag taxonomy & audiences

## How it connects to the admin
- The pipeline runs **Audiences → Inbox → Leads → CRM** (CRM is the staff/operator deal stage)
- The **Leads** and **Prospect** tabs are one workspace — find in Prospect (Apollo → score → approve), work in Leads
- Measure lead quality on **Insights → Funnel KPIs**: score, and kept vs removed (set a **removal reason** when you archive — that's the KPI)
- **Interns build the engine; staff own the sends** — outreach sending is role-gated
- Sending is consent-gated; hard bounces are blocked

## Key rules to document
- **Jurisdiction policy** — 434 does not cold-outreach the EU, UK, EEA, Switzerland, or Canada (GDPR / CASL). This is hard-excluded in every outbound surface.
- **Consent** — only message eligible, subscribed contacts; opt-outs are always honored.

## SOPs to write
- Lead qualification & scoring rubric
- Prospecting workflow (Apollo → score → approve)
- Outreach + consent policy
- Outreach jurisdiction / compliance policy
- Opportunity stages & dispositions
- Mailchimp tag taxonomy
`,
  },
  {
    category: "Analytics & Reporting",
    title: "Start Here — Analytics & Reporting",
    description: "How we measure and report — GA4, Instagram, portfolio, and brand goals.",
    tags: ["start-here", "analytics", "reporting"],
    content: `# Analytics & Reporting

How we turn data into reporting for 434 and its brands — what we track, where it comes from, and how we package it.

## What lives here
- Monthly brand reporting SOP
- GA4 property map & web analytics
- Instagram & social analytics
- Portfolio rollup (all brands)
- Brand goals & pacing
- Demo-day dashboard (cross-ref program Analytics)

## How it connects to the admin
- **Insights → Analytics** (Portfolio / Web / Instagram) — 434 marketing analytics, **staff-only**
- **Insights → Funnel KPIs** — the cohort program's lead-quality + email-benchmark scoreboard (see Digital Canvas → Prove); this is the surface the Analytics squad works in
- Goals & targets are set in **CRM → Settings** (brand goals)
- Export CSV or copy a share-link from the analytics header

## SOPs to write
- Monthly brand report SOP
- GA4 property & event map
- Goal-setting & pacing method
- Portfolio rollup procedure
- Demo-day dashboard spec
`,
  },
  {
    category: "Web & Tech",
    title: "Start Here — Web & Tech",
    description: "How the sites and the admin platform are built, shipped, and kept secure.",
    tags: ["start-here", "web", "tech", "security"],
    content: `# Web & Tech

How 434's web properties and this admin platform are built, deployed, and maintained.

## What lives here
- Tech stack & architecture (Next.js, Firestore, Vercel)
- Deployment & release runbook
- Environments & secrets
- CMS / Feed / Blog publishing
- Security baseline
- Incident response

## How it connects to the admin
- The admin itself is part of this stack
- Publishing surfaces: **Content → Feed, Blog**
- Integrations: GA4, Mailchimp, Resend, Apollo, Higgsfield

## Key rules to document
- **Package manager: pnpm only** — never run \`npm install\` (the npm lockfile is gitignored and dependencies are pinned).
- Keep secrets in environment variables, never in the repo.

## SOPs to write
- Architecture overview
- Deploy / release runbook
- Environment & secrets management
- CMS publishing (Feed / Blog)
- Security baseline (pnpm-only, dependency policy)
- Incident response
`,
  },

  // ── Digital Canvas program — one Start Here per pipeline stage (verb) ──
  {
    category: "find",
    title: "Start Here — Find (GTM)",
    description: "Finding and qualifying the corporate sponsors who underwrite a cohort.",
    tags: ["start-here", "gtm", "find"],
    content: `# Find — GTM

The GTM squad finds and pitches the corporate sponsors / underwriters who claim a vertical and own a cohort. This space holds the playbook for sourcing and qualifying them.

## What this squad produces
- An ICP (ideal sponsor profile) per vertical
- A saved Apollo query set
- A scored target list of candidate underwriters
- An outreach template library
- The prospecting playbook

## How it connects to the admin
- Find prospects in the **Prospect** tab (Apollo → score → approve); work them in the **Leads** tab — the two are one workspace, switched by the tabs up top
- Measure your lead quality on **Insights → Funnel KPIs**: score, and kept vs removed — **set a removal reason when you archive a lead**, because *which leads you kept and why you dropped the rest* is the KPI
- **Interns build the engine; staff own the sends** — outreach sending is role-gated
- Warm sponsors get handed to Underwriter Onboarding to frame their problems

## Hand-off
Reusable query/template logic gets wired into the platform by the lead dev; Marcos owns the actual sends.
`,
  },
  {
    category: "frame",
    title: "Start Here — Frame (Underwriter Onboarding)",
    description: "The intake framework that pulls venture-credible problems out of underwriters.",
    tags: ["start-here", "underwriter", "frame"],
    content: `# Frame — Underwriter Onboarding

This squad architects the **intake framework** — the question architecture that extracts highly specific, venture-credible pain points from corporate and institutional underwriters. You design the templates; the Build team engineers the digital onboarding form.

## What this squad produces
- Per-vertical question templates (start with **Cybersecurity, Health & Science, Aerospace**)
- Tailored discovery paths — conditional logic, different questions per vertical
- A value-space prompt: is the problem an **optimization bottleneck** (saves staff hours) or a **growth gap** (new tech space)?

## Blueprints
- **PAINstorming** (Praxie / Soren Kaplan) — design questions that surface the *manual workarounds* where employees duct-tape around failing systems.
- **Monday.com B2B intake forms** — structure from basic profile → heavy technical constraints; conditional logic.
- **Bundl — Define your value spaces** — separate optimization vs growth problems.

## How it connects to the admin
- Captured problems live in the **Problem Library** (sourced → vetted → activated into a cohort's problem set)
- The public **/underwriter-intake** form is the instrument Build engineers from your templates

## Hand-off
Finalize the text templates per vertical → hand to Build to deploy the official digital onboarding.
`,
  },
  {
    category: "ship",
    title: "Start Here — Ship (Builders)",
    description: "How cohort builders go from a problem to a shipped prototype.",
    tags: ["start-here", "builders", "ship"],
    content: `# Ship — Builders

The Build squad ships software in the Digital Canvas repo — **not** the 434 admin codebase. This space documents how builders go from a problem-set entry to a shipped prototype.

## What this squad produces
- Builder onboarding & environment setup
- Repo / sandbox-branch / PR-review workflow (\`github.com/434media/next-canvas\`)
- Build standards and a demo-prep checklist
- Reviewed tools graduated into the platform via the lead dev

## How it connects to the admin
- Builder status is tracked on the **cohort board** (applied → accepted → active → shipped → demoed)
- No intern writes to the 434 admin codebase; the lead dev is the only bridge to production

## Hand-off
Reviewed output is wired into the admin by the lead dev; builders never push to the 434 platform.
`,
  },
  {
    category: "tell",
    title: "Start Here — Tell (Storytellers)",
    description: "The content system that tells the program's and builders' stories.",
    tags: ["start-here", "storytellers", "tell"],
    content: `# Tell — Storytellers

The Storytellers squad tells the story of the program, its partners, and its builders. This space holds the content system.

## What this squad produces
- A brand & asset kit
- A documented AI production pipeline
- A builder-profile content format
- A seed batch of real pieces (DevSA / partner spotlights)

## How it connects to the admin
- Make assets in **Content → AI Studio**
- Plan & schedule in **Content → Calendar**
- Move posts through the approve → post pipeline (drafts → needs approval → approved → posted)

## Blueprints
- The 434 Media work page; DevSA and Alamo Angels Instagram for tone & alignment.

## Hand-off
Templates + a seed batch prove the system; published pieces run through the normal content approval flow.
`,
  },
  {
    category: "prove",
    title: "Start Here — Prove (Analytics)",
    description: "The Cohort Health Framework — how we measure and prove the program.",
    tags: ["start-here", "analytics", "prove"],
    content: `# Prove — Analytics

The Analytics squad measures cohort health and proves the program's ROI. Phase 1 is research: design the metrics and the question sets; Build deploys the forms and the dashboard.

## What this squad produces — two instruments
**1. Mid-cohort builder health check (internal)**
- Measure momentum and core traction, not vanity metrics.
- Adapt **Rahul Vohra's PMF engine** (YC): ask how disappointed builders would be if the program's resources disappeared — to gauge how critical the program is mid-session.

**2. Post-cohort investor & underwriter survey (external)**
- Use **Founder NPS** and program-quality tracking (Techstars).
- Demonstrate regional ecosystem impact, partner satisfaction, and clear ROI to the entities underwriting the cohort.

## Deliverables
- Finalized question set for the mid-cohort builder health check
- Finalized question set for the post-cohort investor / underwriter survey
- Metric definitions + a demo-day dashboard spec

## Blueprints
- Y Combinator Startup Library — momentum & traction over vanity metrics
- Rahul Vohra / Superhuman PMF engine
- Techstars accelerator KPIs & Founder NPS

## How it connects to the admin
- A **Funnel KPIs** surface is now live at **Insights → Funnel KPIs** (\`/admin/kpis\`) — this is your starting scoreboard. It covers **lead quality** (score distribution, kept vs removed + removal reasons, conversion by score band, per-source performance) and **email benchmarks** (Mailchimp drop-campaign performance + Resend 1:1 outreach). Note: the 434 web/social Analytics page is staff-only and separate — Funnel KPIs is the squad's surface.
- More health signals already exist: **builder status** and **per-squad task completion** on the cohort board — fold these in.
- The surveys add the **sentiment** layer the dashboards can't capture.
- Still **net-new**: a cohort-health *survey* results store + the demo-day visualization — design the framework + spec; Build deploys those.

## Hand-off
Finalize the question sets → hand to Build to deploy the forms and generate the demo-day visualizations.
`,
  },
]

async function main() {
  const existing = await getSOPsFromFirestore()
  const byTitle = new Map(existing.map((s) => [s.title, s]))
  let created = 0
  let updated = 0
  let skipped = 0
  for (const s of STARTERS) {
    const match = byTitle.get(s.title)
    if (match) {
      // Only reconcile docs the seed still owns — never overwrite a starter
      // that's been hand-edited (its content drifts intentionally) or re-owned.
      const seedAuthored = (match.owner || "") === SEED_OWNER
      const drifted = match.content !== s.content || match.description !== s.description
      if (seedAuthored && drifted) {
        await updateSOPInFirestore(match.id, {
          category: s.category,
          description: s.description,
          content: s.content,
          tags: s.tags,
        })
        console.log(`↻ updated [${s.category}] ${s.title}`)
        updated++
      } else {
        console.log(`✓ skip (${seedAuthored ? "unchanged" : "hand-owned"}): ${s.title}`)
        skipped++
      }
      continue
    }
    const doc = await createSOPInFirestore({
      title: s.title,
      category: s.category,
      description: s.description,
      content: s.content,
      status: "active",
      version: "1.0",
      owner: SEED_OWNER,
      tags: s.tags,
    })
    console.log(`✅ created [${s.category}] ${s.title} — id: ${doc.id}`)
    created++
  }
  console.log(`\nDone — ${created} created, ${updated} updated, ${skipped} skipped.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
