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

// Define RelatedProducts component with TXMX styling
async function RelatedProducts({ id }: { id: string }) {
  const relatedProducts = await getProductRecommendations(id)

  if (!relatedProducts.length) return null

  return (
    <div className="py-12 lg:py-16">
      <div className="mb-8">
        <h2 className="text-3xl lg:text-4xl font-black tracking-wider text-white uppercase">Related Products</h2>
        <div className="h-1 bg-white w-32 mt-3"></div>
      </div>
      <ul className="flex w-full gap-6 overflow-x-auto pt-1">
        {relatedProducts.map((product) => (
          <li
            key={product.handle}
            className="aspect-square w-full flex-none min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5"
          >
            <Link className="relative h-full w-full group" href={`/product/${product.handle}`} prefetch={true}>
              <div className="border-2 border-white bg-black relative overflow-hidden h-full transition-all duration-500 hover:shadow-2xl hover:shadow-white/10">
                <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <div className="relative z-10 h-full">
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
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Main ProductPage component with updated TXMX styling and responsive layout
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

      {/* TXMX-styled product page with black background */}
      <div className="bg-black min-h-screen">
        {/* Fixed height container to fit everything in viewport */}
        <div className="h-screen flex flex-col">
          {/* Main product container - takes remaining space */}
          <div className="flex-1 flex flex-col px-4 pt-20 pb-4">
            <div className="relative border-2 border-white bg-black p-4 md:p-6 lg:p-8 flex-1 flex flex-col max-w-7xl mx-auto w-full">
              {/* Back button with TXMX styling */}
              <div className="absolute top-4 left-4 z-20">
                <BackButton />
              </div>

              {/* Desktop Layout (lg and up) */}
              <div className="hidden lg:flex flex-1 min-h-0">
                <div className="grid grid-cols-12 gap-8 w-full min-h-0">
                  {/* Left Column - Product Gallery (7 columns) */}
                  <div className="col-span-7 min-h-0">
                    <div className="border-2 border-white bg-black relative overflow-hidden h-full">
                      <Suspense
                        fallback={
                          <div className="relative w-full h-full overflow-hidden bg-black border border-white/20">
                            <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
                          </div>
                        }
                      >
                        <Gallery
                          images={product.images.slice(0, 5).map((image: Image) => ({
                            src: image.url,
                            altText: image.altText,
                          }))}
                        />
                      </Suspense>
                    </div>
                  </div>

                  {/* Right Column - Product Info with Description at Top (5 columns) */}
                  <div className="col-span-5 flex flex-col min-h-0">
                    <Suspense
                      fallback={
                        <div className="space-y-6 flex-1">
                          <div className="h-12 bg-white/10 animate-pulse"></div>
                          <div className="h-16 bg-white/5 animate-pulse"></div>
                          <div className="h-10 bg-white/10 animate-pulse w-1/3"></div>
                          <div className="h-16 bg-white/10 animate-pulse"></div>
                        </div>
                      }
                    >
                      <ProductDescription product={product} isDesktop={true} />
                    </Suspense>
                  </div>
                </div>
              </div>

              {/* Mobile/Tablet Layout (below lg) */}
              <div className="lg:hidden flex-1 flex flex-col min-h-0">
                <div className="flex flex-col gap-6 h-full">
                  {/* Product Gallery - Fixed height on mobile */}
                  <div className="w-full flex-shrink-0">
                    <div className="border-2 border-white bg-black relative overflow-hidden aspect-square max-h-[50vh]">
                      <Suspense
                        fallback={
                          <div className="relative aspect-square w-full overflow-hidden bg-black border border-white/20">
                            <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
                          </div>
                        }
                      >
                        <Gallery
                          images={product.images.slice(0, 5).map((image: Image) => ({
                            src: image.url,
                            altText: image.altText,
                          }))}
                        />
                      </Suspense>
                    </div>
                  </div>

                  {/* Product Information - Scrollable if needed */}
                  <div className="w-full flex-1 min-h-0 overflow-y-auto">
                    <Suspense
                      fallback={
                        <div className="space-y-6">
                          <div className="h-12 bg-white/10 animate-pulse"></div>
                          <div className="h-16 bg-white/5 animate-pulse"></div>
                          <div className="h-10 bg-white/10 animate-pulse w-1/3"></div>
                          <div className="h-16 bg-white/10 animate-pulse"></div>
                        </div>
                      }
                    >
                      <ProductDescription product={product} />
                    </Suspense>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Related Products - Hidden on main product view to save space */}
          <div className="hidden">
            <RelatedProducts id={product.id} />
          </div>
        </div>
      </div>
    </ProductProvider>
  )
}
