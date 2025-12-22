"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Eye, Users, MousePointer, Clock, TrendingUp, TrendingDown, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react"
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
        console.log("[MetricsOverview] Date range:", dateRange)
        console.log("[MetricsOverview] Property ID:", propertyId)

        let url = `/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        console.log("[MetricsOverview] Making request to:", url)

        const response = await fetch(url)

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

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toLocaleString()
  }

  const metrics = [
    {
      title: "Total Users",
      subtitle: "Unique visitors",
      value: data?.totalUsers || 0,
      change: data?.usersChange || 0,
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      title: "Sessions",
      subtitle: "Total visits",
      value: data?.totalSessions || 0,
      change: data?.sessionsChange || 0,
      icon: MousePointer,
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      title: "Page Views",
      subtitle: "Pages loaded",
      value: data?.totalPageViews || 0,
      change: data?.pageViewsChange || 0,
      icon: Eye,
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      title: "Bounce Rate",
      subtitle: "Single-page visits",
      value: data?.averageBounceRate || 0,
      change: data?.bounceRateChange || 0,
      icon: Clock,
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      iconColor: "text-amber-400",
      isPercentage: true,
      invertChange: true, // Lower bounce rate is better
    },
  ]

  const loading = isLoading || parentLoading

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 w-full overflow-hidden">
      {metrics.map((metric) => {
        const changeValue = metric.change || 0
        const isPositive = metric.invertChange ? changeValue < 0 : changeValue > 0
        const isNegative = metric.invertChange ? changeValue > 0 : changeValue < 0
        const hasChange = changeValue !== 0

        return (
          <div
            key={metric.title}
            className="relative group min-w-0"
          >
            {/* Card */}
            <div className="relative overflow-hidden rounded-lg sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-2.5 sm:p-5 transition-all duration-300 hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.04]">
              {/* Gradient accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${metric.color} opacity-60`} />
              
              {/* Loading state */}
              {loading ? (
                <div className="flex flex-col items-center justify-center h-[80px] sm:h-[100px]">
                  <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-white/40 animate-spin" />
                  <span className="text-[10px] sm:text-xs text-white/40 mt-2">Loading...</span>
                </div>
              ) : (
                <>
                  {/* Header: Icon and Change Badge */}
                  <div className="flex items-start justify-between mb-2 sm:mb-4">
                    <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl ${metric.bgColor}`}>
                      <metric.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${metric.iconColor}`} />
                    </div>
                    
                    {hasChange && (
                      <div
                        className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                          isPositive
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : isNegative
                            ? "bg-red-500/15 text-red-400 border border-red-500/20"
                            : "bg-white/10 text-white/60 border border-white/10"
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        ) : (
                          <ArrowDownRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        )}
                        <span>{Math.abs(changeValue).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  <div className="mb-0.5 sm:mb-1">
                    <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
                      {metric.isPercentage 
                        ? `${(metric.value * 100).toFixed(1)}%`
                        : formatNumber(metric.value)
                      }
                    </span>
                  </div>

                  {/* Title and Subtitle */}
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-white/90">{metric.title}</p>
                    <p className="text-[10px] sm:text-xs text-white/50 hidden sm:block">{metric.subtitle}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
