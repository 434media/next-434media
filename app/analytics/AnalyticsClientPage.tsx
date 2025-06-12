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
    testConnection()
    window.dispatchEvent(new CustomEvent("analytics-refresh"))
    setTimeout(() => setIsLoading(false), 1000)
  }

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
    setError(null)
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adminKey")
    setIsAuthenticated(false)
  }

  const testConnection = async () => {
    try {
      const adminKey = sessionStorage.getItem("adminKey")
      if (!adminKey) {
        setError("No admin key found")
        return
      }

      const response = await fetch("/api/analytics?action=test-connection", {
        headers: { "x-admin-key": adminKey },
      })

      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status}`)
      }

      const status = await response.json()
      setConnectionStatus(status)

      if (status.success) {
        setError(null)
      } else {
        setError(`Google Analytics connection failed: ${status.error}`)
      }
    } catch (err) {
      console.error("Connection test error:", err)
      setError(err instanceof Error ? err.message : "Connection test failed")
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      testConnection()
    }
  }, [isAuthenticated])

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

          {/* Connection Status */}
          {connectionStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4"
            >
              <div
                className={`p-4 rounded-xl backdrop-blur-sm ${
                  connectionStatus.success
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`text-sm font-medium ${connectionStatus.success ? "text-green-400" : "text-red-400"}`}
                    >
                      Google Analytics: {connectionStatus.success ? "Connected" : "Connection Failed"}
                    </p>
                    {connectionStatus.success && (
                      <p className="text-xs text-white/60 mt-1">
                        Property: {connectionStatus.propertyId} | Dimensions: {connectionStatus.dimensionCount} |
                        Metrics: {connectionStatus.metricCount}
                      </p>
                    )}
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm"
            >
              <p className="text-red-400 text-center font-medium">{error}</p>
            </motion.div>
          )}

          {/* Analytics Dashboard */}
          {connectionStatus?.success ? (
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
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center py-16"
            >
              <div className="max-w-2xl mx-auto">
                <div className="p-8 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <h3 className="text-2xl font-bold text-white mb-4">Google Analytics Setup Required</h3>
                  <p className="text-white/70 mb-6">
                    Configure your Google Analytics 4 property and Vercel OIDC Workload Identity Federation.
                  </p>
                  <div className="text-left space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">Required Environment Variables:</h4>
                      <ul className="text-sm text-white/60 space-y-1">
                        <li>• GA4_PROPERTY_ID</li>
                        <li>• GCP_PROJECT_ID</li>
                        <li>• GCP_PROJECT_NUMBER</li>
                        <li>• GCP_WORKLOAD_IDENTITY_POOL_ID</li>
                        <li>• GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID</li>
                        <li>• GCP_SERVICE_ACCOUNT_EMAIL</li>
                      </ul>
                    </div>
                  </div>
                  <button
                    onClick={testConnection}
                    disabled={isLoading}
                    className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {isLoading ? "Testing..." : "Test Connection"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="text-center text-white/60 text-sm"
          >
            <p>
              Powered by Google Analytics 4 •
              {connectionStatus?.propertyId && ` Property: ${connectionStatus.propertyId} • `}
              Last updated: {new Date().toLocaleString()}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
