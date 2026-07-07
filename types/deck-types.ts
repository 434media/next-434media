import type { Brand } from "./crm-types"

// Sales deck data model. A deck is an ordered list of slide INSTANCES; each
// references one of the template layouts (SlideType). Slides can be added,
// reordered, and removed, so a slide needs a stable instance_id separate from
// its layout type. Images are Asset URLs (Vercel Blob), never inline base64,
// so a deck document stays well under Firestore's 1MB limit.

// The template layouts (from the ported buildSlides) — a deck's "type palette".
export type SlideType =
  | "title"
  | "heard"
  | "opportunity"
  | "strategy"
  | "plan"
  | "why"
  | "audience"
  | "flow"
  | "success"
  | "metrics"
  | "engagement"
  | "nextsteps"

export const SLIDE_TYPES: SlideType[] = [
  "title",
  "heard",
  "opportunity",
  "strategy",
  "plan",
  "why",
  "audience",
  "flow",
  "success",
  "metrics",
  "engagement",
  "nextsteps",
]

export interface DeckSlide {
  /** Unique per slide instance — enables add / reorder / remove. */
  instance_id: string
  /** Which template layout to render. */
  type: SlideType
  /** Editable text fields, keyed per the layout's schema (SLIDE_META). */
  texts: Record<string, string>
  /** Slide image — an Asset URL (Vercel Blob), never inline base64. */
  image?: string
  /** Image focal point as percentages, for drag-to-reposition. */
  imagePosition?: { x: number; y: number }
  /** Per-slide font scaling (~0.75–1.5). */
  fontScale?: number
}

export type DeckStatus = "draft" | "published"

export interface SalesDeck {
  id: string
  /** Unguessable id used in the public share URL /deck/[share_id]. */
  share_id: string
  /** Internal name, e.g. "Lab Cafe — health". */
  name: string
  /** Sub-brand for theming (optional). */
  brand?: Brand
  status: DeckStatus
  /** Ordered slide instances — array order is the slide order. */
  slides: DeckSlide[]
  created_by: string
  created_at: string
  updated_at: string
  published_at?: string
}

export interface CreateDeckInput {
  name: string
  brand?: Brand
  slides: DeckSlide[]
  created_by: string
}

export interface UpdateDeckInput {
  name?: string
  brand?: Brand
  status?: DeckStatus
  slides?: DeckSlide[]
}
