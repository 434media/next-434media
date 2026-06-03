// The selectable audiences for a branded Resend broadcast (Phase 2).
//
// Each selector matches against a recipient's CANONICAL tags (the same tags the
// auto-sync intent functions produce), so "who's in this audience" is defined
// once and shared by the recipient builder and the /admin/broadcasts UI.
//
// Partner lists are COLD by default and excluded from broadcasts — they don't
// flow through the consent-intent functions, so they only ever become
// broadcast-eligible when (a) the partner confirms opt-in AND (b) an explicit
// selector is added here. The recipient builder tags partner members
// `partner:<slug>`, so a partner with no selector below can never be emailed.
// Alamo Angels confirmed opt-in to the 434 Media network (2026-06-03).

export interface AudienceSelector {
  id: string
  label: string
  /** True when a recipient's canonical tag set belongs to this audience. */
  match: (tags: string[]) => boolean
}

export const BROADCAST_AUDIENCES: AudienceSelector[] = [
  {
    id: "aim-newsletter",
    label: "AIM newsletter",
    match: (t) => t.includes("brand:aim") && t.includes("source:newsletter"),
  },
  {
    id: "aim-2026",
    label: "AIM 2026",
    match: (t) => t.includes("event:aim-summit-2026"),
  },
  {
    id: "sa-tech-day-2026",
    label: "SA Tech Day 2026",
    match: (t) => t.includes("event:sa-tech-day") || t.includes("event:sa-tech-day-2026"),
  },
  {
    id: "nucleate-tx-sxsw",
    label: "Nucleate TX @ SXSW",
    match: (t) => t.includes("event:nucleate-tx-sxsw-2026"),
  },
  {
    id: "rise-of-a-champion",
    label: "Rise of a Champion",
    match: (t) => t.includes("event:rise-of-a-champion-2026"),
  },
  {
    id: "alamo-angels",
    label: "Alamo Angels",
    // Partner cohort — opted in to the 434 Media network (confirmed 2026-06-03).
    // Members are tagged `partner:alamo-angels` by the recipient builder.
    match: (t) => t.includes("partner:alamo-angels"),
  },
]
