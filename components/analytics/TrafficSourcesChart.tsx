"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { Globe, Loader2, Users, MousePointer, TrendingUp } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { TwitterIcon, InstagramIcon, LinkedInIcon, FacebookIcon } from "./SocialIcons"

interface TrafficSourcesChartProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
}

interface SourceIconConfig {
  icon: React.ReactNode
  color: string
  gradientFrom: string
  gradientTo: string
}

// Helper to safely check if source matches a platform domain or name
// Uses strict matching to prevent substring bypass attacks (e.g., evil.com/facebook)
const matchesPlatform = (source: string, patterns: string[]): boolean => {
  const lowerSource = source.toLowerCase()
  return patterns.some(pattern => {
    // Exact match
    if (lowerSource === pattern) return true
    // Match as subdomain (e.g., "m.facebook.com")
    if (lowerSource.endsWith(`.${pattern}`)) return true
    // Match domain at start (e.g., "facebook.com/page")
    if (lowerSource.startsWith(`${pattern}/`) || lowerSource.startsWith(`${pattern}?`)) return true
    // Match with www prefix
    if (lowerSource === `www.${pattern}` || lowerSource.startsWith(`www.${pattern}/`)) return true
    return false
  })
}

const getSourceIconConfig = (source: string): SourceIconConfig => {
  const lowerSource = source.toLowerCase()

  // Main social platforms - use strict domain matching
  if (matchesPlatform(lowerSource, ["facebook", "facebook.com", "fb.com", "fb.me"])) {
    return {
      icon: <FacebookIcon />,
      color: "text-[#1877F2]",
      gradientFrom: "from-[#1877F2]/20",
      gradientTo: "to-[#1877F2]/5",
    }
  }
  if (matchesPlatform(lowerSource, ["twitter", "twitter.com", "x", "x.com", "t.co"])) {
    return {
      icon: <TwitterIcon />,
      color: "text-[#1DA1F2]",
      gradientFrom: "from-[#1DA1F2]/20",
      gradientTo: "to-[#1DA1F2]/5",
    }
  }
  if (matchesPlatform(lowerSource, ["linkedin", "linkedin.com", "lnkd.in"])) {
    return {
      icon: <LinkedInIcon />,
      color: "text-[#0A66C2]",
      gradientFrom: "from-[#0A66C2]/20",
      gradientTo: "to-[#0A66C2]/5",
    }
  }
  if (matchesPlatform(lowerSource, ["instagram", "instagram.com", "instagr.am"])) {
    return {
      icon: <InstagramIcon />,
      color: "text-[#E4405F]",
      gradientFrom: "from-[#E4405F]/20",
      gradientTo: "to-[#E4405F]/5",
    }
  }

  // Direct traffic
  if (lowerSource === "direct" || lowerSource === "(direct)" || lowerSource === "(none)") {
    return {
      icon: <Globe className="h-5 w-5" />,
      color: "text-emerald-400",
      gradientFrom: "from-emerald-500/20",
      gradientTo: "to-emerald-600/5",
    }
  }

  // Google (special case since it's common) - use strict domain matching
  if (matchesPlatform(lowerSource, ["google", "google.com", "googleapis.com"])) {
    return {
      icon: <span className="text-lg">🔍</span>,
      color: "text-blue-400",
      gradientFrom: "from-blue-500/20",
      gradientTo: "to-blue-600/5",
    }
  }

  // Default for all other sources
  return {
    icon: <Globe className="h-5 w-5" />,
    color: "text-sky-400",
    gradientFrom: "from-sky-500/20",
    gradientTo: "to-cyan-600/5",
  }
}

export function TrafficSourcesChart({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
}: TrafficSourcesChartProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        let url = `/api/analytics?endpoint=trafficsources&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }))
          console.error("Traffic sources API error:", response.status, errorData)
          throw new Error(errorData.error || "Failed to fetch traffic sources data")
        }

        const result = await response.json()
        setData(result.data.slice(0, 6)) // Limit to top 6 sources
      } catch (error) {
        console.error("Error loading traffic sources:", error)
        setError("Failed to load traffic sources data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange, setError, propertyId])

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)

  return (
    <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
      <Card className="border border-neutral-200 bg-white shadow-lg h-full overflow-hidden w-full max-w-full">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 via-transparent to-cyan-50/50 rounded-lg" />

        <CardHeader className="relative pb-4 sm:pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-sky-100 to-cyan-100 rounded-lg sm:rounded-xl shadow-sm shrink-0 transition-transform hover:scale-105">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-sky-600" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-neutral-900 text-base sm:text-lg font-bold mb-0.5 leading-tight">Traffic Sources</CardTitle>
                <p className="text-neutral-600 text-xs sm:text-sm font-medium truncate">
                  {totalSessions.toLocaleString()} sessions • {data.length} sources
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 text-sky-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.map((source, index) => {
                const percentage = totalSessions > 0 ? (source.sessions / totalSessions) * 100 : 0
                const iconConfig = getSourceIconConfig(source.source)
                const displayName = source.source === "(direct)" ? "Direct Traffic" : source.source

                return (
                  <div
                    key={source.source}
                    className={`group p-3 sm:p-4 rounded-xl bg-gradient-to-r from-neutral-50 to-white border border-neutral-200 hover:border-neutral-300 transition-all duration-300 hover:shadow-md`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <div className={`p-2 sm:p-2.5 rounded-lg bg-neutral-100 ${iconConfig.color} flex-shrink-0`}>
                        {iconConfig.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-neutral-900 font-semibold text-sm capitalize truncate leading-tight">{displayName}</h3>

                        <div className="mt-2.5 w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                          <div
                            style={{ width: `${percentage}%` }}
                            className={`h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-700`}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between mt-2 gap-1">
                          <p className="text-neutral-600 text-[11px] sm:text-xs font-semibold">{percentage.toFixed(1)}% of traffic</p>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <MousePointer className="h-3 w-3 text-neutral-400" />
                              <p className="text-neutral-900 font-bold text-xs sm:text-sm">{source.sessions.toLocaleString()}</p>
                            </div>

                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-neutral-400" />
                              <p className="text-neutral-900 font-bold text-xs sm:text-sm">{source.users.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
