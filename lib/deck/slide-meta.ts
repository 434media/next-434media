import type { SlideType } from "@/types/deck-types"

// The editable text-field schema for each slide type. Drives the editor's field
// panel and documents which `texts` keys each layout in `slides.tsx` consumes.
// `multiline` fields hold newline-separated lists (bullets, steps).

export interface SlideField {
  key: string
  label: string
  multiline?: boolean
  /** Hint shown in the editor when the field is empty. */
  placeholder?: string
}

export interface SlideMeta {
  type: SlideType
  /** Human label for the type picker / slide list. */
  label: string
  /** Whether this layout renders a swappable media panel. */
  hasImage: boolean
  /** Whether this layout renders a SECOND media panel (e.g. Customer Flow). */
  hasImage2?: boolean
  /** Editor labels for the media slots when a layout has two. */
  imageLabel?: string
  image2Label?: string
  fields: SlideField[]
}

// The preset headline each slide type shows when the author hasn't set a custom
// `texts.heading`. Newlines are honoured as line breaks (whitespace-pre-line), so
// these match the source deck's stacked titles. `title` uses its `company` field
// as its headline instead, so it has no preset here. Referenced by both the
// renderer (fallback when `heading` is undefined) and the editor's title field.
// Clearing the field to "" hides the headline; leaving it undefined shows this.
export const DEFAULT_HEADINGS: Record<SlideType, string> = {
  title: "",
  heard: "WHAT WE HEARD",
  opportunity: "OPPORTUNITY",
  strategy: "STRATEGIC\nRECOMMENDATION",
  plan: "RECOMMENDED\nMARKETING\nPLAN",
  why: "WHY THIS MATTERS",
  audience: "AUDIENCE\nPRIORITIZATION",
  flow: "CUSTOMER\nFLOW\nJOURNEY",
  success: "SUCCESS\nSTORIES",
  metrics: "WHAT\nSUCCESS\nLOOKS LIKE",
  engagement: "RECOMMENDED\nENGAGEMENT",
  nextsteps: "NEXT STEPS",
}

export const SLIDE_META: Record<SlideType, SlideMeta> = {
  title: {
    type: "title",
    label: "Title",
    hasImage: true,
    fields: [
      { key: "company", label: "Company / deck title", multiline: true },
      { key: "subtitle", label: "Subtitle", placeholder: "Presented By : 434 Media" },
    ],
  },
  heard: {
    type: "heard",
    label: "What We Heard",
    hasImage: false,
    fields: [
      { key: "challenge", label: "Current Challenges", multiline: true },
      { key: "opportunity", label: "Current Opportunities", multiline: true },
      { key: "outcome", label: "Desired Outcomes", multiline: true },
    ],
  },
  opportunity: {
    type: "opportunity",
    label: "Opportunity",
    hasImage: true,
    fields: [
      { key: "headline", label: "Headline" },
      { key: "bullets", label: "Supporting points", multiline: true },
    ],
  },
  strategy: {
    type: "strategy",
    label: "Strategic Recommendation",
    hasImage: false,
    fields: [
      { key: "line1", label: "Line 1" },
      { key: "line2", label: "Line 2" },
      { key: "line3", label: "Line 3" },
    ],
  },
  plan: {
    type: "plan",
    label: "Marketing Plan",
    hasImage: true,
    fields: [
      { key: "phase1_label", label: "Phase 1 — heading", placeholder: "Demand Capture" },
      { key: "phase1_items", label: "Phase 1 — items", multiline: true },
      { key: "phase2_label", label: "Phase 2 — heading", placeholder: "Demand Expansion" },
      { key: "phase2_items", label: "Phase 2 — items", multiline: true },
      { key: "phase3_label", label: "Phase 3 — heading", placeholder: "Brand Development" },
      { key: "phase3_items", label: "Phase 3 — items", multiline: true },
    ],
  },
  why: {
    type: "why",
    label: "Why This Matters",
    hasImage: true,
    fields: [
      { key: "point1", label: "Point 1" },
      { key: "point2", label: "Point 2" },
      { key: "point3", label: "Point 3" },
    ],
  },
  audience: {
    type: "audience",
    label: "Audience Prioritization",
    hasImage: true,
    fields: [
      { key: "primary", label: "Primary audience" },
      { key: "secondary", label: "Secondary audience" },
      { key: "behavioral", label: "Behavioral audience" },
      { key: "growth", label: "Growth audience" },
    ],
  },
  flow: {
    type: "flow",
    label: "Customer Flow Journey",
    hasImage: true,
    hasImage2: true,
    imageLabel: "Right image",
    image2Label: "Left image",
    fields: [{ key: "steps", label: "Steps (one per line)", multiline: true }],
  },
  success: {
    type: "success",
    label: "Success Stories",
    hasImage: true,
    fields: [
      { key: "title", label: "Client / project" },
      { key: "stat1", label: "Headline stat 1" },
      { key: "stat2", label: "Headline stat 2" },
      { key: "stat3", label: "Headline stat 3" },
      { key: "challenge", label: "Challenge" },
      { key: "solution", label: "Solution" },
      { key: "outcome", label: "Outcome" },
    ],
  },
  metrics: {
    type: "metrics",
    label: "What Success Looks Like",
    hasImage: true,
    fields: [
      { key: "marketing", label: "Marketing metrics", multiline: true },
      { key: "business", label: "Business metrics", multiline: true },
      { key: "executive", label: "Executive metrics", multiline: true },
    ],
  },
  engagement: {
    type: "engagement",
    label: "Recommended Engagement",
    hasImage: true,
    fields: [
      { key: "strategy", label: "Strategy", multiline: true },
      { key: "acquisition", label: "Acquisition", multiline: true },
      { key: "optimization", label: "Optimization", multiline: true },
    ],
  },
  nextsteps: {
    type: "nextsteps",
    label: "Next Steps",
    hasImage: false,
    fields: [
      { key: "step1_title", label: "Step 1 — title" },
      { key: "step1_sub", label: "Step 1 — detail" },
      { key: "step2_title", label: "Step 2 — title" },
      { key: "step2_sub", label: "Step 2 — detail" },
      { key: "step3_title", label: "Step 3 — title" },
      { key: "step3_sub", label: "Step 3 — detail" },
      { key: "step4_title", label: "Step 4 — title" },
      { key: "step4_sub", label: "Step 4 — detail" },
      { key: "closing", label: "Closing statement" },
    ],
  },
}
