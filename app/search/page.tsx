import { Suspense } from "react"
import { defaultSort, sorting } from "../lib/constants"
import { getProducts, getCollections } from "../lib/shopify"
import Grid from "../components/grid"
import ProductGridItems from "components/layout/product-grid-items"
import { CollectionNavbar } from "components/collection-navbar"
import { Skeleton } from "../../components/ui/skeleton"

export const metadata = {
  title: "Search",
  description: "Search for products in the store.",
}

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
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