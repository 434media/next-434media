// The selectable audiences for a branded Resend broadcast (Phase 2).
//
// Each selector matches against a recipient's CANONICAL tags (the same tags the
// auto-sync intent functions produce), so "who's in this audience" is defined
// once and shared by the recipient builder and the /admin/broadcasts UI.
//
// Cold/partner lists (e.g. Alamo Angels) are intentionally NOT here — they never
// opted in, so they're excluded from broadcasts by design and handled 1:1.

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
]
