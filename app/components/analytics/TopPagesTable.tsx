"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { FileText, ExternalLink, Loader2, Eye } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface TopPagesTableProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
}

export function TopPagesTable({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
}: TopPagesTableProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        let url = `/api/analytics?endpoint=toppages&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }))
          console.error("Top pages API error:", response.status, errorData)
          throw new Error(errorData.error || "Failed to fetch top pages data")
        }

        const result = await response.json()
        setData(result.data)
      } catch (error) {
        console.error("Error loading top pages:", error)
        setError("Failed to load top pages data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange, setError, propertyId])

  const totalViews = data.reduce((sum, page) => sum + page.pageViews, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="h-full"
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl h-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 rounded-lg" />

        <CardHeader className="relative pb-4 sm:pb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div
              className="p-2 sm:p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg sm:rounded-xl shadow-lg shrink-0"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
            </motion.div>
            <div className="min-w-0">
              <CardTitle className="text-white text-base sm:text-xl font-bold mb-0.5 sm:mb-1">Top Pages</CardTitle>
              <p className="text-white/60 text-xs sm:text-sm font-medium truncate">
                {totalViews.toLocaleString()} views • {data.length} pages
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-emerald-400" />
              </motion.div>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.slice(0, 10).map((page, index) => {
                // Create a unique key using path, index, and pageViews to ensure uniqueness
                const uniqueKey = `page-${index}-${(page.path || "unknown").replace(/[^a-zA-Z0-9]/g, "-")}-${page.pageViews || 0}`
                const percentage = totalViews > 0 ? (page.pageViews / totalViews) * 100 : 0

                return (
                  <motion.div
                    key={uniqueKey}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group p-3 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-white/10 text-emerald-400 flex-shrink-0">
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium text-xs sm:text-sm truncate max-w-[180px] sm:max-w-none">{page.title || page.path}</h3>
                          <ExternalLink className="h-3 w-3 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
                        </div>
                        <p className="text-white/60 text-[10px] sm:text-xs truncate mb-2 max-w-[200px] sm:max-w-none">{page.path}</p>
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: index * 0.1, type: "spring", stiffness: 100 }}
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-white/60 text-[10px] sm:text-xs font-medium">{percentage.toFixed(1)}%</p>
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <span className="text-white font-bold text-xs sm:text-sm">{page.pageViews.toLocaleString()}</span>
                            <span className="text-white/60 text-[10px] sm:text-xs">views</span>
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
