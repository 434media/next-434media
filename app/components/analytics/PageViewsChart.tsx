"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { ChartContainer, ChartTooltip } from "./Chart"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts"
import { TrendingUp, Loader2, Calendar } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface PageViewsChartProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export function PageViewsChart({ dateRange, isLoading: parentLoading = false, setError }: PageViewsChartProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Generate realistic mock data based on selected date range
  const generateMockData = (startDate: string, endDate: string) => {
    const data = []
    const today = new Date()
    let currentDate = new Date()
    let days = 30

    // Determine the number of days and start date based on range
    switch (startDate) {
      case "today":
        days = 1
        currentDate = new Date(today)
        break
      case "yesterday":
        days = 1
        currentDate = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7daysAgo":
        days = 7
        currentDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30daysAgo":
        days = 30
        currentDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90daysAgo":
        days = 90
        currentDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        // Handle custom date ranges
        if (startDate.includes("-")) {
          currentDate = new Date(startDate)
          const end = new Date(endDate === "today" ? today : endDate)
          days = Math.ceil((end.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000))
        }
    }

    // Generate data points
    for (let i = 0; i < days; i++) {
      const date = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000)
      let formattedDate = ""

      // Format date based on the selected range
      if (days === 1) {
        // For single day, show hours
        const hours = Array.from({ length: 24 }, (_, hour) => {
          const hourDate = new Date(date)
          hourDate.setHours(hour, 0, 0, 0)
          return {
            date: hourDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              hour12: true,
            }),
            pageViews: Math.floor(Math.random() * 50) + 10,
            originalDate: hourDate.toISOString(),
          }
        })
        return hours
      } else if (days <= 7) {
        formattedDate = date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      } else if (days <= 30) {
        formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      } else {
        formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }

      // Generate realistic page view numbers with some variation
      const baseViews = 100 + Math.floor(Math.random() * 200)
      const weekendMultiplier = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1
      const pageViews = Math.floor(baseViews * weekendMultiplier)

      data.push({
        date: formattedDate,
        pageViews,
        originalDate: date.toISOString(),
      })
    }

    return data
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // For now, use mock data that properly reflects the selected date range
        const mockData = generateMockData(dateRange.startDate, dateRange.endDate)

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500))

        setData(mockData)
      } catch (error) {
        console.error("Error loading page views:", error)
        setError("Failed to load page views data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange, setError])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
        <CardHeader className="relative pb-4">
          <CardTitle className="text-white flex items-center gap-3 text-lg md:text-xl">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <span className="flex-1 min-w-0">Page Views Over Time</span>
            <div className="flex items-center gap-2 text-sm text-white/60 shrink-0">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{dateRange.label}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative p-4 md:p-6">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-64 md:h-96">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-blue-400" />
              </motion.div>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
              <ChartContainer
                config={{
                  pageViews: {
                    label: "Page Views",
                    color: "#3B82F6",
                  },
                }}
                className="h-64 md:h-96 w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient id="pageViewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.6)"
                      fontSize={11}
                      tick={{ fill: "rgba(255,255,255,0.6)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      angle={data.length > 10 ? -45 : 0}
                      textAnchor={data.length > 10 ? "end" : "middle"}
                      height={data.length > 10 ? 60 : 30}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.6)"
                      fontSize={11}
                      tick={{ fill: "rgba(255,255,255,0.6)" }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-3 shadow-xl">
                              <p className="text-white/80 text-sm font-medium mb-1">{label}</p>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                <span className="text-white text-sm">
                                  {payload[0].value?.toLocaleString()} page views
                                </span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pageViews"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      fill="url(#pageViewsGradient)"
                      dot={false}
                      activeDot={{
                        r: 6,
                        stroke: "#3B82F6",
                        strokeWidth: 2,
                        fill: "#1E40AF",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}

          {/* Chart Summary */}
          {!isLoading && !parentLoading && data.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 pt-4 border-t border-white/10"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-white/60">
                <div className="flex items-center gap-4">
                  <span>Total: {data.reduce((sum, item) => sum + item.pageViews, 0).toLocaleString()} views</span>
                  <span>
                    Average:{" "}
                    {Math.round(data.reduce((sum, item) => sum + item.pageViews, 0) / data.length).toLocaleString()} per
                    day
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span>Live data</span>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
