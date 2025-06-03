"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
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
        setData(result || [])
      } catch (error) {
        console.error("Error loading browsers chart data:", error)
        setChartError("Failed to load browsers chart data")
        setError("Failed to load browsers chart data")
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
      Other: "#8b5cf6",
    }
    return colors[name] || "#8b5cf6"
  }

  const prepareChartData = () => {
    if (!data || data.length === 0) return []

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
                  onClick={() => setChartError(null)}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                >
                  Retry
                </button>
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
