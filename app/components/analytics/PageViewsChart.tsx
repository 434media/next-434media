"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
    <div className="w-full max-w-full min-w-0">
      <Card className="border border-neutral-200 bg-white shadow-lg w-full max-w-full rounded-xl">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-neutral-900 flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-100 to-emerald-100 rounded-lg shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <span className="flex-1 min-w-0 font-bold leading-tight">Page Views Over Time</span>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-neutral-600 font-medium shrink-0">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{dateRange.label}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative p-3 sm:p-4 md:p-6">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-52 sm:h-64 md:h-80">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 sm:h-64 md:h-80 text-neutral-500">
              <p className="text-base sm:text-lg font-semibold mb-2">No data available</p>
              <p className="text-xs sm:text-sm text-center max-w-md px-4 leading-relaxed">
                No page view data was found for the selected date range. Try selecting a different date range or check
                your Google Analytics configuration.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-full min-w-0 overflow-hidden">
              <ChartContainer
                config={{
                  pageViews: {
                    label: "Page Views",
                    color: "#3B82F6",
                  },
                }}
                className="h-52 sm:h-64 md:h-80 w-full max-w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data}
                    margin={{
                      top: 10,
                      right: 5,
                      left: -15,
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
                      stroke="#e5e7eb"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      fontSize={10}
                      tick={{ fill: "#374151", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      angle={data.length > 7 ? -45 : 0}
                      textAnchor={data.length > 7 ? "end" : "middle"}
                      height={data.length > 7 ? 50 : 25}
                    />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={10}
                      tick={{ fill: "#374151", fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      width={35}
                    />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-neutral-200 rounded-lg p-3 shadow-lg">
                              <p className="text-neutral-700 text-sm font-medium mb-1">{label}</p>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-neutral-900 text-sm">
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
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500 text-xs font-medium">Total:</span>
                    <span className="text-neutral-900 text-sm font-bold">{data.reduce((sum, item) => sum + item.pageViews, 0).toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500 text-xs font-medium">Avg:</span>
                    <span className="text-neutral-900 text-sm font-bold">
                      {Math.round(data.reduce((sum, item) => sum + item.pageViews, 0) / data.length).toLocaleString()}/day
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-xs text-neutral-500 font-medium">Source: {dataSource}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
