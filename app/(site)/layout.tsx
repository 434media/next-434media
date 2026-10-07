import type React from "react"
import { PublicShell } from "@/components/PublicShell"

/** Public pages without the store: chrome, trackers and structured data, no cart. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>
}
