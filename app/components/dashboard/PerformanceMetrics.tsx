"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Zap, Loader2, AlertCircle, TrendingDown } from "lucide-react"
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
  change: number
}

export function PerformanceMetrics({ timeRange, isLoading: parentLoading = false, setError }: PerformanceMetricsProps) {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setMetricsError] = useState<string | null>(null)

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

  // Reset when parent triggers reload
  useEffect(() => {
    if (parentLoading) {
      setIsLoading(true)
    }
  }, [parentLoading])

  const formatTime = (seconds: number) => {
    if (seconds < 0.1) {
      return `${Math.round(seconds * 1000)}ms`
    }
    return `${seconds.toFixed(2)}s`
  }

  const getPerformanceColor = (seconds: number) => {
    if (seconds < 1) return "bg-emerald-500/20 border-emerald-500/30"
    if (seconds < 2) return "bg-yellow-500/20 border-yellow-500/30"
    return "bg-red-500/20 border-red-500/30"
  }

  const getPerformanceTextColor = (seconds: number) => {
    if (seconds < 1) return "text-emerald-400"
    if (seconds < 2) return "text-yellow-400"
    return "text-red-400"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-[200px]">
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
            <div className="flex items-center justify-center h-[200px]">
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-lg font-medium">Page Load Time</h3>
                  <p className="text-white/60 text-sm">Average time to load your pages</p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className={`px-3 py-1 rounded-lg border ${getPerformanceColor(data.avg)} ${getPerformanceTextColor(data.avg)} font-bold text-lg`}
                  >
                    {formatTime(data.avg)}
                  </motion.div>
                  <div className="flex items-center text-emerald-400 text-sm">
                    <TrendingDown className="h-4 w-4 mr-1" />
                    {Math.abs(data.change).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "p75", value: data.p75, description: "75% of page loads" },
                  { label: "p90", value: data.p90, description: "90% of page loads" },
                  { label: "p99", value: data.p99, description: "99% of page loads" },
                ].map((metric, index) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="text-white/60 text-xs mb-1">{metric.description}</div>
                    <div className={`text-lg font-bold ${getPerformanceTextColor(metric.value)}`}>
                      {formatTime(metric.value)}
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.3 }}
                className="text-white/60 text-sm"
              >
                <p>Performance is measured using Web Vitals metrics across all your visitors.</p>
              </motion.div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}
