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


/* import { InteractiveShopHero } from "../../components/interactive-shop-hero"
import { getCollections } from "lib/shopify"

export const dynamic = "force-static" // Force static generation for faster loads
export const revalidate = 3600 // Revalidate every hour

export default async function ShopPage() {
  // Get collections for our interactive hotspots
  const collections = await getCollections()

  // Fallback: if collections is empty, use a default object
  const fallbackCollection = {
    handle: "default",
    title: "Default Collection",
    description: "",
    image: undefined,
    path: "/",
    seo: { title: "Default SEO Title", description: "Default SEO Description" }, // Add default SEO
    updatedAt: new Date().toISOString(), // Add updatedAt with current timestamp
  }

  const frameOneCollection = collections.find((c) => c.handle === "434-media") ?? collections[0] ?? fallbackCollection
  const frameTwoCollection = collections.find((c) => c.handle === "vemosvamos") ?? collections[0] ?? fallbackCollection
  const computerCollection = collections.find((c) => c.handle === "devsa") ?? collections[0] ?? fallbackCollection
  const boxingCollection = collections.find((c) => c.handle === "txmx-boxing") ?? collections[0] ?? fallbackCollection

  return (
    <InteractiveShopHero
      frameOneCollection={frameOneCollection}
      frameTwoCollection={frameTwoCollection}
      computerCollection={computerCollection}
      boxingCollection={boxingCollection}
    />
  )
} */