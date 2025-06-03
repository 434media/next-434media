"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Loader2, AlertCircle, Download, Monitor } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface OSChartProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface OSData {
  name: string
  views: number
  percentage: number
  color: string
}

const OS_COLORS = [
  "#3b82f6", // Windows - Blue
  "#6b7280", // macOS - Gray
  "#10b981", // iOS - Green
  "#f59e0b", // Android - Orange
  "#8b5cf6", // Linux - Purple
  "#ef4444", // Chrome OS - Red
]

export function OSChart({ timeRange, isLoading: parentLoading = false, setError }: OSChartProps) {
  const [chartData, setChartData] = useState<OSData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setChartError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setChartError(null)

      try {
        const result = await fetchAnalyticsData("operating-systems", timeRange)
        const formattedData = (result.data || []).map((item: any, index: number) => ({
          ...item,
          color: OS_COLORS[index % OS_COLORS.length],
        }))
        setChartData(formattedData)
      } catch (error) {
        console.error("Error loading OS data:", error)
        setChartError("Failed to load operating systems data")
        setError("Failed to load operating systems data")
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
    if (!chartData.length) return

    setIsExporting(true)
    try {
      const csvContent = [
        ["Operating System", "Views", "Percentage"],
        ...chartData.map((item) => [item.name, item.views.toString(), `${item.percentage.toFixed(1)}%`]),
      ]
        .map((row) => row.join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `operating-systems-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      setError("Failed to export OS data")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Monitor className="h-5 w-5 text-indigo-400" />
              Operating Systems
            </CardTitle>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              disabled={isExporting || isLoading || parentLoading || !chartData.length}
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Export OS data to CSV"
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
                  <Loader2 className="h-12 w-12 text-indigo-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading OS data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                <p className="text-red-400">{error}</p>
                <button
                  onClick={() => setChartError(null)}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartContainer
                config={{
                  views: {
                    label: "Views",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[250px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="views"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>

              <div className="space-y-3">
                {chartData.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-white text-sm">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{item.percentage.toFixed(1)}%</p>
                      <p className="text-white/60 text-xs">{item.views.toLocaleString()}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
