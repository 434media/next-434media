# Higgsfield Integration

This document describes the planned integration between Higgsfield AI (image / video generation) and the existing CRM content-approval workflow. It is the source of truth for any agent (Claude or otherwise) working on this initiative inside this repo.

## Goal

Build a workflow that lets the team generate social content for managed brands — starting with **VemosVamos** — and move it through human approval and out to **Instagram, Facebook, and LinkedIn** without leaving the CRM.

## Architecture Decision

**The CRM is the source of truth for the approval workflow. Slack is not part of v1.**

Higgsfield outputs land directly inside `crm_content_posts` records and move through the existing status machine. Notifications use the surfaces this repo already has (Gmail API + Resend + in-app `crm_notifications`). A Slack notification echo can be added later if mobile push beyond email is needed, but approval clicks always happen inside the CRM.

This decision was made because the CRM already has ~80% of the required data model, UI, RBAC, and notification plumbing. A Slack-first approval flow would fragment audit trails and require a synchronization layer between Slack message state and Firestore record state.

### Bigger picture: Higgsfield is one node in a 6-agent content system

The VemosVamos brand brief (see `docs/brand/vemosvamos-brand-system.md`, section 11) defines six agent roles. Higgsfield is only used by **Agent 4 (Creative Producer)**. Everything else is upstream/downstream work that Claude does inside the CRM.

| Agent | Role | Calls Higgsfield? |
|---|---|---|
| 1. Cultural Signal Scout | Identifies relevant cultural / business / community signals | No |
| 2. Editorial Strategist | Turns signals into post concepts | No |
| 3. Copywriter | Produces `social_copy` text | No |
| **4. Creative Producer** | **Turns concept into image/video asset via Higgsfield** | **Yes** |
| 5. Distribution Manager | Schedules and publishes to platforms | No (uses Meta Graph + LinkedIn APIs) |
| 6. Performance Analyst | Reads results back from CRM, feeds next cycle | No |

The CRM is the substrate that connects all six. Higgsfield is the asset-production tool inside step 4.

### Data Flow

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│   Higgsfield CLI     │ ──▶ │   Server Actions     │ ──▶ │   Firestore          │
│  (image / video)     │     │  actions/higgsfield/ │     │  crm_content_posts   │
└──────────────────────┘     └──────────────────────┘     │  status: ai_drafted  │
                                                          └──────────────────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  Reviewer in CRM     │
                                                          │  ContentDetailDrawer │
                                                          │  → needs_approval    │
                                                          │  → approved          │
                                                          │  → scheduled         │
                                                          └──────────────────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  Posting Service     │
                                                          │  Meta Graph API      │
                                                          │  LinkedIn Marketing  │
                                                          │  → posted            │
                                                          └──────────────────────┘
```

---

## What Already Exists In This Repo

These pieces are in place and should be reused, not rebuilt.

| Concern | Location |
|---|---|
| Content post CRUD | `lib/firestore-crm.ts` (`getContentPosts`, `createContentPost`, `updateContentPost`) |
| Status enum | `crm_content_posts.status`: `to_do → planning → in_progress → needs_approval → approved → scheduled → posted` |
| Review / approve UI | `components/crm/ContentDetailDrawer.tsx` |
| Schedule view | `components/crm/SocialCalendarView.tsx` |
| REST endpoints | `app/api/admin/crm/content-posts/*` |
| In-app notifications | `lib/firestore-crm.ts` (`crm_notifications` collection) + `app/api/admin/crm/notifications` |
| Email notifications | `lib/notifications.ts` (Gmail API w/ domain-wide delegation) |
| Transactional email | `lib/resend.ts` (verified domain `send.434media.com`) |
| Auth + RBAC | `lib/auth.ts` — roles `crm_super_admin`, `full_admin`, `crm_only` |
| i18n (EN/ES) | `i18n-config.ts` + `dictionaries/{en,es}.json` |
| Client records | `crm_clients` Firestore collection — VemosVamos is one of 9+ managed brands |

Tracked platforms in `crm_content_posts`: Instagram, Facebook, LinkedIn, YouTube, TikTok.

---

## What Higgsfield Is

Higgsfield AI is a creative generation platform. It is accessed from the user's machine via the **`higgsfield` CLI** (globally installed; npm package `@higgsfield/cli`). Authentication is browser-based and tied to the user's Higgsfield account — **no API key**. Credits draw from the user's existing Higgsfield plan.

Four Higgsfield skills are installed under `~/.agents/skills/`:

- `higgsfield-generate` — general image / video generation (text-to-image, image-to-image, image-to-video, Marketing Studio ads). Models: GPT Image 2, Nano Banana 2/Pro, Soul V2/Cinema, Seedance 2.0, Veo 3.1, Kling 3.0, Flux 2, Hailuo, etc.
- `higgsfield-product-photoshoot` — branded product / lifestyle / hero shots, ad creative
- `higgsfield-marketplace-cards` — marketplace listing images (not used for VemosVamos)
- `higgsfield-soul-id` — train a face-faithful identity model (one-time per person), reusable via `--soul-id <id>`

**For the exact command surface (flags, modes, output shape), read the SKILL.md files at `~/.agents/skills/higgsfield-*/SKILL.md` directly.** Each skill is a thin wrapper that shells out to `higgsfield` — server actions in this repo will do the same.

**Important nuance for VemosVamos:** the brand owns a meaningful footage library (events, concerts, BTS, regional visits). Most planned content is **edit / restyle / animate of existing footage**, not text-to-image from scratch. The Higgsfield surface area we care most about is `higgsfield-generate` in image-to-video and stylize modes, not `higgsfield-product-photoshoot`.

---

## VemosVamos Brand Context

The canonical brand reference is at `docs/brand/vemosvamos-brand-system.md`. Anything that calls Higgsfield on behalf of VemosVamos should read it first.

**Validated Higgsfield prompts** for VemosVamos visual assets (editorial hero, sticker pack, hero stickers) are at `docs/brand/vemosvamos-visual-prompts.md` along with the reusable visual DNA descriptor block to append to every brand prompt. Use these as starting points for new generations rather than freehanding prompts.

Key facts that affect schema and integration design:

- **Voice rule: "Bilingual when natural, not forced."** → `social_copy` stays a single string per post. Some posts are EN, some are ES, some include Spanish phrases organically. **Do not** split it into `{ en, es }` and do not auto-generate translation variants.
- **Five content lanes** — every post belongs to exactly one: `cultural_signals | creative_systems | builder_stories | between_worlds | action_notes`. Each lane has recommended formats (see brand doc section 12). This should be a typed enum field on `crm_content_posts` (`content_lane`), used to filter the calendar and to inform Higgsfield prompt routing.
- **Visual direction (every gen):** *"Cinematic, editorial, human, textured, vibrant, modern, culturally grounded."* This should be appended automatically to every Higgsfield prompt sent on behalf of VemosVamos.
- **Voice anti-patterns to enforce in copy:** no generic marketing language, no forced Spanglish, no AI-sounding captions, no influencer clichés, no single-personality framing.
- **The brand brief includes an "AI Tool Ingestion Summary" block** (section 13) and an **"AI Agent Master Prompt"** that are ready to use as system prompts for the various Claude-driven agents in the workflow.

---

## What To Build

In build order. Each phase is independently shippable.

### Phase 1 — Higgsfield → CRM ingestion

- `actions/higgsfield/` directory with server actions that:
  - Shell out to the `higgsfield` CLI to start a generation job
  - Poll for completion (Higgsfield jobs are async)
  - Download outputs to Firebase Storage
  - Create a `crm_content_posts` record with `status: "ai_drafted"`, the brand (`crm_clients` reference), the prompt used, and the asset URLs
- Trigger surface: an admin-only UI (likely inside `ContentDetailDrawer.tsx` or a new "Generate with AI" panel) that accepts a brand, a content lane, a format, and a prompt
- The action must read brand context from `docs/brand/vemosvamos-brand-system.md` (or eventually from a `crm_clients` field) and append the visual direction line to the Higgsfield prompt automatically
- Notifications: when a job completes, fire an in-app notification to the assigned reviewer

### Phase 2 — Add `ai_drafted` to the status machine + `content_lane` field

- Insert `ai_drafted` as the new first state, before `needs_approval`
- A draft created by a human still starts at `to_do`; only Higgsfield-generated content starts at `ai_drafted`
- Update the status enum, the calendar view filters, and the drawer UI's available transitions
- The dashboard should let reviewers filter on `ai_drafted` so they can triage AI output without it bleeding into the human approval queue
- Add `content_lane` enum field to `crm_content_posts` with the five values listed above
- Surface `content_lane` in the calendar view as a color or tag, and as a filter

### Phase 3 — Posting service

- Meta Graph API integration for Instagram + Facebook (Business accounts, page tokens, IG container/publish flow)
- LinkedIn Marketing API integration
- A worker / cron that runs at `date_to_post` and publishes any `scheduled` posts whose time has come
- Status transitions: `approved → scheduled` (when a date is set) → `posted` (after successful publish) or a new `failed` state on error
- Per-platform aspect ratio handling — IG Reels (9:16), IG Carousel (1:1 or 4:5), LinkedIn (1.91:1 or 1:1), TikTok (9:16), YouTube Shorts (9:16). The Higgsfield job should be told the target aspect ratio at generation time, not retrofitted at publish time.

**Phase 3 is the biggest unknown.** Meta and LinkedIn both require app review, business account linkage, and per-platform token refresh handling. Budget time accordingly.

---

## What NOT To Build Yet

- **Brand-guide Higgsfield skill.** A future Higgsfield skill will package the brand context (voice, lanes, visual direction, anti-patterns) so any Higgsfield call automatically pulls it. For now, server actions in this repo read `docs/brand/vemosvamos-brand-system.md` directly. The skill comes later, once the workflow is proven and once we have brands beyond VemosVamos modeled this way.
- **Slack integration.** Not in v1.
- **Audio generation pipeline.** Higgsfield's primary surfaces are image and video. If audio is needed for VemosVamos social, it will likely come from a different generator and be attached to the same `crm_content_posts` record. Defer until requirements are concrete.
- **Translation / EN+ES auto-variants.** The brand voice rule explicitly rejects forced bilingualism. Do not build this even though i18n is wired in the dashboard UI.

---

## Open Items

1. **Visual brand assets.** The brand doc does not include color palette, typography, logo files, or logo usage rules. Source these separately (likely a sibling PDF or Figma file) before the brand-guide skill is authored.
2. **Footage library reference.** The brand doc names specific source assets (LatinxFestival, Alejandro Fernández Concert, CapCut vs Edits App, 4 Film Facts, RGV Accelerator Visit, RGV Startup Week 2025, AltBionics) but does not catalog where they live or how to reference them in Higgsfield image-to-video jobs. Decide whether footage lives in Firebase Storage with a `crm_assets` index, in Google Drive with a sync action, or somewhere else.
3. **Approval policy.** The brand doc describes the AI agent workflow but does not name reviewers or quality gates. Decide: who can move `ai_drafted → needs_approval`, who can move `needs_approval → approved`, and whether different content lanes need different approvers.
