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
import type { DateRange, AnalyticsConnectionStatus } from "../types/analytics"

export default function AnalyticsClientPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({
    startDate: "30daysAgo",
    endDate: "today",
    label: "Last 30 days",
  })
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<AnalyticsConnectionStatus | null>(null)

  // Check for existing admin session
  useEffect(() => {
    const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (adminKey) {
      setIsAuthenticated(true)
      testConnection()
    }
  }, [])

  // Refresh data when date range changes
  useEffect(() => {
    if (isAuthenticated) {
      forceRefreshData()
    }
  }, [selectedDateRange, isAuthenticated])

  const handleVerified = (password: string) => {
    sessionStorage.setItem("adminKey", password)
    setIsAuthenticated(true)
  }

  // Force refresh data when needed
  const forceRefreshData = () => {
    setIsLoading(true)
    // Create a custom event to trigger data refresh in child components
    window.dispatchEvent(
      new CustomEvent("analytics-refresh", {
        detail: { timestamp: Date.now() },
      }),
    )

    // Set a timeout to ensure loading state is visible
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleRefresh = () => {
    testConnection()
    forceRefreshData()
  }

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
    setError(null)
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adminKey")
    localStorage.removeItem("adminKey")
    setIsAuthenticated(false)
  }

  const testConnection = async () => {
    try {
      const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
      if (!adminKey) {
        return
      }

      const response = await fetch("/api/analytics?endpoint=test-connection", {
        headers: { "x-admin-key": adminKey },
      })

      if (response.ok) {
        const status = await response.json()
        setConnectionStatus(status)
      }
    } catch (err) {
      console.error("Connection test error:", err)
      // Don't set error - just continue with zero data
    }
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

          {/* Connection Status - Only show if connected */}
          {connectionStatus?.success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4"
            >
              <div className="p-4 rounded-xl backdrop-blur-sm bg-green-500/10 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-400">Google Analytics: Connected</p>
                    <p className="text-xs text-white/60 mt-1">
                      Property: {connectionStatus.propertyId} | Dimensions: {connectionStatus.dimensionCount} | Metrics:{" "}
                      {connectionStatus.metricCount}
                    </p>
                  </div>
                  <button
                    onClick={testConnection}
                    disabled={isLoading}
                    className="text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
                  >
                    {isLoading ? "Testing..." : "Test Connection"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-4"
            >
              <div className="p-4 rounded-xl backdrop-blur-sm bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-xs text-white/60 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md transition-colors mt-2"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}

          {/* Analytics Dashboard - Always show components */}
          <>
            {/* Metrics Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8"
            >
              <MetricsOverview dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
            </motion.div>

            {/* Page Views Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-8"
            >
              <PageViewsChart dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
            </motion.div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <TrafficSourcesChart dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <DeviceBreakdown dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
              </motion.div>
            </div>

            {/* Geographic Map */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mb-8"
            >
              <GeographicMap dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
            </motion.div>

            {/* Top Pages Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mb-8"
            >
              <TopPagesTable dateRange={selectedDateRange} isLoading={isLoading} setError={setError} />
            </motion.div>
          </>

           {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="text-center text-white/60 text-sm"
          >
            <p>
              Powered by Google Analytics 4 <span className="hidden md:inline">•</span> {' '}
              <span className="block md:inline">Last updated: {new Date().toLocaleString()}</span>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
