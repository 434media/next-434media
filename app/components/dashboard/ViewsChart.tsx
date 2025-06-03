"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Loader2, AlertCircle, Download } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"
import type { TimeRange } from "./TimeRangeSelector"

export interface ViewsChartProps {
  timeRange: string
  selectedTimeRange: TimeRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface ViewsData {
  data: Array<{
    date: string
    views: number
  }>
}

export function ViewsChart({
  timeRange,
  selectedTimeRange,
  isLoading: parentLoading = false,
  setError,
}: ViewsChartProps) {
  const [chartData, setChartData] = useState<ViewsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setChartError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setChartError(null)

      try {
        const result = await fetchAnalyticsData("views-chart", timeRange)

        // Expect the API to return properly formatted chart data
        if (result && result.data && Array.isArray(result.data)) {
          setChartData({ data: result.data })
        } else {
          throw new Error("Invalid chart data format received from API")
        }
      } catch (error) {
        console.error("Error loading views chart data:", error)
        setChartError("Failed to load views chart data")
        setError("Failed to load views chart data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [timeRange, selectedTimeRange, setError])

  // Reset when parent triggers reload
  useEffect(() => {
    if (parentLoading) {
      setIsLoading(true)
    }
  }, [parentLoading])

  const exportToCSV = async () => {
    if (!chartData?.data) return

    setIsExporting(true)
    try {
      const csvContent = [["Date", "Views"], ...chartData.data.map((item) => [item.date, item.views.toString()])]
        .map((row) => row.join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `page-views-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
      setError("Failed to export chart data")
    } finally {
      setIsExporting(false)
    }
  }

  const formattedData =
    chartData?.data?.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      views: item.views,
      fullDate: item.date,
    })) || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-2 h-2 bg-emerald-400 rounded-full"
              />
              Page Views Over Time
              <span className="text-sm text-white/60 font-normal">({selectedTimeRange.label})</span>
            </CardTitle>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              disabled={isExporting || isLoading || parentLoading || !chartData?.data}
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Export chart data to CSV"
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
                  <Loader2 className="h-12 w-12 text-emerald-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading chart data...</p>
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
            <ChartContainer
              config={{
                views: {
                  label: "Views",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#10b981" strokeWidth={2} fill="url(#viewsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
