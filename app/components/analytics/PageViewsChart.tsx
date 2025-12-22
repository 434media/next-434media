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
  propertyId?: string
}

export function PageViewsChart({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
}: PageViewsChartProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dataSource, setDataSource] = useState<string>("loading")

  // Helper function to properly format dates
  const formatDateString = (dateStr: string): string => {
    // Check if the date is in YYYYMMDD format (GA4 format)
    if (/^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      return `${year}-${month}-${day}`
    }

    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }

    // If it's in another format, try to parse it
    const parsedDate = new Date(dateStr)
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split("T")[0]
    }

    // If all else fails, return the original string
    console.warn(`[PageViewsChart] Could not parse date: ${dateStr}`)
    return dateStr
  }

  // Helper function to format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    try {
      // First ensure we have a properly formatted date string
      const formattedDateStr = formatDateString(dateStr)

      // Create a date object and format it
      const date = new Date(formattedDateStr)

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn(`[PageViewsChart] Invalid date after formatting: ${formattedDateStr}`)
        return dateStr // Return original if still invalid
      }

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    } catch (error) {
      console.error(`[PageViewsChart] Error formatting date ${dateStr}:`, error)
      return dateStr // Return original on error
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // Log the request details for debugging
        console.log("[PageViewsChart] Fetching data with:", {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          propertyId,
        })

        let url = `/api/analytics?endpoint=daily-metrics&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[PageViewsChart] API Error Response:", errorText)
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }

        const result = await response.json()
        console.log("[PageViewsChart] API Response:", result)

        // Check if we have the expected data structure
        if (result && result.data && Array.isArray(result.data)) {
          setDataSource(result._source || "google-analytics")

          const formattedData = result.data.map((item: any) => {
            // Log the raw date for debugging
            console.log(`[PageViewsChart] Processing date: ${item.date}`)

            return {
              date: formatDateForDisplay(item.date),
              pageViews: item.pageViews || 0,
              originalDate: item.date,
            }
          })

          console.log("[PageViewsChart] Formatted data:", formattedData)
          setData(formattedData)
        } else if (result && result.dailyMetrics && Array.isArray(result.dailyMetrics)) {
          // Alternative data structure
          setDataSource(result._source || "historical")

          const formattedData = result.dailyMetrics.map((item: any) => {
            // Log the raw date for debugging
            console.log(`[PageViewsChart] Processing date (alt): ${item.date}`)

            return {
              date: formatDateForDisplay(item.date),
              pageViews: item.pageViews || 0,
              originalDate: item.date,
            }
          })

          console.log("[PageViewsChart] Formatted data (alternative):", formattedData)
          setData(formattedData)
        } else {
          console.error("[PageViewsChart] Unexpected data structure:", result)
          setData([])
          setError("Unexpected data structure received from API")
        }
      } catch (error: any) {
        console.error("[PageViewsChart] Error loading page views:", error)
        setError(`Failed to load page views data: ${error.message}`)
        setData([])
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange.startDate, dateRange.endDate, dateRange.label, setError, propertyId])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5" />
        <CardHeader className="relative pb-4">
          <CardTitle className="text-white flex items-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-lg shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
            </div>
            <span className="flex-1 min-w-0 truncate">Page Views Over Time</span>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/60 shrink-0">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{dateRange.label}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative p-3 sm:p-4 md:p-6">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-64 md:h-96">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-blue-400" />
              </motion.div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 md:h-96 text-white/60">
              <p className="text-lg mb-2">No data available</p>
              <p className="text-sm text-center max-w-md">
                No page view data was found for the selected date range. Try selecting a different date range or check
                your Google Analytics configuration.
              </p>
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
              <div className="flex flex-col gap-2 text-xs sm:text-sm text-white/60">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Total: {data.reduce((sum, item) => sum + item.pageViews, 0).toLocaleString()} views</span>
                  <span>
                    Avg: {Math.round(data.reduce((sum, item) => sum + item.pageViews, 0) / data.length).toLocaleString()}/day
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                  <span className="text-[10px] sm:text-xs">Source: {dataSource}</span>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
