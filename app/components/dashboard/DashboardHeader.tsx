"use client"

import { motion } from "motion/react"
import { RefreshCw, Download, Share2 } from "lucide-react"

interface DashboardHeaderProps {
  title: string
  description: string
  onRefresh: () => void
  isLoading: boolean
}

export function DashboardHeader({ title, description, onRefresh, isLoading }: DashboardHeaderProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <motion.h1
            className="text-3xl font-bold text-white mb-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {title}
          </motion.h1>
          <motion.p
            className="text-white/60"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {description}
          </motion.p>
        </div>
        <motion.div
          className="flex items-center space-x-2 mt-4 md:mt-0"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 flex items-center space-x-2 transition-colors"
            onClick={() => {
              // Simulate download
              alert("Analytics report download started")
            }}
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 flex items-center space-x-2 transition-colors"
            onClick={() => {
              // Simulate share
              navigator.clipboard.writeText(window.location.href)
              alert("Dashboard URL copied to clipboard")
            }}
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <motion.div
              animate={isLoading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: isLoading ? Number.POSITIVE_INFINITY : 0, ease: "linear" }}
            >
              <RefreshCw className="h-5 w-5" />
            </motion.div>
          </motion.button>
        </motion.div>
      </div>

      <motion.div
        className="h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full mt-6"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
      />
    </motion.div>
  )
}
