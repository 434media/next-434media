/**
 * Seed a "Start Here" SOP for every 434 Media (company) category in the
 * Knowledge Base (pm_sops). Each one orients the reader and doubles as a backlog
 * of the SOPs that category still needs. Idempotent — any doc whose title
 * already exists is skipped, so re-running only fills gaps.
 *
 *   npx tsx --env-file=.env.local scripts/seed-starter-sops.ts
 */
import { getSOPsFromFirestore, createSOPInFirestore } from "../lib/firestore-project-management"

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
- The pipeline runs **Audiences → Inbox → Leads → CRM**
- Prospect new leads in **Leads → Prospect** (Apollo)
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
- **Insights → Analytics** (Portfolio / Web / Instagram)
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
]

async function main() {
  const existing = await getSOPsFromFirestore()
  const existingTitles = new Set(existing.map((s) => s.title))
  let created = 0
  let skipped = 0
  for (const s of STARTERS) {
    if (existingTitles.has(s.title)) {
      console.log(`✓ skip (exists): ${s.title}`)
      skipped++
      continue
    }
    const doc = await createSOPInFirestore({
      title: s.title,
      category: s.category,
      description: s.description,
      content: s.content,
      status: "active",
      version: "1.0",
      owner: "434 Media",
      tags: s.tags,
    })
    console.log(`✅ created [${s.category}] ${s.title} — id: ${doc.id}`)
    created++
  }
  console.log(`\nDone — ${created} created, ${skipped} skipped.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
