# Sales Deck — build plan (Phases 1–3)

Port the `434media/434-sandbox` deck CMS into this admin, backed by our Firestore,
connected to the AI Studio (assets + gateway), and published as a **shareable
URL** (blog-style). PDF/Resend export are deferred — URL-first.

## Design principle (the load-bearing decision)
There are **two layers**, styled differently:
1. **The deck slides** (`buildSlides` from the sandbox) = the **434 pitch-deck
   template — the product**. Port it **as-is**; do NOT restyle it. This is what a
   prospect sees at `/deck/[id]` and in the live preview.
2. **The editor chrome** (list, per-slide forms, buttons, publish flow, preview
   shell) = **our admin design system**. Rebuild it with our neutral
   Vercel-inspired idioms (cards, status chips, `Combobox`/`Dropdown`,
   `AdminRoleGuard`, `AdminTopBar`, dark-primary/ghost buttons). **Do NOT** import
   the sandbox's CMS visuals.

Lives in the sidebar at **Content → Create → "Sales Deck"** (slot already
reserved). Admin editor `/admin/deck`; public share `/deck/[id]`.

---

## Phase 1 — data model + admin editor shell

### Firestore
- New collection `crm_decks` (add to `CRM_COLLECTIONS`, `types/crm-types.ts`).
- New type `SalesDeck` (`types/crm-types.ts` or `types/deck-types.ts`):
  ```ts
  interface SalesDeck {
    id: string
    share_id: string            // unguessable id for the public URL (see Phase 3)
    name: string                // internal name (e.g. "Lab Cafe — health")
    brand?: Brand               // reuse the existing Brand enum for theming
    status: "draft" | "published"
    slides: DeckSlide[]         // ordered list — array order = slide order
    created_by: string
    created_at: string
    updated_at: string
    published_at?: string
  }
  ```
- Slides are **instances** (not fixed ids) so a deck can add/reorder:
  ```ts
  type SlideType =            // the ~12 template layouts become reusable types
    | "title" | "heard" | "opportunity" | "strategy" | "plan" | "why"
    | "audience" | "flow" | "success" | "metrics" | "engagement" | "nextsteps"
  interface DeckSlide {
    instance_id: string       // unique per slide (needed for add / reorder / remove)
    type: SlideType           // which layout to render
    texts: Record<string, string>
    image?: string            // Asset URL (Vercel Blob) — NOT base64 (Phase 2)
    imagePosition?: { x: number; y: number }
    fontScale?: number
  }
  ```
  **Renderer refactor:** the ported `buildSlides` changes from "12 fixed slides
  matched by id" to "render each `DeckSlide` by its `type`" (a per-type layout
  dispatch). The 12 layouts become a **type palette** the editor's "Add slide"
  picks from.
- `lib/firestore-deck.ts` — mirror `lib/firestore-blog.ts`: `createDeck`,
  `getDeckById`, `getDeckByShareId`, `listDecks`, `updateDeck`, `deleteDeck`;
  30s cache + `invalidateDeckCache()`; reuse our `firebase-admin`.

### Ported code (from the sandbox, into `lib/deck/`)
- `lib/deck/slides.tsx` ← sandbox `lib/deck-generator/slides.tsx` — `buildSlides`,
  `SlideData`/`Slide` types, `EditableText`/`EditableImage`/`Photo`/`Waveform`.
  **Keep the slide design.** (The `EditableImage` base64 path gets swapped in
  Phase 2.)
- `lib/deck/types.ts`, `lib/deck/deck-content.ts` ← sandbox equivalents (AI copy
  → `SlideData` mapping).
- `lib/deck/slide-meta.ts` ← the sandbox's `SLIDE_META` (per-slide editable field
  schema; drives the editor forms).

### API routes (our auth: `requireAdmin` / `getSession` + `isAuthorizedAdmin`)
- `app/api/admin/crm/decks/route.ts` — `GET` (list), `POST` (create).
- `app/api/admin/crm/decks/[id]/route.ts` — `GET`, `PATCH` (slides/name/status/
  brand), `DELETE`. Debounced-autosave target for the editor.

### Admin editor UI (our design system)
- `app/admin/deck/page.tsx` — **deck list** (like the blog list / leads table):
  neutral rows/cards, `draft`/`published` status chips, "New deck" button,
  wrapped in `AdminRoleGuard` (Create roles: `full_admin`, `crm_only`; `intern`
  optional for QA).
- `app/admin/deck/[id]/page.tsx` — **full-page editor** (not a drawer — the
  live-preview + 12 slide forms need the room). Layout in our design:
  - Left rail: per-slide **accordion of forms** (neutral inputs, our `Combobox`
    for enums, chips), a `fontScale` control, and a small live `SlideMiniPreview`.
    **Drag-to-reorder** slides; an **"Add slide"** menu picks a layout from the
    type palette; **remove** per slide. (No per-slide "Regenerate" — no AI copy.)
  - Main area: the full **`DeckViewer` live preview** (the actual `buildSlides`
    output — their design), chevron/keyboard nav.
  - Debounced `PATCH` autosave; dark-primary "Publish" + ghost actions.
- Sidebar: add **Sales Deck** to the Create section (icon `Presentation`), href
  `/admin/deck`. Add an `AdminTopBar` breadcrumb (`Create · Sales Deck`).

---

## Phase 2 — AI Studio + media (asset URLs, not base64)

### Media: base64 → asset URLs (required — Firestore 1 MB doc limit)
The sandbox stores images as base64 `data:` URLs inline in the deck doc. Replace
with **asset URLs** so a deck doc stays small:
- Swap `EditableImage`/`ImagePicker` to set `slide.image` to an **https Asset URL**.
- Three sources, all reusing existing admin infra:
  1. **Pick from library** — the `crm_assets` asset picker (as used in `GeneratePanel`).
  2. **Upload** — `POST /api/upload/crm` (existing) → Vercel Blob URL.
  3. **Generate with AI** — embed our **`GeneratePanel`**; `onGenerated(asset)` →
     `slide.image = asset.url`.
- `SlideData.image` stays a `string`; `imagePosition {x,y}` + `fontScale` preserved.

### AI generation → our gateway (images only)
- **Images:** repoint to `POST /api/admin/crm/generate-asset` (the curated models
  we just refreshed — Nano Banana Lite, Recraft, etc.). Keep the per-slide
  auto-prompt idea (`buildImagePrompt`) but feed our models.
- **Copy: not generated.** Per the locked decision, a new deck **seeds from the
  default Lab-health template content** (ported from the sandbox's `pitch-deck` /
  `buildSlides` defaults into `lib/deck/default-deck.ts`); the admin edits text
  manually. No `generate-deck` route, no intake, no CRM-source copy fill.

---

## Phase 3 — public shareable URL (the primary goal)

### Public route
- `app/deck/[shareId]/page.tsx` — **public, read-only**. Loads `crm_decks` by
  `share_id`, published-only; renders `buildSlides(slides)` in a **read-only
  `DeckViewer`** (edit callbacks stripped) with full-screen chevron/keyboard nav.
- **Access = unlisted, not indexed.** `share_id` is an **unguessable random id**
  (not the internal name/slug); `robots: noindex`; NOT listed in any public deck
  index; `draft` → 404 publicly. (Sales decks are 1:1 — different from the blog's
  guessable public slug.)
- `generateMetadata` — title/description + an OG image (reuse the blog OG pattern
  at `/api/og/...`) so shared links preview cleanly.

### Publish flow (blog pattern)
- Editor "Publish" → `status: "published"` + `published_at`; reveals a **"Copy
  link"** to `/deck/[share_id]`. "Unpublish" → 404 publicly. Mirrors the blog
  draft/published toggle.

---

## Reuse (don't rebuild)
`AdminRoleGuard` · `AdminTopBar` · admin layout chrome · `GeneratePanel` +
`/api/admin/crm/generate-asset` + `crm_assets` + `/api/upload/crm` ·
`firebase-admin` + `firestore-*` pattern + `CRM_COLLECTIONS` · blog
publish/slug/draft flow (`firestore-blog.ts`, `/blog/[slug]`) · `generateGatewayText`
+ `ai-gateway-models` · `Brand` enum · neutral card/chip/`Combobox`/`DetailDrawer`/
button idioms.

## Do NOT port
- The sandbox's **CMS visual design** — rebuild the editor chrome in our system.
- **Base64 image storage** — use asset URLs.
- **Direct Google GenAI** calls — repoint to our gateway.
- The **standalone intake form** AND the **AI deck-copy generation**
  (`generate-deck`, `deck-content`, intake→deck) — decks seed from the default
  template and are edited manually (locked decision 4).
- **Puppeteer PDF + Resend email** — defer (URL-first). Revisit if the sales team
  needs offline decks.
- `framer-motion` (the sandbox lists both) — use `motion/react` (already our dep).

## Locked decisions
1. **Public URL:** unlisted random `share_id` + `noindex`. ✓
2. **Slides:** default to the 12-slide template, **plus add & reorder**. The model
   + renderer support a variable, ordered list (see the `DeckSlide` model above).
3. **Intern access:** yes — interns QA the deck (`intern` in the route + sidebar roles).
4. **Deck source:** start from the **default Lab-health template content** and edit
   manually. **No intake form; no AI copy-generation from a CRM source.** (AI
   *image* generation via the Studio still applies — for slide visuals.)

## Suggested build order (milestones)
1. `crm_decks` model (`DeckSlide[]`) + `firestore-deck.ts` +
   `/api/admin/crm/decks[/id]` (Phase 1a)
2. Port `lib/deck/slides.tsx` + refactor `buildSlides` to render-by-`type`;
   `lib/deck/default-deck.ts` (Lab-health seed); render in a throwaway admin page
   to confirm it works on our stack (Phase 1b)
3. Editor shell — list + `[id]` editor + live preview + add/reorder/remove, our
   design (Phase 1c)
4. Asset-URL media: pick / upload / generate via `GeneratePanel` (Phase 2)
5. Public `/deck/[shareId]` + publish flow + OG image (Phase 3)
