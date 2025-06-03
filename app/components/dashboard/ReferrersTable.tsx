"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Link, TrendingUp, TrendingDown, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface ReferrersTableProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface ReferrerData {
  referrer: string
  views: number
  change: number
}

export function ReferrersTable({ timeRange, isLoading: parentLoading = false, setError }: ReferrersTableProps) {
  const [data, setData] = useState<ReferrerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setTableError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setTableError(null)

      try {
        const result = await fetchAnalyticsData("referrers", timeRange)
        setData(result || [])
      } catch (error) {
        console.error("Error loading referrers data:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to load referrers data"
        setTableError(errorMessage)
        setError(errorMessage)
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

  const getReferrerIcon = (referrer: string) => {
    const icons: Record<string, React.ReactNode> = {
      Google: <span className="text-lg">G</span>,
      Twitter: <span className="text-lg">𝕏</span>,
      LinkedIn: <span className="text-lg">in</span>,
      Facebook: <span className="text-lg">f</span>,
      GitHub: <span className="text-lg">GH</span>,
      Instagram: <span className="text-lg">IG</span>,
      YouTube: <span className="text-lg">YT</span>,
    }

    return icons[referrer] || <Link className="h-4 w-4" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-orange-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <Link className="h-5 w-5 text-pink-400" />
            Top Referrers
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <AnimatePresence mode="wait">
            {isLoading || parentLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-[300px]"
              >
                <div className="text-center space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  >
                    <Loader2 className="h-12 w-12 text-pink-400 mx-auto" />
                  </motion.div>
                  <p className="text-white/70">Loading referrers data...</p>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-center h-[300px]"
              >
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                  <p className="text-red-400">{error}</p>
                  <button
                    onClick={() => setTableError(null)}
                    className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {data.length === 0 ? (
                  <div className="text-center py-12 text-white/60">
                    <p>No referrer data available for this time period</p>
                  </div>
                ) : (
                  data.map((referrer, index) => (
                    <motion.div
                      key={referrer.referrer}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index, duration: 0.3 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center text-white/80">
                          {getReferrerIcon(referrer.referrer)}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{referrer.referrer}</p>
                          <p className="text-white/60 text-xs">{referrer.views.toLocaleString()} visits</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {referrer.change !== 0 && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              referrer.change > 0
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }`}
                          >
                            {referrer.change > 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(referrer.change).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}
