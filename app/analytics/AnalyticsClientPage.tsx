"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import AdminPasswordModal from "../components/AdminPasswordModal"
import { DashboardHeader } from "../components/analytics/DashboardHeader"
import { DateRangeSelector } from "../components/analytics/DateRangeSelector"
import { MetricsOverview } from "../components/analytics/MetricsOverview"
import { PageViewsChart } from "../components/analytics/PageViewsChart"
import { TopPagesTable } from "../components/analytics/TopPagesTable"
import { TrafficSourcesChart } from "../components/analytics/TrafficSourcesChart"
import { DeviceBreakdown } from "../components/analytics/DeviceBreakdown"
import { GeographicMap } from "../components/analytics/GeographicMap"
import type { DateRange } from "../types/analytics"

export default function AnalyticsClientPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({
    startDate: "30daysAgo",
    endDate: "today",
    label: "Last 30 days",
  })
  const [error, setError] = useState<string | null>(null)

  // Check for existing admin session
  useEffect(() => {
    const adminKey = sessionStorage.getItem("adminKey")
    if (adminKey) {
      setIsAuthenticated(true)
    }
  }, [])

  const handleVerified = (password: string) => {
    sessionStorage.setItem("adminKey", password)
    setIsAuthenticated(true)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    // Trigger refresh of all components
    window.dispatchEvent(new CustomEvent("analytics-refresh"))
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
    setError(null) // Clear any existing errors when changing date range
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adminKey")
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <AdminPasswordModal
          isOpen={true}
          onVerified={handleVerified}
          onCancel={() => (window.location.href = "/")}
          action="access the analytics dashboard"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pt-24 md:pt-20">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
            rotate: [360, 180, 0],
          }}
          transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <DashboardHeader onRefresh={handleRefresh} onLogout={handleLogout} isLoading={isLoading} />
          </motion.div>

          {/* Date Range Selector */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <DateRangeSelector selectedRange={selectedDateRange} onRangeChange={handleDateRangeChange} />
          </motion.div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm"
            >
              <p className="text-red-400 text-center font-medium">{error}</p>
            </motion.div>
          )}

          {/* Metrics Overview - Bento Box Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <MetricsOverview dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Page Views Chart - Full Width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-8"
          >
            <PageViewsChart dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Traffic Sources Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <TrafficSourcesChart dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
            </motion.div>

            {/* Device Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <DeviceBreakdown dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
            </motion.div>
          </div>

          {/* Geographic Map - Full Width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-8"
          >
            <GeographicMap dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Top Pages Table - Full Width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mb-8"
          >
            <TopPagesTable dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center text-white/60 text-sm"
          >
            <p>Powered by Google Analytics 4 • Property ID: 488543948 • Last updated: {new Date().toLocaleString()}</p>
            <p className="mt-2">Real-time data refreshes every 30 seconds • Historical data updates every 5 minutes</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
