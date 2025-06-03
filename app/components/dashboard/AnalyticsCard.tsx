"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { TrendingUp, TrendingDown, Minus, Loader2, Download } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface AnalyticsCardProps {
  title: string
  endpoint: string
  timeRange: string
  icon?: React.ReactNode
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  formatter?: (value: any) => string
  priority?: "high" | "medium" | "low"
  size?: "small" | "medium" | "large"
}

interface AnalyticsValue {
  value: number | string
  change?: number
  description?: string
}

export function AnalyticsCard({
  title,
  endpoint,
  timeRange,
  icon,
  isLoading: parentLoading = false,
  setError,
  formatter,
  priority = "medium",
  size = "medium",
}: AnalyticsCardProps) {
  const [data, setData] = useState<AnalyticsValue | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const result = await fetchAnalyticsData(endpoint, timeRange)
        setData(result)
      } catch (error) {
        console.error(`Error loading ${endpoint} data:`, error)
        setError(`Failed to load ${title.toLowerCase()} data`)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [endpoint, timeRange, title, setError])

  // Reset when parent triggers reload
  useEffect(() => {
    if (parentLoading) {
      setIsLoading(true)
    }
  }, [parentLoading])

  const exportToCSV = async () => {
    setIsExporting(true)
    try {
      // Get detailed data for export
      const exportData = await fetchAnalyticsData(endpoint, timeRange)

      const csvContent = [
        ["Metric", "Value", "Change (%)", "Time Range", "Export Date"],
        [
          title,
          typeof exportData.value === "number" ? exportData.value.toString() : exportData.value,
          exportData.change ? exportData.change.toFixed(2) : "N/A",
          timeRange,
          new Date().toISOString().split("T")[0],
        ],
      ]
        .map((row) => row.join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      setError("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const getTrendIcon = () => {
    if (!data?.change) return null

    if (data.change > 0) return <TrendingUp className="h-4 w-4 text-emerald-500" />
    if (data.change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  const getTrendColor = () => {
    if (!data?.change) return "text-gray-600"
    if (data.change > 0) return "text-emerald-500"
    if (data.change < 0) return "text-red-500"
    return "text-gray-500"
  }

  const displayValue = () => {
    if (isLoading || parentLoading) return "..."
    if (!data) return "N/A"

    if (formatter) {
      return formatter(data.value)
    }

    return typeof data.value === "number" ? data.value.toLocaleString() : data.value
  }

  const getCardSize = () => {
    switch (size) {
      case "small":
        return "h-32"
      case "large":
        return "h-48"
      default:
        return "h-36"
    }
  }

  const getPriorityGradient = () => {
    switch (priority) {
      case "high":
        return "from-emerald-500/15 via-transparent to-blue-500/15"
      case "low":
        return "from-gray-500/10 via-transparent to-gray-500/5"
      default:
        return "from-emerald-500/10 via-transparent to-purple-500/10"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
      className={getCardSize()}
    >
      <Card
        className={`relative overflow-hidden border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl h-full ${priority === "high" ? "ring-1 ring-emerald-500/20" : ""}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${getPriorityGradient()}`} />
        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`font-medium text-white/80 ${size === "large" ? "text-base" : "text-sm"}`}>
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {icon && (
              <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="text-emerald-400">
                {icon}
              </motion.div>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              disabled={isExporting || isLoading || parentLoading}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Export to CSV"
            >
              {isExporting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Loader2 className="h-3 w-3 text-white/60" />
                </motion.div>
              ) : (
                <Download className="h-3 w-3 text-white/60" />
              )}
            </motion.button>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {isLoading || parentLoading ? (
            <div className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-4 w-4 text-white/60" />
              </motion.div>
              <span className={`font-bold text-white/60 ${size === "large" ? "text-3xl" : "text-2xl"}`}>
                Loading...
              </span>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className={`font-bold text-white mb-1 ${size === "large" ? "text-3xl" : "text-2xl"}`}
              >
                {displayValue()}
              </motion.div>

              {data?.change !== undefined && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                  className={`flex items-center text-xs ${getTrendColor()}`}
                >
                  {getTrendIcon()}
                  <span className="ml-1">
                    {data.change > 0 ? "+" : ""}
                    {data.change.toFixed(1)}%
                  </span>
                  <span className="ml-1 text-white/60">vs last period</span>
                </motion.div>
              )}

              {data?.description && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  className="text-xs text-white/60 mt-1"
                >
                  {data.description}
                </motion.p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
