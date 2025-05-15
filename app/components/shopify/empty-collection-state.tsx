"use client"

import { motion } from "framer-motion"
import { PackageOpen } from "lucide-react"
import Link from "next/link"

interface EmptyCollectionStateProps {
  collectionName: string
}

export function EmptyCollectionState({ collectionName }: EmptyCollectionStateProps) {
  return (
    <div className="w-full py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto text-center px-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
          className="mb-8 flex justify-center"
        >
          <div className="relative">
            <PackageOpen size={80} className="text-neutral-800" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl md:text-4xl font-bold mb-4"
        >
          Coming Soon to {collectionName}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-neutral-600 mb-8"
        >
          We're working on something special for this collection. Check back soon for new products!
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/search"
            className="px-6 py-3 bg-black hover:bg-neutral-800 text-white rounded-lg font-medium transition-all"
          >
            Browse Other Collections
          </Link>

          <Link href="/" className="px-6 py-3 text-neutral-600 hover:text-neutral-800 font-medium transition-all">
            Return to Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
