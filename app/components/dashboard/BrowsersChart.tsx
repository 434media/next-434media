"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts"
import { Globe, Loader2, AlertCircle } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface BrowsersChartProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface BrowserData {
  name: string
  views: number
  percentage: number
}

export function BrowsersChart({ timeRange, isLoading: parentLoading = false, setError }: BrowsersChartProps) {
  const [data, setData] = useState<BrowserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setChartError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setChartError(null)

      try {
        const result = await fetchAnalyticsData("browsers", timeRange)
        console.log("Raw browsers data:", result)

        // Handle different possible data structures from Vercel Analytics API
        let processedData: BrowserData[] = []

        if (result) {
          // Handle mock data structure (development mode)
          if (result._mock && result.browsers && Array.isArray(result.browsers)) {
            processedData = result.browsers.map((item: any) => ({
              name: item.browser || item.name || "Unknown",
              views: item.views || item.visits || 0,
              percentage: item.percentage || 0,
            }))
          }
          // Handle real Vercel Analytics API response
          else if (Array.isArray(result)) {
            // Direct array response
            processedData = result.map((item: any) => ({
              name: item.browser || item.name || "Unknown",
              views: item.visits || item.views || item.value || 0,
              percentage: item.percentage || 0,
            }))
          } else if (result.browsers && Array.isArray(result.browsers)) {
            // Nested browsers array
            processedData = result.browsers.map((item: any) => ({
              name: item.browser || item.name || "Unknown",
              views: item.visits || item.views || item.value || 0,
              percentage: item.percentage || 0,
            }))
          } else if (result.data && Array.isArray(result.data)) {
            // Data nested in 'data' property
            processedData = result.data.map((item: any) => ({
              name: item.browser || item.name || "Unknown",
              views: item.visits || item.views || item.value || 0,
              percentage: item.percentage || 0,
            }))
          }
          // Handle single object response
          else if (typeof result === "object" && !Array.isArray(result)) {
            // Convert object to array format
            processedData = Object.entries(result)
              .filter(([key]) => key !== "_mock" && key !== "_timestamp" && key !== "_fallback")
              .map(([browser, value]: [string, any]) => ({
                name: browser,
                views: typeof value === "number" ? value : value?.visits || value?.views || 0,
                percentage: 0,
              }))
          }

          // Calculate percentages if not provided
          if (processedData.length > 0) {
            const total = processedData.reduce((sum, item) => sum + item.views, 0)
            if (total > 0) {
              processedData = processedData.map((item) => ({
                ...item,
                percentage: (item.views / total) * 100,
              }))
            }
          }

          // Sort by views descending and limit to top 10
          processedData = processedData
            .sort((a, b) => b.views - a.views)
            .slice(0, 10)
            .filter((item) => item.views > 0)
        }

        console.log("Processed browsers data:", processedData)
        setData(processedData)
      } catch (error) {
        console.error("Error loading browsers chart data:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to load browsers chart data"
        setChartError(errorMessage)
        setError(errorMessage)

        // Set empty data on error
        setData([])
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

  const getBrowserColor = (name: string) => {
    const colors: Record<string, string> = {
      Chrome: "#4285F4",
      Safari: "#0fb5ee",
      Firefox: "#ff9500",
      Edge: "#0078D7",
      Opera: "#ff1b2d",
      "Internet Explorer": "#1e90ff",
      Other: "#8b5cf6",
      Unknown: "#6b7280",
    }
    return colors[name] || "#8b5cf6"
  }

  const prepareChartData = () => {
    if (!Array.isArray(data) || data.length === 0) {
      console.log("No valid data array for browsers chart")
      return []
    }

    return data.map((browser, index) => ({
      ...browser,
      id: `browser-${index}`,
      color: getBrowserColor(browser.name),
    }))
  }

  const chartData = prepareChartData()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-400" />
            Browsers
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-[250px]">
              <div className="text-center space-y-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Loader2 className="h-12 w-12 text-cyan-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading browser data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[250px]">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                <p className="text-red-400">{error}</p>
                <button
                  onClick={() => {
                    setChartError(null)
                    setError(null)
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px]">
              <div className="text-center space-y-4">
                <Globe className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="text-white/70">No browser data available</p>
              </div>
            </div>
          ) : (
            <div className="h-[250px]">
              <ChartContainer
                config={Object.fromEntries(
                  chartData.map((browser) => [
                    browser.name.toLowerCase().replace(/\s+/g, "-"),
                    { label: browser.name, color: browser.color },
                  ]),
                )}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                      width={80}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      contentStyle={{
                        backgroundColor: "rgba(0,0,0,0.8)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
