"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Loader2, AlertCircle, Download, ExternalLink } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface ReferrersTableProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface ReferrerData {
  referrer: string
  views: number
  change?: number
}

export function ReferrersTable({ timeRange, isLoading: parentLoading = false, setError }: ReferrersTableProps) {
  const [data, setData] = useState<ReferrerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setTableError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setTableError(null)

      try {
        const result = await fetchAnalyticsData("referrers", timeRange)
        setData(result.data || [])
      } catch (error) {
        console.error("Error loading referrers data:", error)
        setTableError("Failed to load referrers data")
        setError("Failed to load referrers data")
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
    if (!data.length) return

    setIsExporting(true)
    try {
      const csvContent = [
        ["Referrer", "Views", "Change (%)"],
        ...data.map((item) => [item.referrer, item.views.toString(), item.change ? item.change.toFixed(2) : "N/A"]),
      ]
        .map((row) => row.join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `referrers-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      setError("Failed to export referrers data")
    } finally {
      setIsExporting(false)
    }
  }

  const getReferrerIcon = (referrer: string) => {
    if (referrer.includes("Google")) return "🔍"
    if (referrer.includes("Twitter")) return "🐦"
    if (referrer.includes("LinkedIn")) return "💼"
    if (referrer.includes("Facebook")) return "📘"
    if (referrer.includes("GitHub")) return "🐙"
    if (referrer.includes("Direct")) return "🔗"
    return "🌐"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-purple-400" />
              Top Referrers
            </CardTitle>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              disabled={isExporting || isLoading || parentLoading || !data.length}
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Export referrers data to CSV"
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
                  <Loader2 className="h-12 w-12 text-purple-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading referrers...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                <p className="text-red-400">{error}</p>
                <button
                  onClick={() => setTableError(null)}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((item, index) => (
                <motion.div
                  key={item.referrer}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getReferrerIcon(item.referrer)}</span>
                    <div>
                      <p className="text-white font-medium">{item.referrer}</p>
                      <p className="text-white/60 text-sm">{item.views.toLocaleString()} views</p>
                    </div>
                  </div>
                  {item.change !== undefined && (
                    <div
                      className={`text-sm font-medium ${
                        item.change > 0 ? "text-emerald-400" : item.change < 0 ? "text-red-400" : "text-gray-400"
                      }`}
                    >
                      {item.change > 0 ? "+" : ""}
                      {item.change.toFixed(1)}%
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
