"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
    <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
      <Card className="border border-neutral-200 bg-white shadow-lg h-full overflow-hidden w-full max-w-full">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-teal-50/50 rounded-lg" />

        <CardHeader className="relative pb-4 sm:pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg sm:rounded-xl shadow-sm shrink-0 transition-transform hover:scale-105">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-neutral-900 text-base sm:text-lg font-bold mb-0.5 leading-tight">Top Pages</CardTitle>
              <p className="text-neutral-600 text-xs sm:text-sm font-medium truncate">
                {totalViews.toLocaleString()} views • {data.length} pages
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.slice(0, 10).map((page, index) => {
                // Create a unique key using path, index, and pageViews to ensure uniqueness
                const uniqueKey = `page-${index}-${(page.path || "unknown").replace(/[^a-zA-Z0-9]/g, "-")}-${page.pageViews || 0}`
                const percentage = totalViews > 0 ? (page.pageViews / totalViews) * 100 : 0

                return (
                  <div
                    key={uniqueKey}
                    className="group p-3 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-neutral-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-md"
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-100 text-emerald-600 flex-shrink-0 mt-0.5">
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-neutral-900 font-semibold text-xs sm:text-sm leading-tight line-clamp-2">{page.title || page.path}</h3>
                          <ExternalLink className="h-3.5 w-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
                        </div>
                        <p className="text-neutral-500 text-[11px] sm:text-xs font-medium truncate mb-2">{page.path}</p>
                        <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            style={{ width: `${percentage}%` }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-neutral-600 text-[11px] sm:text-xs font-semibold">{percentage.toFixed(1)}%</p>
                          <div className="flex items-center gap-1">
                            <span className="text-neutral-900 font-bold text-xs sm:text-sm">{page.pageViews.toLocaleString()}</span>
                            <span className="text-neutral-500 text-[10px] sm:text-xs font-medium">views</span>
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
