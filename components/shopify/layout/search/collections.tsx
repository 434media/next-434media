import { Suspense } from "react"
import { getCollections } from "../../../../lib/shopify"
import FilterList from "./filter"

async function CollectionList() {
  const collections = await getCollections()
  return <FilterList list={collections} title="Collections" />
}

export default function Collections() {
  return (
    <Suspense
      fallback={
        <div className="py-2">
          <div className="h-5 w-24 bg-neutral-700 animate-pulse rounded-md mb-3"></div>
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-full bg-neutral-700 animate-pulse rounded-md"></div>
            ))}
          </div>
        </div>
      }
    >
      <CollectionList />
    </Suspense>
  )
}