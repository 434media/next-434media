"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent } from "./Card"
import { Eye, Users, MousePointer, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface MetricsOverviewProps {
  dateRange: DateRange
  isLoading?: boolean
  setError?: React.Dispatch<React.SetStateAction<string | null>>
  adminKey?: string
  propertyId?: string
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
}

export function MetricsOverview({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  adminKey,
  propertyId,
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
        console.log("[MetricsOverview] Property ID:", propertyId)

        if (!authKey) {
          throw new Error("No admin key found - please log in again")
        }

        let url = `/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

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
          averageBounceRate: result.bounceRate || 0, // Note: API returns 'bounceRate', not 'averageBounceRate'
          pageViewsChange: result.pageViewsChange || 0,
          sessionsChange: result.sessionsChange || 0,
          usersChange: result.usersChange || 0,
          bounceRateChange: result.bounceRateChange || 0,
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
  }, [dateRange, setError, adminKey, propertyId])

  const metrics = [
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
      title: "Sessions",
      value: data?.totalSessions || 0,
      change: data?.sessionsChange || 0,
      icon: MousePointer,
      color: "from-emerald-500 to-teal-500",
      bgColor: "from-emerald-500/20 to-teal-500/20",
      shadowColor: "shadow-emerald-500/25",
    },
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {/* Main Metrics - 2x2 grid on mobile, 4 columns on desktop */}
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
            group cursor-pointer 
            h-[140px] sm:h-[120px] lg:h-[120px]
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

            <CardContent className="relative p-4 sm:p-5 lg:p-5 h-full flex flex-col justify-between mt-1 sm:mt-2">
              {isLoading || parentLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-white/60 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3 sm:mb-3">
                    <motion.div
                      className={`
                        p-2 sm:p-2.5 bg-gradient-to-br ${metric.color} 
                        rounded-lg sm:rounded-xl shadow-lg group-hover:scale-110 
                        transition-transform duration-300 mt-4 md:mt-0
                      `}
                      whileHover={{ rotate: 5 }}
                    >
                      <metric.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white drop-shadow-sm" />
                    </motion.div>

                    {metric.change !== 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + 0.4, type: "spring" }}
                        className={`
                          flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 
                          rounded-full text-[10px] sm:text-xs font-medium
                          ${
                            metric.change > 0
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }
                        `}
                      >
                        {metric.change > 0 ? (
                          <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        )}
                        <span className="hidden xs:inline">{Math.abs(metric.change).toFixed(1)}%</span>
                        <span className="xs:hidden">{Math.abs(metric.change).toFixed(0)}%</span>
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-0.5 sm:space-y-1">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200,
                      }}
                      className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm leading-none"
                    >
                      {metric.isPercentage ? `${(metric.value * 100).toFixed(1)}%` : metric.value.toLocaleString()}
                    </motion.div>
                    <p className="text-white/70 text-xs sm:text-sm font-medium leading-none">{metric.title}</p>
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
