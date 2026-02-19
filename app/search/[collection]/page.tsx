import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import type { Product } from "@/lib/shopify/types"
import { getCollection } from "@/lib/shopify"
import { safeGetCollectionProducts } from "@/lib/safe-fetch"
import { defaultSort, sorting } from "@/lib/constants"
import { getCollectionBannerImage } from "@/lib/collection-images"
import { getCollections } from "@/lib/shopify"
import { getCollectionConfig } from "@/lib/collection-config"
import Grid from "@/components/shopify/grid"
import { CollectionBanner } from "@/components/shopify/collection-banner"
import { Skeleton } from "@/components/shopify/skeleton"
import { CollectionNavbar } from "@/components/shopify/collection-navbar"
import { EmptyCollectionState } from "@/components/shopify/empty-collection-state"
import ClientProductGrid from "@/components/shopify/client-product-grid"
import Image from "next/image"
import { ProductProvider } from "@/components/shopify/product/product-context"
import { ProductImageCarousel, ProductInfoSidebar } from "@/components/shopify/txmx-product-carousel"

export const revalidate = 3600 // Revalidate every hour

export async function generateMetadata({ params }: { params: { collection: string } }): Promise<Metadata> {
  const collection = await getCollection(params.collection)

  if (!collection) return notFound()

  return {
    title: collection.seo?.title || collection.title,
    description: collection.seo?.description || collection.description || `${collection.title} products`,
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { collection: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const { sort } = (searchParams || {}) as { [key: string]: string }
  const { sortKey, reverse } = sorting.find((item) => item.slug === sort) || defaultSort

  // Safely get collection with error handling
  let collection
  try {
    collection = await getCollection(params.collection)
    if (!collection) return notFound()
  } catch (error) {
    console.error(`Error fetching collection ${params.collection}:`, error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <h1 className="text-2xl font-bold mb-4">Collection Not Available</h1>
        <p className="text-gray-600 mb-6">We're having trouble loading this collection. Please try again later.</p>
        <a href="/search" className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
          Browse All Collections
        </a>
      </div>
    )
  }

  // Get all collections for the navbar dropdown
  const collections = await getCollections()

  // Get the banner image for this collection from our S3 bucket
  const bannerImage = getCollectionBannerImage(params.collection)

  // Get collection-specific configuration
  const collectionConfig = getCollectionConfig(params.collection, `/search/${params.collection}`)

  // Prefetch products data to avoid waterfall
  const productsPromise = safeGetCollectionProducts({
    collection: params.collection,
    sortKey,
    reverse,
  })

  // Check if this is the TXMX Boxing collection to show special hero
  const isTXMXCollection = params.collection === "txmx-boxing"

  if (isTXMXCollection) {
    return (
      <section className="bg-black">
        {/* TXMX Hero Section - Properly Centered */}
        <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center">
          {/* Subtle Animated Background Elements */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-white/10 rotate-45 animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 border border-white/5 rotate-12 animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 right-1/3 w-32 h-32 border border-white/8 -rotate-12 animate-pulse delay-500"></div>
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900/30 to-black"></div>

          {/* Hero Content - Centered */}
          <div className="container mx-auto px-4 relative z-10 w-full">
            {/* Mobile-First Layout: Stack vertically on mobile, side-by-side on desktop */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-12 lg:items-center">
              {/* Product Carousel - Full width on mobile, left side on desktop */}
              <div className="flex items-center justify-center lg:justify-end order-1 lg:order-1">
                <Suspense
                  fallback={
                    <div className="w-full max-w-sm lg:max-w-md">
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 animate-pulse">
                        <div className="aspect-square w-full bg-white/5 rounded-lg"></div>
                      </div>
                    </div>
                  }
                >
                  <ProductCarouselLeft productsPromise={productsPromise} />
                </Suspense>
              </div>

              {/* Product Information - Full width on mobile, right side on desktop */}
              <div className="flex items-center justify-center lg:justify-start order-2 lg:order-2">
                <Suspense
                  fallback={
                    <div className="w-full max-w-lg space-y-6">
                      <div className="h-12 bg-white/10 rounded animate-pulse"></div>
                      <div className="h-16 bg-white/5 rounded animate-pulse"></div>
                      <div className="h-10 bg-white/10 rounded w-1/3 animate-pulse"></div>
                      <div className="h-16 bg-white/10 rounded animate-pulse"></div>
                    </div>
                  }
                >
                  <ProductInfoRight productsPromise={productsPromise} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        {/* TXMX Logo Section Below Hero - Clean Logo Only */}
        <div className="bg-black py-8 sm:py-12 lg:py-16">
          <div className="container mx-auto px-4">
            <div className="flex justify-center">
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg"
                alt="TXMX Boxing - Premium Boxing Merchandise"
                width={600}
                height={240}
                className="w-96 sm:w-[500px] md:w-[600px] h-auto"
                priority={false}
                sizes="(max-width: 640px) 384px, (max-width: 768px) 500px, 600px"
              />
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Default collection layout for non-TXMX collections
  return (
    <section>
      <CollectionBanner
        title={collectionConfig.title || collection.title}
        description={
          collectionConfig.description || collection.description || `Explore our ${collection.title} collection`
        }
        image={bannerImage}
        ctaText="Shop Now"
        scrollToProducts={true}
        hideDownArrow={true}
        hideText={true}
        overlayPosition={collectionConfig.overlayPosition}
        textColor={collectionConfig.textColor}
        buttonStyle={collectionConfig.buttonStyle}
        customButtonClasses={collectionConfig.customButtonClasses}
        logoSrc={collectionConfig.logoSrc}
        logoWidth={collectionConfig.logoWidth}
        logoHeight={collectionConfig.logoHeight}
      />

      <CollectionNavbar collections={collections} sortOptions={sorting} currentCollection={params.collection} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 products-section" id="products-section">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          }
        >
          <ProductsGrid productsPromise={productsPromise} collectionName={collection.title} />
        </Suspense>
      </div>
    </section>
  )
}

// Component to display product carousel on the left side for TXMX
async function ProductCarouselLeft({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  let products: Product[] = []
  try {
    products = await productsPromise
  } catch (error) {
    console.error("Error resolving products promise:", error)
  }

  if (products.length === 0) {
    return (
      <div className="w-full max-w-sm lg:max-w-md text-center text-gray-400">
        <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/20 p-8">
          <p className="text-white/60">Product coming soon...</p>
        </div>
      </div>
    )
  }

  return (
    <ProductProvider>
      <div className="w-full max-w-sm lg:max-w-md">
        {/* Updated carousel container with drop badge styling */}
        <div className="border-2 border-white bg-black relative overflow-hidden group cursor-pointer transition-all duration-500 hover:shadow-2xl hover:shadow-white/10">
          {/* Sliding Background Effect - Same as drop badge */}
          <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

          {/* Product Image Carousel */}
          <div className="relative z-10">
            <ProductImageCarousel products={products} />
          </div>
        </div>
      </div>
    </ProductProvider>
  )
}

// Component to display product info on the right side for TXMX
async function ProductInfoRight({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>
}) {
  let products: Product[] = []
  try {
    products = await productsPromise
  } catch (error) {
    console.error("Error resolving products promise:", error)
  }

  if (products.length === 0) {
    return (
      <div className="w-full max-w-lg text-center text-white/60">
        <p>Product information coming soon...</p>
      </div>
    )
  }

  return (
    <ProductProvider>
      <div className="w-full max-w-lg px-4 lg:px-0">
        <ProductInfoSidebar products={products} />
      </div>
    </ProductProvider>
  )
}

// Default products grid for other collections
async function ProductsGrid({
  productsPromise,
  collectionName,
}: {
  productsPromise: Promise<Product[]>
  collectionName: string
}) {
  let products: Product[] = []
  try {
    products = await productsPromise
  } catch (error) {
    console.error("Error resolving products promise:", error)
  }

  if (products.length === 0) {
    return <EmptyCollectionState collectionName={collectionName} />
  }

  return (
    <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <ClientProductGrid products={products} />
    </Grid>
  )
}
