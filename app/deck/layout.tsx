import type React from "react"
import { PublicShell } from "@/components/PublicShell"

/**
 * Shared decks get the public shell like app/(site), but live outside the route
 * group: Next suffixes metadata image routes inside a group with a hash, which
 * would have moved /deck/[shareId]/opengraph-image and broken the preview image
 * on deck links already shared (2b fix 9).
 */
export default function DeckLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>
}
