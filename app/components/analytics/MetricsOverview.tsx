"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent } from "./Card"
import { Eye, Users, MousePointer, TrendingUp, TrendingDown, Loader2, Activity } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface MetricsOverviewProps {
  dateRange: DateRange
  isLoading?: boolean
  setError?: React.Dispatch<React.SetStateAction<string | null>>
  adminKey?: string
}

interface MetricData {
  totalPageViews: number
  totalSessions: number
  totalUsers: number
  averageBounceRate: number
  pageViewsChange: number
  sessionsChange: number
  usersChange: number
  bounceRateChange: number
  activeUsers: number
}

export function MetricsOverview({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  adminKey,
}: MetricsOverviewProps) {
  const [data, setData] = useState<MetricData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      console.log("[MetricsOverview] Starting loadData...")
      setIsLoading(true)

      try {
        // Get admin key from props or session storage
        const authKey = adminKey || sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")

        console.log("[MetricsOverview] Auth key found:", !!authKey)
        console.log("[MetricsOverview] Date range:", dateRange)

        if (!authKey) {
          throw new Error("No admin key found - please log in again")
        }

        const url = `/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        console.log("[MetricsOverview] Making request to:", url)

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": authKey,
          },
        })

        console.log("[MetricsOverview] Response status:", response.status)
        console.log("[MetricsOverview] Response headers:", Object.fromEntries(response.headers.entries()))

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[MetricsOverview] Error response text:", errorText)

          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }

          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        const result = await response.json()
        console.log("[MetricsOverview] Success response:", result)

        // Ensure we have valid data structure
        const validatedData: MetricData = {
          totalPageViews: result.totalPageViews || 0,
          totalSessions: result.totalSessions || 0,
          totalUsers: result.totalUsers || 0,
          averageBounceRate: result.averageBounceRate || 0,
          pageViewsChange: result.pageViewsChange || 0,
          sessionsChange: result.sessionsChange || 0,
          usersChange: result.usersChange || 0,
          bounceRateChange: result.bounceRateChange || 0,
          activeUsers: result.activeUsers || 0,
        }

        setData(validatedData)
      } catch (error) {
        console.error("[MetricsOverview] Error in loadData:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (setError) {
          setError(`Failed to load metrics: ${errorMessage}`)
        } else {
          console.error("No setError function provided to handle error:", errorMessage)
        }
      } finally {
        setIsLoading(false)
      }
    }

    // Only load data if we have a valid date range
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      loadData()
    } else {
      console.warn("[MetricsOverview] Invalid date range:", dateRange)
      setIsLoading(false)
    }
  }, [dateRange, setError, adminKey])

  const activeUsersMetric = {
    title: "Active Users",
    value: data?.activeUsers || 0,
    icon: Activity,
    color: "from-green-500 to-emerald-500",
    bgColor: "from-green-500/20 to-emerald-500/20",
    shadowColor: "shadow-green-500/25",
  }

  const metrics = [
    {
      title: "Page Views",
      value: data?.totalPageViews || 0,
      change: data?.pageViewsChange || 0,
      icon: Eye,
      color: "from-blue-500 to-cyan-500",
      bgColor: "from-blue-500/20 to-cyan-500/20",
      shadowColor: "shadow-blue-500/25",
    },
    {
      title: "Sessions",
      value: data?.totalSessions || 0,
      change: data?.sessionsChange || 0,
      icon: MousePointer,
      color: "from-emerald-500 to-teal-500",
      bgColor: "from-emerald-500/20 to-teal-500/20",
      shadowColor: "shadow-emerald-500/25",
    },
    {
      title: "Users",
      value: data?.totalUsers || 0,
      change: data?.usersChange || 0,
      icon: Users,
      color: "from-purple-500 to-pink-500",
      bgColor: "from-purple-500/20 to-pink-500/20",
      shadowColor: "shadow-purple-500/25",
    },
    {
      title: "Bounce Rate",
      value: data?.averageBounceRate || 0,
      change: data?.bounceRateChange || 0,
      icon: TrendingUp,
      color: "from-orange-500 to-red-500",
      bgColor: "from-orange-500/20 to-red-500/20",
      shadowColor: "shadow-orange-500/25",
      isPercentage: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
      {/* Real-time Active Users - 1st card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.6,
          delay: 0.4,
          type: "spring",
          stiffness: 100,
        }}
        className="col-span-1"
      >
        <Card
          className={`
          relative overflow-hidden border-0 
          bg-gradient-to-br from-white/10 to-white/5 
          backdrop-blur-xl shadow-2xl ${activeUsersMetric.shadowColor}
          hover:shadow-3xl hover:scale-105 
          transition-all duration-500 ease-out
          group cursor-pointer h-[120px]
        `}
        >
          <div
            className={`
            absolute inset-0 bg-gradient-to-br ${activeUsersMetric.bgColor} 
            opacity-0 group-hover:opacity-100 transition-opacity duration-500
          `}
          />

          <div
            className={`
            absolute inset-0 rounded-xl bg-gradient-to-br ${activeUsersMetric.color} 
            opacity-20 blur-sm group-hover:opacity-40 transition-opacity duration-500
          `}
          />

          <CardContent className="relative p-5 h-full flex flex-col justify-between mt-2">
            {isLoading || parentLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <motion.div
                    className={`
                      p-2.5 bg-gradient-to-br ${activeUsersMetric.color} 
                      rounded-xl shadow-lg group-hover:scale-110 
                      transition-transform duration-300
                    `}
                    whileHover={{ rotate: 5 }}
                  >
                    <activeUsersMetric.icon className="h-4 w-4 text-white drop-shadow-sm" />
                  </motion.div>

                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.7, 1, 0.7],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                      className="w-2 h-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"
                    />
                    <span className="text-emerald-300 text-xs font-medium">LIVE</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.6,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className="text-2xl font-bold text-white drop-shadow-sm leading-none"
                  >
                    {activeUsersMetric.value.toLocaleString()}
                  </motion.div>
                  <p className="text-white/70 text-sm font-medium leading-none">{activeUsersMetric.title}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Metrics - 4 cards */}
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.title}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.6,
            delay: index * 0.1,
            type: "spring",
            stiffness: 100,
          }}
          className="col-span-1"
        >
          <Card
            className={`
            relative overflow-hidden border-0 
            bg-gradient-to-br from-white/10 to-white/5 
            backdrop-blur-xl shadow-2xl ${metric.shadowColor}
            hover:shadow-3xl hover:scale-105 
            transition-all duration-500 ease-out
            group cursor-pointer h-[120px]
          `}
          >
            <div
              className={`
              absolute inset-0 bg-gradient-to-br ${metric.bgColor} 
              opacity-0 group-hover:opacity-100 transition-opacity duration-500
            `}
            />

            <div
              className={`
              absolute inset-0 rounded-xl bg-gradient-to-br ${metric.color} 
              opacity-20 blur-sm group-hover:opacity-40 transition-opacity duration-500
            `}
            />

            <CardContent className="relative p-5 h-full flex flex-col justify-between mt-2">
              {isLoading || parentLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <motion.div
                      className={`
                        p-2.5 bg-gradient-to-br ${metric.color} 
                        rounded-xl shadow-lg group-hover:scale-110 
                        transition-transform duration-300
                      `}
                      whileHover={{ rotate: 5 }}
                    >
                      <metric.icon className="h-4 w-4 text-white drop-shadow-sm" />
                    </motion.div>

                    {metric.change !== 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + 0.4, type: "spring" }}
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                          ${
                            metric.change > 0
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }
                        `}
                      >
                        {metric.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(metric.change).toFixed(1)}%
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200,
                      }}
                      className="text-2xl font-bold text-white drop-shadow-sm leading-none"
                    >
                      {metric.isPercentage ? `${(metric.value * 100).toFixed(1)}%` : metric.value.toLocaleString()}
                    </motion.div>
                    <p className="text-white/70 text-sm font-medium leading-none">{metric.title}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
