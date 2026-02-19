"use client"

import Grid from "../grid"
import { GridTileImage } from "../grid/tile"
import type { Product } from "../../../lib/shopify/types"
import Link from "next/link"
import { motion } from "motion/react"

export default function ProductGridItems({ products }: { products: Product[] }) {
  return (
    <>
      {products.map((product, i) => (
        <motion.div
          key={product.handle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
        >
          <Grid.Item className="animate-fadeIn">
            <Link
              className="relative inline-block h-full w-full transform transition-all duration-300 hover:scale-105"
              href={`/product/${product.handle}`}
              prefetch={true}
            >
              <GridTileImage
                alt={product.title}
                label={{
                  title: product.title,
                  amount: product.priceRange.maxVariantPrice.amount,
                  currencyCode: product.priceRange.maxVariantPrice.currencyCode,
                }}
                src={product.featuredImage?.url}
                fill
                sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
            </Link>
          </Grid.Item>
        </motion.div>
      ))}
    </>
  )
}