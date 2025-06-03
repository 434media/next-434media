"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Monitor, Smartphone, Tablet, Loader2, AlertCircle } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface DeviceChartProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface DeviceData {
  device: string
  visits: number
  percentage?: number
}

export function DeviceChart({ timeRange, isLoading: parentLoading = false, setError }: DeviceChartProps) {
  const [data, setData] = useState<DeviceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setChartError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setChartError(null)

      try {
        const result = await fetchAnalyticsData("devices", timeRange)

        let processedData: DeviceData[] = []

        // Handle different response formats
        if (Array.isArray(result)) {
          processedData = result.map((item: any) => ({
            device: item.device || item.name || "Unknown",
            visits: item.visits || item.views || item.value || 0,
          }))
        } else if (result && typeof result === "object") {
          // Handle object response with devices array
          if (result.devices && Array.isArray(result.devices)) {
            processedData = result.devices.map((item: any) => ({
              device: item.device || item.name || "Unknown",
              visits: item.visits || item.views || item.value || 0,
            }))
          }
          // Handle direct object properties (desktop, mobile, tablet)
          else if (result.desktop !== undefined || result.mobile !== undefined) {
            processedData = [
              { device: "desktop", visits: result.desktop || 0 },
              { device: "mobile", visits: result.mobile || 0 },
              { device: "tablet", visits: result.tablet || 0 },
            ].filter((item) => item.visits > 0)
          }
        }

        // Calculate percentages
        const total = processedData.reduce((sum, item) => sum + item.visits, 0)
        const chartData = processedData.map((item) => ({
          ...item,
          percentage: total > 0 ? (item.visits / total) * 100 : 0,
        }))

        setData(chartData)
      } catch (error) {
        console.error("Error loading device chart data:", error)
        setChartError("Failed to load device chart data")
        setError("Failed to load device chart data")
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

  const getDeviceIcon = (deviceName: string) => {
    const device = deviceName.toLowerCase()
    if (device.includes("desktop") || device.includes("computer")) return Monitor
    if (device.includes("mobile") || device.includes("phone")) return Smartphone
    if (device.includes("tablet") || device.includes("ipad")) return Tablet
    return Monitor // default
  }

  const getDeviceColor = (index: number) => {
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]
    return colors[index % colors.length]
  }

  const prepareChartData = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return []
    }

    return data.map((item, index) => ({
      name: item.device,
      value: item.visits,
      percentage: item.percentage?.toFixed(1) || "0",
      color: getDeviceColor(index),
      icon: getDeviceIcon(item.device),
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
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-blue-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <Monitor className="h-5 w-5 text-green-400" />
            Device Types
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
                  <Loader2 className="h-12 w-12 text-emerald-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading device data...</p>
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
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-white/70">No device data available</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-full lg:w-1/2">
                <ChartContainer
                  config={{
                    desktop: { label: "Desktop", color: "#10b981" },
                    mobile: { label: "Mobile", color: "#3b82f6" },
                    tablet: { label: "Tablet", color: "#f59e0b" },
                  }}
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
                        dataKey="value"
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
                {chartData.map((device, index) => {
                  const Icon = device.icon
                  return (
                    <motion.div
                      key={device.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index, duration: 0.3 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <motion.div whileHover={{ scale: 1.1, rotate: 5 }} style={{ color: device.color }}>
                          <Icon className="h-5 w-5" />
                        </motion.div>
                        <span className="text-white font-medium capitalize">{device.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{device.percentage}%</p>
                        <p className="text-white/60 text-xs">{device.value.toLocaleString()}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
