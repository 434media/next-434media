import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { HIDDEN_PRODUCT_TAG } from "../../lib/constants"
import { getProduct, getProductRecommendations } from "../../lib/shopify"
import type { Image } from "../../lib/shopify/types"
import { GridTileImage } from "../../components/shopify/grid/tile"
import { Gallery } from "../../components/shopify/product/gallery"
import { ProductProvider } from "../../components/shopify/product/product-context"
import { ProductDescription } from "../../components/shopify/product/product-description"
import { BackButton } from "../../components/shopify/product/back-button"

export async function generateMetadata(props: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const params = await props.params
  const product = await getProduct(params.handle)

  if (!product) return notFound()

  const { url, width, height, altText: alt } = product.featuredImage || {}
  const indexable = !product.tags.includes(HIDDEN_PRODUCT_TAG)

  return {
    title: product.seo.title || product.title,
    description: product.seo.description || product.description,
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
      },
    },
    openGraph: url
      ? {
          images: [
            {
              url,
              width,
              height,
              alt,
            },
          ],
        }
      : null,
  }
}

// Define RelatedProducts component first
async function RelatedProducts({ id }: { id: string }) {
  const relatedProducts = await getProductRecommendations(id)

  if (!relatedProducts.length) return null

  return (
    <div className="py-8">
      <h2 className="mb-4 text-2xl font-bold text-white">Related Products</h2>
      <ul className="flex w-full gap-4 overflow-x-auto pt-1">
        {relatedProducts.map((product) => (
          <li
            key={product.handle}
            className="aspect-square w-full flex-none min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5"
          >
            <Link className="relative h-full w-full" href={`/product/${product.handle}`} prefetch={true}>
              <GridTileImage
                alt={product.title}
                label={{
                  title: product.title,
                  amount: product.priceRange.maxVariantPrice.amount,
                  currencyCode: product.priceRange.maxVariantPrice.currencyCode,
                }}
                src={product.featuredImage?.url}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, (min-width: 475px) 50vw, 100vw"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Then define the main ProductPage component
export default async function ProductPage(props: { params: Promise<{ handle: string }> }) {
  const params = await props.params
  const product = await getProduct(params.handle)

  if (!product) return notFound()

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.featuredImage.url,
    offers: {
      "@type": "AggregateOffer",
      availability: product.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      priceCurrency: product.priceRange.minVariantPrice.currencyCode,
      highPrice: product.priceRange.maxVariantPrice.amount,
      lowPrice: product.priceRange.minVariantPrice.amount,
    },
  }

  return (
    <ProductProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />
      {/* Added mt-20 to fix navbar overlap issue */}
      <div className="mx-auto max-w-(--breakpoint-2xl) px-4 pt-28 md:pt-32">
        <div className="relative flex flex-col rounded-lg border border-neutral-700 bg-black p-4 md:p-6 lg:p-8 lg:flex-row lg:gap-8">
          {/* Back button */}
          <BackButton />

          <div className="h-full w-full basis-full lg:basis-3/5">
            <Suspense fallback={<div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden" />}>
              <Gallery
                images={product.images.slice(0, 5).map((image: Image) => ({
                  src: image.url,
                  altText: image.altText,
                }))}
              />
            </Suspense>
          </div>

          <div className="basis-full lg:basis-2/5 mt-8 lg:mt-0">
            <Suspense fallback={null}>
              <ProductDescription product={product} />
            </Suspense>
          </div>
        </div>
        <RelatedProducts id={product.id} />
      </div>
    </ProductProvider>
  )
}
