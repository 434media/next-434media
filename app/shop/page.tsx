import type { Metadata } from "next"
import ShopComingSoon from "../components/ShopComingSoon"

export const metadata: Metadata = {
  title: "Shop Coming Soon | 434 MEDIA",
  description:
    "Our exclusive merchandise shop is coming soon. Sign up to be notified when we launch and get early access to limited edition items.",
  openGraph: {
    title: "Shop Coming Soon | 434 MEDIA",
    description:
      "Our exclusive merchandise shop is coming soon. Sign up to be notified when we launch and get early access to limited edition items.",
    images: [
      {
        url: "/shop-coming-soon-og.jpg",
        width: 1200,
        height: 630,
        alt: "434 MEDIA Shop Coming Soon",
      },
    ],
  },
}

export default function ShopPage() {
  return (
    <main className="flex-1">
      <ShopComingSoon />
    </main>
  )
}
