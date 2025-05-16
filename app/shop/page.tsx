import type { Metadata } from "next"
import { VideoHero } from "../components/shopify/video-hero"
import { getCollections } from "../lib/shopify"

export const dynamic = "force-static" // Force static generation for faster loads
export const revalidate = 3600 // Revalidate every hour

export const metadata: Metadata = {
  title: "434 MEDIA Shop | Exclusive Merchandise",
  description: "Shop exclusive 434 MEDIA merchandise featuring TXMX Boxing, DEVSA, and Vemos Vamos collections.",
  openGraph: {
    title: "434 MEDIA Shop | Exclusive Merchandise",
    description: "Shop exclusive 434 MEDIA merchandise featuring TXMX Boxing, DEVSA, and Vemos Vamos collections.",
    images: [
      {
        url: "/shop-coming-soon-og.jpg",
        width: 1200,
        height: 630,
        alt: "434 MEDIA Shop",
      },
    ],
  },
}

export default async function ShopPage() {
  // Get collections for our interactive hotspots
  const collections = await getCollections()

  // Fallback: if collections is empty, use a default object
  const fallbackCollection = {
    handle: "default",
    title: "Default Collection",
    description: "",
    image: undefined,
    path: "/search/all",
    seo: { title: "Default SEO Title", description: "Default SEO Description" },
    updatedAt: new Date().toISOString(),
  }

  // Get the specific collections featured in the video
  const txmxCollection = collections.find((c) => c.handle === "txmx-boxing") ?? collections[0] ?? fallbackCollection
  const devsaCollection = collections.find((c) => c.handle === "devsa") ?? collections[1] ?? fallbackCollection
  const vemosVamosCollection =
    collections.find((c) => c.handle === "vemosvamos") ?? collections[2] ?? fallbackCollection

  return (
    <main className="flex-1">
      <VideoHero
        videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/434_SHOP_1080_V001.mp4"
        featuredCollection={txmxCollection}
        secondaryCollection={vemosVamosCollection}
        tertiaryCollection={devsaCollection}
        allCollectionsPath="/search"
        ctaText="Shop Collections"
      />
    </main>
  )
}
