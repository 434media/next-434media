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
  avg: number
  p75: number
  p90: number
  p99: number
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
        setData(result)
      } catch (error) {
        console.error("Error loading performance data:", error)
        setMetricsError("Failed to load performance data")
        setError("Failed to load performance data")
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
        ["Average", data.avg.toFixed(3), data.change ? data.change.toFixed(2) : "N/A"],
        ["75th Percentile", data.p75.toFixed(3), "N/A"],
        ["90th Percentile", data.p90.toFixed(3), "N/A"],
        ["99th Percentile", data.p99.toFixed(3), "N/A"],
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
                  className={`text-4xl font-bold mb-2 ${getPerformanceColor(data.avg)}`}
                >
                  {data.avg.toFixed(2)}s
                </motion.div>
                <p className="text-white/80 text-lg">Average Load Time</p>
                <p className={`text-sm ${getPerformanceColor(data.avg)}`}>{getPerformanceLabel(data.avg)}</p>
                {data.change !== undefined && (
                  <p
                    className={`text-xs mt-1 ${
                      data.change < 0 ? "text-emerald-400" : data.change > 0 ? "text-red-400" : "text-gray-400"
                    }`}
                  >
                    {data.change > 0 ? "+" : ""}
                    {data.change.toFixed(1)}% vs last period
                  </p>
                )}
              </div>

              {/* Percentiles */}
              <div className="space-y-4">
                <h4 className="text-white/80 font-medium">Load Time Percentiles</h4>
                <div className="space-y-3">
                  {[
                    { label: "75th Percentile", value: data.p75, description: "75% of users" },
                    { label: "90th Percentile", value: data.p90, description: "90% of users" },
                    { label: "99th Percentile", value: data.p99, description: "99% of users" },
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
