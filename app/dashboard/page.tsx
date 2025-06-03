"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import AdminPasswordModal from "../components/AdminPasswordModal"
import { DashboardHeader } from "../components/dashboard/DashboardHeader"
import { TimeRangeSelector, type TimeRange } from "../components/dashboard/TimeRangeSelector"
import { AnalyticsCard } from "../components/dashboard/AnalyticsCard"
import { ViewsChart } from "../components/dashboard/ViewsChart"
import { TopPagesTable } from "../components/dashboard/TopPagesTable"
import { DeviceChart } from "../components/dashboard/DeviceChart"
import { CountriesTable } from "../components/dashboard/CountriesTable"
import {
  Users,
  Clock,
  ExternalLink,
  AlertTriangle,
  Database,
  Gauge,
  Eye,
  CheckCircle,
  XCircle,
  TestTube,
} from "lucide-react"
import { ReferrersTable } from "../components/dashboard/ReferrersTable"
import { OSChart } from "../components/dashboard/OSChart"
import { BrowsersChart } from "../components/dashboard/BrowsersChart"
import { PerformanceMetrics } from "../components/dashboard/PerformanceMetrics"
import { RealtimeVisitors } from "../components/dashboard/RealtimeVisitors"

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>({
    label: "Last 7 days",
    value: "7d",
    since: "7d",
    until: "0d",
  })
  const [error, setError] = useState<string | null>(null)
  const [configStatus, setConfigStatus] = useState<{
    hasToken: boolean
    hasProjectId: boolean
    isConfigured: boolean
    isDevelopment: boolean
  } | null>(null)

  // Check configuration status
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch("/api/analytics/config-check")
        const config = await response.json()
        setConfigStatus(config)
      } catch (error) {
        console.error("Failed to check configuration:", error)
        setConfigStatus({
          hasToken: false,
          hasProjectId: false,
          isConfigured: false,
          isDevelopment: process.env.NODE_ENV === "development",
        })
      }
    }

    if (isAuthenticated) {
      checkConfig()
    }
  }, [isAuthenticated])

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
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range)
  }

  const getDataSourceInfo = () => {
    if (!configStatus) return { text: "Checking configuration...", color: "text-gray-400", icon: Database }

    if (configStatus.isDevelopment && !configStatus.isConfigured) {
      return {
        text: "Development Mode (Mock Data)",
        color: "text-blue-400",
        icon: TestTube,
        bgColor: "bg-blue-400",
      }
    }

    if (configStatus.isConfigured) {
      return {
        text: "Live Vercel Analytics",
        color: "text-emerald-400",
        icon: Database,
        bgColor: "bg-emerald-400",
      }
    }

    return {
      text: "Configuration Required",
      color: "text-amber-400",
      icon: XCircle,
      bgColor: "bg-amber-400",
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <AdminPasswordModal
          isOpen={true}
          onVerified={handleVerified}
          onCancel={() => (window.location.href = "/")}
          action="access the analytics dashboard"
        />
      </div>
    )
  }

  const dataSource = getDataSourceInfo()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="pt-20 pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Floating background elements */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{
                x: [0, 100, 0],
                y: [0, -50, 0],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                x: [0, -100, 0],
                y: [0, 100, 0],
                rotate: [360, 180, 0],
              }}
              transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
            />
          </div>

          <DashboardHeader
            title="Analytics Dashboard"
            description="Real-time insights powered by Vercel Analytics"
            onRefresh={handleRefresh}
            isLoading={isLoading}
          />

          {/* Configuration Status */}
          {configStatus && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div
                className={`p-4 rounded-lg border backdrop-blur-sm ${
                  configStatus.isConfigured
                    ? "bg-emerald-500/20 border-emerald-500/30"
                    : configStatus.isDevelopment
                      ? "bg-blue-500/20 border-blue-500/30"
                      : "bg-amber-500/20 border-amber-500/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {configStatus.isConfigured ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : configStatus.isDevelopment ? (
                    <TestTube className="h-5 w-5 text-blue-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-400" />
                  )}
                  <div>
                    <p
                      className={`font-medium ${
                        configStatus.isConfigured
                          ? "text-emerald-200"
                          : configStatus.isDevelopment
                            ? "text-blue-200"
                            : "text-amber-200"
                      }`}
                    >
                      {configStatus.isConfigured
                        ? "Vercel Analytics Configured"
                        : configStatus.isDevelopment
                          ? "Development Mode - Using Mock Data"
                          : "Vercel Analytics Configuration Required"}
                    </p>
                    {!configStatus.isConfigured && !configStatus.isDevelopment && (
                      <p className="text-sm text-amber-300 mt-1">
                        Missing: {!configStatus.hasToken && "VERCEL_ANALYTICS_TOKEN"}{" "}
                        {!configStatus.hasProjectId && "VERCEL_PROJECT_ID"}
                      </p>
                    )}
                    {configStatus.isDevelopment && !configStatus.isConfigured && (
                      <p className="text-sm text-blue-300 mt-1">
                        Set VERCEL_ANALYTICS_TOKEN and VERCEL_PROJECT_ID to use real data
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Data source indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-center"
          >
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 flex items-center gap-2">
              <dataSource.icon className={`h-4 w-4 ${dataSource.color}`} />
              <span className="text-sm text-white/70">{dataSource.text}</span>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                className={`w-2 h-2 rounded-full ${dataSource.bgColor}`}
              />
            </div>
          </motion.div>

          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onRangeChange={handleTimeRangeChange}
            isLoading={isLoading}
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center space-x-3 backdrop-blur-sm"
            >
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <p className="text-sm text-red-200">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-sm text-red-300 hover:text-red-100">
                Dismiss
              </button>
            </motion.div>
          )}

          {/* Priority Analytics Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            {/* Top Priority Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-1">
                <RealtimeVisitors />
              </div>
              <div className="md:col-span-2">
                <AnalyticsCard
                  title="Page Views"
                  endpoint="views"
                  timeRange={selectedTimeRange.value}
                  icon={<Eye className="h-5 w-5" />}
                  isLoading={isLoading}
                  setError={setError}
                  priority="high"
                  size="large"
                />
              </div>
            </div>

            {/* Secondary Priority Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnalyticsCard
                title="Total Visitors"
                endpoint="visitors"
                timeRange={selectedTimeRange.value}
                icon={<Users className="h-5 w-5" />}
                isLoading={isLoading}
                setError={setError}
                priority="high"
              />
              <AnalyticsCard
                title="Bounce Rate"
                endpoint="bounce-rate"
                timeRange={selectedTimeRange.value}
                icon={<Gauge className="h-5 w-5" />}
                isLoading={isLoading}
                setError={setError}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <AnalyticsCard
                title="Avg. Session"
                endpoint="duration"
                timeRange={selectedTimeRange.value}
                icon={<Clock className="h-5 w-5" />}
                isLoading={isLoading}
                setError={setError}
                formatter={(value: number) => `${Math.floor(value / 60)}m ${value % 60}s`}
              />
            </div>
          </motion.div>

          {/* Main Charts Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
          >
            <div className="lg:col-span-2">
              <ViewsChart
                timeRange={selectedTimeRange.value}
                selectedTimeRange={selectedTimeRange}
                isLoading={isLoading}
                setError={setError}
              />
            </div>
            <div>
              <PerformanceMetrics timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
            </div>
          </motion.div>

          {/* Priority Tables Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            <ReferrersTable timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
            <TopPagesTable timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Device and Browser Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            <DeviceChart timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
            <OSChart timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Browsers Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <BrowsersChart timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Countries Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-8"
          >
            <CountriesTable timeRange={selectedTimeRange.value} isLoading={isLoading} setError={setError} />
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <p className="text-white/70 mb-2">
                {configStatus?.isDevelopment && !configStatus?.isConfigured
                  ? "Development Mode - Mock Data"
                  : "Powered by Vercel Analytics"}
              </p>
              <a
                href="https://vercel.com/analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>Learn more about Vercel Analytics</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
