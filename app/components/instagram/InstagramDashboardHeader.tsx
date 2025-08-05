"use client"

import { motion } from "motion/react"
import { RefreshCw, LogOut, Loader2 } from 'lucide-react'
import { Button } from "../../components/analytics/Button"

interface InstagramDashboardHeaderProps {
  connectionStatus: {
    success: boolean
    message?: string
    account?: {
      id: string
      username: string
      name: string
      followers_count: number
      follows_count: number
      media_count: number
    }
  } | null
  accountData: {
    username: string
    name: string
    profile_picture_url: string
  } | null
  onRefresh?: () => void
  onLogout?: () => void
  isLoading?: boolean
}

export function InstagramDashboardHeader({ 
  connectionStatus, 
  accountData,
  onRefresh = () => {},
  onLogout = () => {},
  isLoading = false
}: InstagramDashboardHeaderProps) {
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

      {/* Enhanced Floating Elements with Instagram Colors */}
      <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 bg-pink-400/20 rounded-full blur-2xl animate-pulse" />
      <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 bg-purple-400/25 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 bg-orange-400/20 rounded-full blur-2xl animate-pulse delay-500" />
      <div className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 bg-yellow-400/25 rounded-full blur-xl animate-pulse delay-700" />

      {/* Additional floating elements */}
      <div className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 bg-red-400/20 rounded-full blur-lg animate-pulse delay-300" />
      <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 bg-indigo-400/25 rounded-full blur-lg animate-pulse delay-900" />
      <div className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 bg-pink-400/20 rounded-full blur-lg animate-pulse delay-1200" />

      {/* Mobile Layout (< sm) */}
      <div className="relative z-10 flex flex-col gap-6 p-4 sm:hidden">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="p-3 bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <InstagramIcon className="h-6 w-6 text-pink-400" />
            </motion.div>
            {accountData?.profile_picture_url && (
              <img
                src={accountData.profile_picture_url || "/placeholder.svg"}
                alt={`${accountData.username} profile`}
                className="w-10 h-10 rounded-full border-2 border-pink-400/50"
              />
            )}
          </div>
          <div>
            <motion.h1
              className="text-lg font-bold text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Meta Insights
            </motion.h1>
            <motion.p
              className="text-white/60 text-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {accountData ? `@${accountData.username} - ${accountData.name}` : "Social media insights and engagement metrics"}
            </motion.p>
          </div>
        </motion.div>

        {/* Controls Section - Stacked on mobile */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          {/* Connection Status */}
          <div className="relative w-full">
            <div className={`bg-white/10 border rounded-lg px-4 py-2 text-sm backdrop-blur-sm flex items-center w-full ${
              connectionStatus?.success
                ? "border-green-500/20 text-green-200"
                : "border-red-500/20 text-red-200"
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                connectionStatus?.success ? "bg-green-400" : "bg-red-400"
              }`} />
              <span>{connectionStatus?.success ? "Connected" : "Disconnected"}</span>
            </div>
          </div>

          {/* Button Group - Full width on mobile */}
          <div className="flex gap-2 w-full">
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200 backdrop-blur-sm flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
              )}
              <span className="hidden xs:inline">Refresh</span>
            </Button>

            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 backdrop-blur-sm flex-1"
            >
              <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="hidden xs:inline">Logout</span>
              <span className="xs:hidden">Exit</span>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Desktop Layout (>= sm) - Original Layout Preserved */}
      <div className="relative z-10 hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-4 p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="p-3 bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <InstagramIcon className="h-8 w-8 text-pink-400" />
            </motion.div>
            {accountData?.profile_picture_url && (
              <img
                src={accountData.profile_picture_url || "/placeholder.svg"}
                alt={`${accountData.username} profile`}
                className="w-16 h-16 rounded-full border-2 border-pink-400/50"
              />
            )}
          </div>
          <div>
            <motion.h1
              className="text-xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Meta Insights
            </motion.h1>
            <motion.p
              className="text-white/60 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {accountData ? `@${accountData.username} - ${accountData.name}` : "Social media insights and engagement metrics"}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          {/* Connection Status */}
          <div className={`bg-white/10 border rounded-lg px-4 py-2 text-sm backdrop-blur-sm flex items-center ${
            connectionStatus?.success
              ? "border-green-500/20 text-green-200"
              : "border-red-500/20 text-red-200"
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus?.success ? "bg-green-400" : "bg-red-400"
            }`} />
            <span>{connectionStatus?.success ? "Connected" : "Disconnected"}</span>
          </div>

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

      {/* Connection Status Message */}
      {connectionStatus?.message && (
        <div className="relative z-10 mx-4 sm:mx-8 mb-4">
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-600">
            <p className="text-slate-300 text-sm">{connectionStatus.message}</p>
          </div>
        </div>
      )}

      {/* Animated gradient line at bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </div>
  )
}

// instagram svg icon
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 00-2.124 1.388 5.878 5.878 0 00-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 002.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 002.123-1.388 5.881 5.881 0 001.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 00-1.387-2.123 5.857 5.857 0 00-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 01-1.382-.895 3.695 3.695 0 01-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 011.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 01-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 101.437-1.442 1.44 1.44 0 00-1.437 1.442M5.839 12.012a6.161 6.161 0 1012.323-.024 6.162 6.162 0 00-12.323.024M8 12.008A4 4 0 1112.008 16 4 4 0 018 12.008" />
    </svg>
  )
}