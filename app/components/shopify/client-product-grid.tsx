"use client"

import dynamic from "next/dynamic"
import type { Product } from "../../../app/lib/shopify/types"
import { Skeleton } from "./skeleton"

// Dynamically import ProductGridItems to avoid SSR issues
const ProductGridItems = dynamic(() => import("./layout/product-grid-items"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
  ),
})

interface ClientProductGridProps {
  products: Product[]
}

export default function ClientProductGrid({ products }: ClientProductGridProps) {
  return <ProductGridItems products={products} />
}
