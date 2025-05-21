import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import type { Product } from "../../lib/shopify/types"
import { getCollection } from "../../lib/shopify"
import { safeGetCollectionProducts } from "../../lib/safe-fetch"
import { defaultSort, sorting } from "../../lib/constants"
import { getCollectionBannerImage } from "../../lib/collection-images"
import { getCollections } from "../../lib/shopify"
import { getCollectionConfig } from "../../lib/collection-config"
import Grid from "../../components/shopify/grid"
import ProductGridItems from "../../components/shopify/layout/product-grid-items"
import { CollectionBanner } from "../../components/shopify/collection-banner"
import { Skeleton } from "../../components/shopify/skeleton"
import { CollectionNavbar } from "../../components/shopify/collection-navbar"
import { EmptyCollectionState } from "../../components/shopify/empty-collection-state"

export const dynamic = "force-static" // Force static generation for faster loads
export const revalidate = 3600 // Revalidate every hour

export async function generateMetadata(props: {
  params: Promise<{ collection: string }>
}): Promise<Metadata> {
  const params = await props.params
  const collection = await getCollection(params.collection)

  if (!collection) return notFound()

  return {
    title: collection.seo?.title || collection.title,
    description: collection.seo?.description || collection.description || `${collection.title} products`,
  }
}

export default async function CategoryPage(props: {
  params: Promise<{ collection: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { sort } = searchParams as { [key: string]: string }
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
        <p className="text-gray-600 mb-6">We&apos;re having trouble loading this collection. Please try again later.</p>
        <Link href="/search" className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
          Browse All Collections
        </Link>
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

      {/* Add products-section class for scroll target */}
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

// Optimize ProductsGrid to use the promise we already started
async function ProductsGrid({
  productsPromise,
  collectionName,
}: {
  productsPromise: Promise<Product[]>
  collectionName: string
}) {
  // Add error handling for the products promise
  let products: Product[] = []
  try {
    products = await productsPromise
  } catch (error) {
    console.error("Error resolving products promise:", error)
    // Continue with empty products array
  }

  if (products.length === 0) {
    return <EmptyCollectionState collectionName={collectionName} />
  }

  return (
    <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <ProductGridItems products={products} />
    </Grid>
  )
}
