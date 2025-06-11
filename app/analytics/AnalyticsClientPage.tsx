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

interface ConnectionTestDetails {
  hasClient?: boolean
  hasPropertyId?: boolean
  authMethod?: string
  isVercelOIDC?: boolean
  propertyId?: string
  dimensionCount?: number
  metricCount?: number
  projectId?: string
  serviceAccount?: string
  audience?: string | null
  serviceAccountUrl?: string | null
}

interface ConnectionTest {
  success: boolean
  error?: string
  details?: ConnectionTestDetails
}

interface ConfigurationStatus {
  configured: boolean
  authenticationMethod: string
  isVercelDeployment: boolean
  isProduction: boolean
  missingVariables: string[]
  recommendations: string[]
  connectionTest?: ConnectionTest
  oidcSetup: {
    poolId?: string
    providerId?: string
    serviceAccountEmail?: string
    projectNumber?: string
  }
}

interface DataSourceInfo {
  vercelAnalytics: {
    available: boolean
    recordCount?: number
    dateRange?: { start: string; end: string }
  }
  googleAnalytics: {
    available: boolean
    configured: boolean
    ga4StartDate: string
  }
  compatibility: {
    normalizationEnabled: boolean
    dataQualityChecks: boolean
    supportedFormats: string[]
  }
}

export default function AnalyticsClientPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({
    startDate: "30daysAgo",
    endDate: "today",
    label: "Last 30 days",
  })
  const [error, setError] = useState<string | null>(null)
  const [configStatus, setConfigStatus] = useState<ConfigurationStatus | null>(null)
  const [dataSourceInfo, setDataSourceInfo] = useState<DataSourceInfo | null>(null)

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
    checkAnalyticsConfig()
    window.dispatchEvent(new CustomEvent("analytics-refresh"))
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
    setError(null)
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adminKey")
    setIsAuthenticated(false)
  }

  const checkAnalyticsConfig = async () => {
    try {
      const adminKey = sessionStorage.getItem("adminKey")
      if (!adminKey) {
        setError("No admin key found")
        return
      }

      const response = await fetch("/api/analytics?endpoint=config", {
        headers: {
          "x-admin-key": adminKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to check analytics configuration: ${response.status} ${errorText}`)
      }

      const config: ConfigurationStatus & { dataSourceInfo?: DataSourceInfo } = await response.json()
      setConfigStatus(config)

      if (config.dataSourceInfo) {
        setDataSourceInfo(config.dataSourceInfo)
      }

      if (!config.configured || (config.connectionTest && !config.connectionTest.success)) {
        const errorMessage = config.connectionTest?.error || "Configuration incomplete"
        const missingVars =
          config.missingVariables?.length > 0 ? config.missingVariables.join(", ") : "Unknown variables"
        setError(`Google Analytics configuration issue: ${errorMessage}. Missing: ${missingVars}`)
      } else {
        setError(null)
      }
    } catch (err) {
      console.error("Error checking analytics config:", err)
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(`Failed to check analytics configuration: ${errorMessage}`)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      checkAnalyticsConfig()
    }
  }, [isAuthenticated])

  // Helper function to check if analytics is ready
  const isAnalyticsReady = () => {
    return configStatus?.configured === true && configStatus?.connectionTest?.success === true
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

          {/* Configuration Status */}
          {configStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4"
            >
              <div
                className={`p-4 rounded-xl backdrop-blur-sm ${
                  isAnalyticsReady()
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${isAnalyticsReady() ? "text-green-400" : "text-red-400"}`}>
                      Analytics Status: {isAnalyticsReady() ? "Connected & Operational" : "Configuration Error"}
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Auth Method: {configStatus.authenticationMethod} |
                      {configStatus.connectionTest?.details?.propertyId
                        ? ` Property ID: ${configStatus.connectionTest.details.propertyId}`
                        : " No Property ID"}
                    </p>
                    {dataSourceInfo && (
                      <p className="text-xs text-white/60 mt-1">
                        Data Sources: GA4 ({dataSourceInfo.googleAnalytics.available ? "✓" : "✗"}) | Historical DB (
                        {dataSourceInfo.vercelAnalytics.available ? "✓" : "✗"})
                        {dataSourceInfo.vercelAnalytics.recordCount &&
                          ` - ${dataSourceInfo.vercelAnalytics.recordCount} records`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={checkAnalyticsConfig}
                    disabled={isLoading}
                    className="text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
                  >
                    {isLoading ? "Checking..." : "Refresh Status"}
                  </button>
                </div>
                {configStatus.missingVariables && configStatus.missingVariables.length > 0 && (
                  <div className="mt-3 p-3 bg-black/20 rounded-lg">
                    <p className="text-xs text-red-300 font-medium mb-1">Missing Environment Variables:</p>
                    <p className="text-xs text-red-200">{configStatus.missingVariables.join(", ")}</p>
                  </div>
                )}
                {configStatus.recommendations && configStatus.recommendations.length > 0 && (
                  <div className="mt-3 p-3 bg-black/20 rounded-lg">
                    <p className="text-xs text-amber-300 font-medium mb-1">Recommendations:</p>
                    <ul className="text-xs text-amber-200 space-y-1">
                      {configStatus.recommendations.map((rec, index) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
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

          {/* Only show analytics components if properly configured */}
          {isAnalyticsReady() ? (
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
            /* Configuration Required Message */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-center py-16"
            >
              <div className="max-w-2xl mx-auto">
                <div className="p-8 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <h3 className="text-2xl font-bold text-white mb-4">Analytics Configuration Required</h3>
                  <p className="text-white/70 mb-6">
                    Google Analytics integration requires proper OIDC Workload Identity Federation setup.
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
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">Setup Steps:</h4>
                      <ol className="text-sm text-white/60 space-y-1">
                        <li>1. Create a Google Cloud service account with Analytics Data API access</li>
                        <li>2. Set up Workload Identity Federation for Vercel</li>
                        <li>3. Configure the required environment variables in Vercel</li>
                        <li>4. Upload historical data via CSV to the Neon database</li>
                      </ol>
                    </div>
                  </div>
                  <button
                    onClick={checkAnalyticsConfig}
                    disabled={isLoading}
                    className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {isLoading ? "Checking..." : "Check Configuration Again"}
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
              Powered by Google Analytics 4 & Neon Database •
              {configStatus?.connectionTest?.details?.propertyId &&
                ` Property ID: ${configStatus.connectionTest.details.propertyId} • `}
              Last updated: {new Date().toLocaleString()}
            </p>
            <p className="mt-2">
              Hybrid data system: Historical data from database + Live data from GA4 • Real-time updates every 30
              seconds
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
