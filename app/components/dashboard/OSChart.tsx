"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Monitor, Loader2, AlertCircle } from "lucide-react"
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
}

export function OSChart({ timeRange, isLoading: parentLoading = false, setError }: OSChartProps) {
  const [data, setData] = useState<OSData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setChartError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setChartError(null)

      try {
        const result = await fetchAnalyticsData("operating-systems", timeRange)
        setData(result || [])
      } catch (error) {
        console.error("Error loading OS chart data:", error)
        setChartError("Failed to load OS chart data")
        setError("Failed to load OS chart data")
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

  const getOSColor = (name: string) => {
    const colors: Record<string, string> = {
      Windows: "#0078d7",
      macOS: "#5d5d5d",
      iOS: "#007aff",
      Android: "#a4c639",
      Linux: "#f8c517",
      "Chrome OS": "#4285f4",
    }
    return colors[name] || "#8b5cf6"
  }

  const getOSIcon = (name: string) => {
    return <span className="text-sm font-semibold">{name.substring(0, 2)}</span>
  }

  const prepareChartData = () => {
    if (!data || data.length === 0) return []

    return data.map((os) => ({
      ...os,
      color: getOSColor(os.name),
    }))
  }

  const chartData = prepareChartData()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-400" />
            Operating Systems
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
                  <Loader2 className="h-12 w-12 text-blue-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading OS data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[200px]">
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
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-full lg:w-1/2">
                <ChartContainer
                  config={Object.fromEntries(
                    chartData.map((os) => [
                      os.name.toLowerCase().replace(/\s+/g, "-"),
                      { label: os.name, color: os.color },
                    ]),
                  )}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
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
              </div>

              <div className="w-full lg:w-1/2 space-y-3">
                {chartData.map((os, index) => (
                  <motion.div
                    key={os.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index, duration: 0.3 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${os.color}30` }}
                      >
                        {getOSIcon(os.name)}
                      </motion.div>
                      <span className="text-white font-medium">{os.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{os.percentage.toFixed(1)}%</p>
                      <p className="text-white/60 text-xs">{os.views.toLocaleString()}</p>
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
