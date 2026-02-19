import { Suspense } from "react"
import { defaultSort, sorting } from "@/lib/constants"
import { getProducts, getCollections } from "@/lib/shopify"
import Grid from "@/components/shopify/grid"
import ProductGridItems from "@/components/shopify/layout/product-grid-items"
import { CollectionNavbar } from "@/components/shopify/collection-navbar"
import { Skeleton } from "@/components/shopify/skeleton"

export const metadata = {
  title: "Search | 434 MEDIA Store",
  description: "Search for products in the store.",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const { sort, q: searchValue } = searchParams as { [key: string]: string }
  const { sortKey, reverse } = sorting.find((item) => item.slug === sort) || defaultSort

  const products = await getProducts({ sortKey, reverse, query: searchValue })
  const collections = await getCollections()
  const resultsText = products.length > 1 ? "results" : "result"

  return (
    <>
      <CollectionNavbar collections={collections} sortOptions={sorting} currentCollection="" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {searchValue ? (
          <p className="mb-4">
            {products.length === 0
              ? "There are no products that match "
              : `Showing ${products.length} ${resultsText} for `}
            <span className="font-bold">&quot;{searchValue}&quot;</span>
          </p>
        ) : null}

        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          }
        >
          {products.length > 0 ? (
            <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <ProductGridItems products={products} />
            </Grid>
          ) : null}
        </Suspense>
      </div>
    </>
  )
}