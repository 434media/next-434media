"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { ExternalLink, TrendingUp, TrendingDown, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface TopPagesTableProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface PageData {
  page: string
  views: number
  change: number
}

export function TopPagesTable({ timeRange, isLoading: parentLoading = false, setError }: TopPagesTableProps) {
  const [data, setData] = useState<PageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setTableError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true)
      }
      setTableError(null)

      try {
        const result = await fetchAnalyticsData("top-pages", timeRange)
        setData(result || [])
        setRetryCount(0) // Reset retry count on success
      } catch (error) {
        console.error("Error loading top pages data:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to load top pages data"
        setTableError(errorMessage)
        setError(errorMessage)
      } finally {
        if (showLoading) {
          setIsLoading(false)
        }
      }
    },
    [timeRange, setError],
  )

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
    loadData(true)
  }, [loadData])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  // Reset when parent triggers reload
  useEffect(() => {
    if (parentLoading) {
      setIsLoading(true)
    }
  }, [parentLoading])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-purple-400" />
              Top Pages
            </div>
            {error && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleRetry}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title="Retry loading data"
              >
                <RefreshCw className="h-4 w-4 text-white" />
              </motion.button>
            )}
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
                    <Loader2 className="h-12 w-12 text-purple-400 mx-auto" />
                  </motion.div>
                  <p className="text-white/70">Loading top pages...</p>
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
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  >
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                  </motion.div>
                  <div className="space-y-2">
                    <p className="text-red-400 font-medium">Unable to load data</p>
                    <p className="text-white/60 text-sm max-w-[250px]">{error}</p>
                    {retryCount > 0 && <p className="text-white/40 text-xs">Retry attempt: {retryCount}</p>}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </motion.button>
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
                    <p>No page data available for this time period</p>
                  </div>
                ) : (
                  data.map((page, index) => (
                    <motion.div
                      key={page.page}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index, duration: 0.3 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: index * 0.2 }}
                          className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                        />
                        <div>
                          <p className="text-white font-medium text-sm truncate max-w-[200px]">
                            {page.page === "/" ? "Homepage" : page.page}
                          </p>
                          <p className="text-white/60 text-xs">{page.views.toLocaleString()} views</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {page.change !== 0 && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              page.change > 0
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }`}
                          >
                            {page.change > 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(page.change).toFixed(1)}%
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
