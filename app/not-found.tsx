import NotFound from "next/dist/client/components/builtin/not-found"
import { PublicShell } from "@/components/PublicShell"

/**
 * Unmatched URLs render inside the root layout, which no longer carries the
 * public chrome. Wrapping Next's own 404 in PublicShell keeps the page a visitor
 * sees — navbar, footer, trackers — as it was before the layout split
 * (2b fix 9).
 */
export default function RootNotFound() {
  return (
    <PublicShell>
      <NotFound />
    </PublicShell>
  )
}
