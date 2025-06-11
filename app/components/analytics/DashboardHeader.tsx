"use client"

import { motion } from "motion/react"
import { Button } from "./Button"
import { RefreshCw, LogOut, Loader2, BarChart3 } from "lucide-react"

interface DashboardHeaderProps {
  onRefresh: () => void
  onLogout: () => void
  isLoading?: boolean
}

export function DashboardHeader({ onRefresh, onLogout, isLoading = false }: DashboardHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 mb-8">
      {/* Sophisticated 434 Media Logo Pattern with Enhanced Contrast */}
      <div className="absolute inset-0 opacity-[0.08] sm:opacity-[0.12] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 sm:bg-[length:140px_140px]"
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "80px 80px",
            backgroundRepeat: "repeat",
            backgroundPosition: "0 0",
            animation: "float 25s ease-in-out infinite",
            filter: "brightness(1.2) contrast(1.1)",
          }}
        />
      </div>

      {/* Enhanced Floating Elements with Green/Blue/Purple */}
      <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
      <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 bg-blue-400/25 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 bg-purple-400/20 rounded-full blur-2xl animate-pulse delay-500" />
      <div className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 bg-teal-400/25 rounded-full blur-xl animate-pulse delay-700" />

      {/* Additional floating elements */}
      <div className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 bg-cyan-400/20 rounded-full blur-lg animate-pulse delay-300" />
      <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 bg-indigo-400/25 rounded-full blur-lg animate-pulse delay-900" />
      <div className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 bg-green-400/20 rounded-full blur-lg animate-pulse delay-1200" />

      {/* Main Header Content */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <motion.div
            className="p-3 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <BarChart3 className="h-8 w-8 text-blue-400" />
          </motion.div>
          <div>
            <motion.h1
              className="text-xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Analytics Dashboard
            </motion.h1>
            <motion.p
              className="text-white/60 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Real-time insights and performance metrics
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200 backdrop-blur-sm"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>

          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 backdrop-blur-sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </motion.div>
      </div>

      {/* Animated gradient line at bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </div>
  )
}
