"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { Globe, Loader2, Users, MousePointer, TrendingUp } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { TwitterIcon, InstagramIcon, LinkedInIcon, FacebookIcon } from "./SocialIcons"

interface TrafficSourcesChartProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface SourceIconConfig {
  icon: React.ReactNode
  color: string
  gradientFrom: string
  gradientTo: string
}

const getSourceIconConfig = (source: string): SourceIconConfig => {
  const lowerSource = source.toLowerCase()

  // Main social platforms
  if (lowerSource.includes("facebook")) {
    return {
      icon: <FacebookIcon />,
      color: "text-[#1877F2]",
      gradientFrom: "from-[#1877F2]/20",
      gradientTo: "to-[#1877F2]/5",
    }
  }
  if (lowerSource.includes("twitter") || lowerSource.includes("x.com") || lowerSource === "x") {
    return {
      icon: <TwitterIcon />,
      color: "text-[#1DA1F2]",
      gradientFrom: "from-[#1DA1F2]/20",
      gradientTo: "to-[#1DA1F2]/5",
    }
  }
  if (lowerSource.includes("linkedin")) {
    return {
      icon: <LinkedInIcon />,
      color: "text-[#0A66C2]",
      gradientFrom: "from-[#0A66C2]/20",
      gradientTo: "to-[#0A66C2]/5",
    }
  }
  if (lowerSource.includes("instagram")) {
    return {
      icon: <InstagramIcon />,
      color: "text-[#E4405F]",
      gradientFrom: "from-[#E4405F]/20",
      gradientTo: "to-[#E4405F]/5",
    }
  }

  // Direct traffic
  if (lowerSource.includes("direct") || lowerSource === "(direct)") {
    return {
      icon: <Globe className="h-5 w-5" />,
      color: "text-emerald-400",
      gradientFrom: "from-emerald-500/20",
      gradientTo: "to-emerald-600/5",
    }
  }

  // Google (special case since it's common)
  if (lowerSource.includes("google")) {
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
    color: "text-purple-400",
    gradientFrom: "from-purple-500/20",
    gradientTo: "to-purple-600/5",
  }
}

export function TrafficSourcesChart({
  dateRange,
  isLoading: parentLoading = false,
  setError,
}: TrafficSourcesChartProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const adminKey = sessionStorage.getItem("adminKey")
        const response = await fetch(
          `/api/analytics?endpoint=trafficsources&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          {
            headers: {
              "x-admin-key": adminKey || "",
            },
          },
        )

        if (!response.ok) {
          throw new Error("Failed to fetch traffic sources data")
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
  }, [dateRange, setError])

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="h-full"
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 rounded-lg" />

        <CardHeader className="relative pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl shadow-lg"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </motion.div>
              <div>
                <CardTitle className="text-white text-xl font-bold mb-1">Traffic Sources</CardTitle>
                <p className="text-white/60 text-sm font-medium">
                  {totalSessions.toLocaleString()} sessions • {data.length} sources
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-48">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-6 w-6 text-purple-400" />
              </motion.div>
            </div>
          ) : (
            <div className="space-y-4 max-h-80 md:max-h-110 overflow-y-auto pr-1">
              {data.map((source, index) => {
                const percentage = totalSessions > 0 ? (source.sessions / totalSessions) * 100 : 0
                const iconConfig = getSourceIconConfig(source.source)
                const displayName = source.source === "(direct)" ? "Direct Traffic" : source.source

                return (
                  <motion.div
                    key={source.source}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`group p-4 rounded-xl bg-gradient-to-r ${iconConfig.gradientFrom} ${iconConfig.gradientTo} border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg bg-white/10 ${iconConfig.color} flex-shrink-0`}>
                        {iconConfig.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-white font-medium text-base capitalize truncate">{displayName}</h3>

                        <div className="mt-3 w-full bg-white/10 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: index * 0.1, type: "spring", stiffness: 100 }}
                            className={`h-full bg-gradient-to-r from-white/40 to-white/20 rounded-full`}
                          />
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <p className="text-white/60 text-xs font-medium">{percentage.toFixed(1)}% of traffic</p>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <MousePointer className="h-3 w-3 text-white/60" />
                              <p className="text-white font-semibold text-sm">{source.sessions.toLocaleString()}</p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Users className="h-3 w-3 text-white/60" />
                              <p className="text-white font-semibold text-sm">{source.users.toLocaleString()}</p>
                            </div>
                          </div>
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
