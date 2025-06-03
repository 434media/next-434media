"use client"

import { motion } from "motion/react"
import { BarChart3, Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-8"
      >
        {/* Logo Animation */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center"
        >
          <BarChart3 className="h-10 w-10 text-emerald-400" />
        </motion.div>

        {/* Loading Text */}
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl font-bold text-white"
          >
            Loading Dashboard
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-white/70 text-lg"
          >
            Preparing your analytics data...
          </motion.p>
        </div>

        {/* Loading Spinner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center justify-center gap-2"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          >
            <Loader2 className="h-6 w-6 text-emerald-400" />
          </motion.div>
          <span className="text-white/60">Loading...</span>
        </motion.div>

        {/* Progress Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex items-center justify-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, delay: i * 0.2 }}
              className="w-2 h-2 bg-emerald-400 rounded-full"
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
