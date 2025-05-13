import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
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

  const collection = await getCollection(params.collection)
  if (!collection) return notFound()

  // Get all collections for the navbar dropdown
  const collections = await getCollections()

  // Get the banner image for this collection from our S3 bucket
  const bannerImage = getCollectionBannerImage(params.collection)

  // Get collection-specific configuration
  const collectionConfig = getCollectionConfig(params.collection, `/search/${params.collection}`)

  // Log collection handle for debugging
  console.log("Collection handle:", params.collection, "Config:", collectionConfig)

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
        imageSrc={bannerImage}
        ctaText={collectionConfig.ctaText}
        ctaLink={collectionConfig.ctaLink}
        overlayPosition={collectionConfig.overlayPosition}
        textColor={collectionConfig.textColor}
        buttonStyle={collectionConfig.buttonStyle}
        customButtonClasses={collectionConfig.customButtonClasses}
        logoSrc={collectionConfig.logoSrc}
        logoWidth={collectionConfig.logoWidth}
        logoHeight={collectionConfig.logoHeight}
        scrollToProducts={collectionConfig.scrollToProducts}
        hideDownArrow={collectionConfig.hideDownArrow}
        hideText={collectionConfig.hideText}
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
          <ProductsGrid productsPromise={productsPromise} />
        </Suspense>
      </div>
    </section>
  )
}

// Optimize ProductsGrid to use the promise we already started
async function ProductsGrid({
  productsPromise,
}: {
  productsPromise: Promise<any[]>
}) {
  const products = await productsPromise

  if (products.length === 0) {
    return <p className="py-3 text-lg text-white">No products found in this collection</p>
  }

  return (
    <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <ProductGridItems products={products} />
    </Grid>
  )
}