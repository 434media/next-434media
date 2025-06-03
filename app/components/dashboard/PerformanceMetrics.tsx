"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Loader2, AlertCircle, Download, Zap } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface PerformanceMetricsProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface PerformanceData {
  avg?: number
  p75?: number
  p90?: number
  p99?: number
  change?: number
}

export function PerformanceMetrics({ timeRange, isLoading: parentLoading = false, setError }: PerformanceMetricsProps) {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setMetricsError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setMetricsError(null)

      try {
        const result = await fetchAnalyticsData("performance", timeRange)

        // Handle different data formats and ensure we have default values
        let processedData: PerformanceData = {
          avg: 0,
          p75: 0,
          p90: 0,
          p99: 0,
          change: 0,
        }

        // If we have web vitals data from Vercel Analytics
        if (result && typeof result === "object") {
          // Handle direct properties
          if (typeof result.avg === "number") processedData.avg = result.avg
          if (typeof result.p75 === "number") processedData.p75 = result.p75
          if (typeof result.p90 === "number") processedData.p90 = result.p90
          if (typeof result.p99 === "number") processedData.p99 = result.p99
          if (typeof result.change === "number") processedData.change = result.change

          // Handle nested web vitals data
          if (result.webVitals && typeof result.webVitals === "object") {
            const webVitals = result.webVitals

            // Try to extract LCP (Largest Contentful Paint) as avg if available
            if (webVitals.lcp && typeof webVitals.lcp.avg === "number") {
              processedData.avg = webVitals.lcp.avg / 1000 // Convert ms to seconds
            }

            // Try to extract other metrics if available
            if (webVitals.lcp) {
              if (typeof webVitals.lcp.p75 === "number") processedData.p75 = webVitals.lcp.p75 / 1000
              if (typeof webVitals.lcp.p90 === "number") processedData.p90 = webVitals.lcp.p90 / 1000
              if (typeof webVitals.lcp.p99 === "number") processedData.p99 = webVitals.lcp.p99 / 1000
            }
          }

          // For mock data in development
          if (result._mock) {
            processedData = {
              avg: Math.random() * 2 + 0.5, // 0.5 - 2.5 seconds
              p75: Math.random() * 3 + 0.8, // 0.8 - 3.8 seconds
              p90: Math.random() * 4 + 1.2, // 1.2 - 5.2 seconds
              p99: Math.random() * 6 + 2, // 2 - 8 seconds
              change: (Math.random() - 0.5) * 20, // -10% to +10%
            }
          }
        }

        setData(processedData)
      } catch (error) {
        console.error("Error loading performance data:", error)
        setMetricsError("Failed to load performance data")
        setError("Failed to load performance data")

        // Set fallback data in development
        if (process.env.NODE_ENV === "development") {
          setData({
            avg: 1.2,
            p75: 1.8,
            p90: 2.5,
            p99: 4.2,
            change: -5.2,
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [timeRange, setError])

  useEffect(() => {
    if (parentLoading) {
      setIsLoading(true)
    }
  }, [parentLoading])

  const exportToCSV = async () => {
    if (!data) return

    setIsExporting(true)
    try {
      const csvContent = [
        ["Metric", "Value (seconds)", "Change (%)"],
        [
          "Average",
          data.avg !== undefined ? data.avg.toFixed(3) : "N/A",
          data.change !== undefined ? data.change.toFixed(2) : "N/A",
        ],
        ["75th Percentile", data.p75 !== undefined ? data.p75.toFixed(3) : "N/A", "N/A"],
        ["90th Percentile", data.p90 !== undefined ? data.p90.toFixed(3) : "N/A", "N/A"],
        ["99th Percentile", data.p99 !== undefined ? data.p99.toFixed(3) : "N/A", "N/A"],
      ]
        .map((row) => row.join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `performance-metrics-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      setError("Failed to export performance data")
    } finally {
      setIsExporting(false)
    }
  }

  // Safe getter functions with default values
  const getAvg = () => (data?.avg !== undefined ? data.avg : 0)
  const getP75 = () => (data?.p75 !== undefined ? data.p75 : 0)
  const getP90 = () => (data?.p90 !== undefined ? data.p90 : 0)
  const getP99 = () => (data?.p99 !== undefined ? data.p99 : 0)
  const getChange = () => (data?.change !== undefined ? data.change : 0)

  const getPerformanceColor = (value: number) => {
    if (value < 1) return "text-emerald-400"
    if (value < 2) return "text-yellow-400"
    return "text-red-400"
  }

  const getPerformanceLabel = (value: number) => {
    if (value < 1) return "Excellent"
    if (value < 2) return "Good"
    return "Needs Improvement"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Performance Metrics
            </CardTitle>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              disabled={isExporting || isLoading || parentLoading || !data}
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Export performance data to CSV"
            >
              {isExporting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Loader2 className="h-4 w-4 text-white/60" />
                </motion.div>
              ) : (
                <Download className="h-4 w-4 text-white/60" />
              )}
            </motion.button>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Loader2 className="h-12 w-12 text-yellow-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading performance data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                <p className="text-red-400">{error}</p>
                <button
                  onClick={() => setMetricsError(null)}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Average Load Time */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className={`text-4xl font-bold mb-2 ${getPerformanceColor(getAvg())}`}
                >
                  {getAvg().toFixed(2)}s
                </motion.div>
                <p className="text-white/80 text-lg">Average Load Time</p>
                <p className={`text-sm ${getPerformanceColor(getAvg())}`}>{getPerformanceLabel(getAvg())}</p>
                {data.change !== undefined && (
                  <p
                    className={`text-xs mt-1 ${
                      getChange() < 0 ? "text-emerald-400" : getChange() > 0 ? "text-red-400" : "text-gray-400"
                    }`}
                  >
                    {getChange() > 0 ? "+" : ""}
                    {getChange().toFixed(1)}% vs last period
                  </p>
                )}
              </div>

              {/* Percentiles */}
              <div className="space-y-4">
                <h4 className="text-white/80 font-medium">Load Time Percentiles</h4>
                <div className="space-y-3">
                  {[
                    { label: "75th Percentile", value: getP75(), description: "75% of users" },
                    { label: "90th Percentile", value: getP90(), description: "90% of users" },
                    { label: "99th Percentile", value: getP99(), description: "99% of users" },
                  ].map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                    >
                      <div>
                        <p className="text-white font-medium">{metric.label}</p>
                        <p className="text-white/60 text-sm">{metric.description}</p>
                      </div>
                      <div className={`text-lg font-bold ${getPerformanceColor(metric.value)}`}>
                        {metric.value.toFixed(2)}s
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}
