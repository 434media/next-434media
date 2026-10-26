import { BRAND_STATE_LABEL, type BrandState } from "@/lib/content-pipeline/brand-status"

const STATE_STYLE: Record<BrandState, string> = {
  live: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  not_started: "bg-neutral-100 text-neutral-600 border-neutral-200",
}

/** A brand's status in the Brands area: Live, Being set up, or Not started. */
export function BrandStateBadge({ state }: { state: BrandState }) {
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATE_STYLE[state]}`}>{BRAND_STATE_LABEL[state]}</span>
}
