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
  /** Whether this layout renders a swappable image panel. */
  hasImage: boolean
  fields: SlideField[]
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
    hasImage: false,
    fields: [
      { key: "budget", label: "Budget" },
      { key: "geography", label: "Geography" },
      { key: "channels", label: "Media channels", multiline: true },
      { key: "audience", label: "Target audience" },
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
      { key: "geography", label: "Geography" },
      { key: "notes", label: "Additional notes" },
    ],
  },
  flow: {
    type: "flow",
    label: "Customer Flow Journey",
    hasImage: true,
    fields: [{ key: "steps", label: "Steps (one per line)", multiline: true }],
  },
  success: {
    type: "success",
    label: "Success Stories",
    hasImage: true,
    fields: [
      { key: "title", label: "Client / project" },
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
      { key: "kpi1", label: "KPI 1" },
      { key: "kpi2", label: "KPI 2" },
      { key: "kpi3", label: "KPI 3" },
      { key: "budget", label: "Budget" },
      { key: "channels", label: "Channels" },
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
      { key: "step1", label: "Step 1" },
      { key: "step2", label: "Step 2" },
      { key: "step3", label: "Step 3" },
      { key: "closing", label: "Closing statement" },
    ],
  },
}
