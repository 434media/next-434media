"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { Smartphone, Monitor, Loader2, Users, MousePointer } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface DeviceBreakdownProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
}

const getDeviceIcon = (device: string) => {
  switch (device.toLowerCase()) {
    case "mobile":
      return <Smartphone className="h-8 w-8 text-emerald-400" />
    case "desktop":
      return <Monitor className="h-8 w-8 text-blue-400" />
    default:
      return <Monitor className="h-8 w-8 text-gray-400" />
  }
}

const getDeviceGradient = (device: string) => {
  switch (device.toLowerCase()) {
    case "mobile":
      return "from-emerald-500/20 to-emerald-600/10"
    case "desktop":
      return "from-blue-500/20 to-blue-600/10"
    default:
      return "from-gray-500/20 to-gray-600/10"
  }
}

const getDeviceColor = (device: string) => {
  switch (device.toLowerCase()) {
    case "mobile":
      return "from-emerald-500 to-emerald-600"
    case "desktop":
      return "from-blue-500 to-blue-600"
    default:
      return "from-gray-500 to-gray-600"
  }
}

export function DeviceBreakdown({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
}: DeviceBreakdownProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const adminKey = sessionStorage.getItem("adminKey")

        let url = `/api/analytics?endpoint=devices&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        const response = await fetch(url, {
          headers: {
            "x-admin-key": adminKey || "",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch device data")
        }

        const result = await response.json()
        // Filter out tablet and focus on mobile/desktop
        const filteredData = result.data.filter(
          (item: any) =>
            item.deviceCategory.toLowerCase() === "mobile" || item.deviceCategory.toLowerCase() === "desktop",
        )
        setData(filteredData)
      } catch (error) {
        console.error("Error loading device data:", error)
        setError("Failed to load device data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange, setError, propertyId])

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 rounded-lg" />
        <CardHeader className="relative pb-6">
          <CardTitle className="text-white flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl">
              <Smartphone className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="text-xl">Device Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-cyan-400" />
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {data.map((device, index) => {
                const percentage = totalSessions > 0 ? (device.sessions / totalSessions) * 100 : 0

                return (
                  <motion.div
                    key={device.deviceCategory}
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      delay: index * 0.2,
                      type: "spring",
                      stiffness: 100,
                      damping: 15,
                    }}
                    className={`
                      group relative overflow-hidden rounded-3xl 
                      bg-gradient-to-br ${getDeviceGradient(device.deviceCategory)} 
                      border border-white/10 hover:border-white/25 
                      transition-all duration-700 ease-out
                      hover:scale-[1.03] cursor-pointer
                      backdrop-blur-xl shadow-2xl
                      hover:shadow-3xl
                    `}
                  >
                    {/* Animated background glow */}
                    <div
                      className={`
                        absolute inset-0 bg-gradient-to-br ${getDeviceColor(device.deviceCategory)} 
                        opacity-0 group-hover:opacity-10 transition-opacity duration-700
                      `}
                    />

                    <div className="relative p-8 space-y-8">
                      {/* Header with icon and device name */}
                      <div className="flex items-center gap-5">
                        <motion.div
                          className={`
                            p-4 bg-gradient-to-br ${getDeviceColor(device.deviceCategory)} 
                            rounded-2xl shadow-xl group-hover:scale-110 
                            transition-transform duration-500
                          `}
                          whileHover={{ rotate: 8 }}
                        >
                          {getDeviceIcon(device.deviceCategory)}
                        </motion.div>
                        <div>
                          <h3 className="text-white font-bold text-2xl capitalize leading-tight">
                            {device.deviceCategory}
                          </h3>
                          <p className="text-white/60 text-base mt-1">Device category</p>
                        </div>
                      </div>

                      {/* Percentage - Hero metric */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.2 + 0.4, type: "spring", stiffness: 200 }}
                        className="text-center py-4"
                      >
                        <div className="text-6xl font-black text-white leading-none mb-2">{percentage.toFixed(0)}%</div>
                        <p className="text-white/70 text-lg">of total traffic</p>
                      </motion.div>

                      {/* Key metrics - simplified */}
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 text-white/60 text-sm mb-2">
                            <MousePointer className="h-4 w-4" />
                            <span>Sessions</span>
                          </div>
                          <div className="text-3xl font-bold text-white">{device.sessions.toLocaleString()}</div>
                        </div>

                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 text-white/60 text-sm mb-2">
                            <Users className="h-4 w-4" />
                            <span>Users</span>
                          </div>
                          <div className="text-3xl font-bold text-white">{device.users.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Animated progress bar */}
                      <div className="space-y-3">
                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 2, delay: index * 0.3 + 0.6, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${getDeviceColor(device.deviceCategory)} rounded-full shadow-lg`}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
