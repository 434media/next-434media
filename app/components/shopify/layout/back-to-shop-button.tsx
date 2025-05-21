"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function BackToShopButton() {
  return (
    <Link href="/shop">
      <motion.button
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        aria-label="Back to shop"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Shop
      </motion.button>
    </Link>
  )
}