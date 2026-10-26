import type { Metadata } from "next"

// The Brands area carries each brand's profile and brand book: staff only, never indexed (as /admin/brand).
export const metadata: Metadata = {
  title: "Brands",
  robots: { index: false, follow: false },
}

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children
}
