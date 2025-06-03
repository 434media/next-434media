"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Globe, TrendingUp, TrendingDown, Loader2, AlertCircle } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export interface CountriesTableProps {
  timeRange: string
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface CountryData {
  country: string
  code?: string
  views: number
  change?: number
  visits?: number // Added for Vercel Analytics API compatibility
}

export function CountriesTable({ timeRange, isLoading: parentLoading = false, setError }: CountriesTableProps) {
  const [data, setData] = useState<CountryData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setTableError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setTableError(null)

      try {
        const result = await fetchAnalyticsData("countries", timeRange)
        console.log("Raw countries data:", result)

        let processedData: CountryData[] = []

        if (result) {
          // Handle different possible response formats
          if (Array.isArray(result)) {
            // Direct array format: [{country: "US", visits: 100}, ...]
            processedData = result.map((item: any) => ({
              country: item.country || item.name || "Unknown",
              code: item.code || item.country,
              views: item.visits || item.views || item.value || 0,
              change: item.change || 0,
            }))
          } else if (result.countries && Array.isArray(result.countries)) {
            // Nested format: {countries: [{country: "US", visits: 100}, ...]}
            processedData = result.countries.map((item: any) => ({
              country: item.country || item.name || "Unknown",
              code: item.code || item.country,
              views: item.visits || item.views || item.value || 0,
              change: item.change || 0,
            }))
          } else if (result.data && Array.isArray(result.data)) {
            // Data nested format: {data: [{country: "US", visits: 100}, ...]}
            processedData = result.data.map((item: any) => ({
              country: item.country || item.name || "Unknown",
              code: item.code || item.country,
              views: item.visits || item.views || item.value || 0,
              change: item.change || 0,
            }))
          }

          // Sort by views descending and limit to top 15
          processedData = processedData
            .sort((a, b) => b.views - a.views)
            .slice(0, 15)
            .filter((item) => item.views > 0)
        }

        console.log("Processed countries data:", processedData)
        setData(processedData)
      } catch (error) {
        console.error("Error loading countries data:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to load countries data"
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

  const getCountryFlag = (countryCode: string) => {
    // Simple country code to flag emoji mapping
    const flagMap: Record<string, string> = {
      US: "🇺🇸",
      CA: "🇨🇦",
      GB: "🇬🇧",
      DE: "🇩🇪",
      FR: "🇫🇷",
      AU: "🇦🇺",
      JP: "🇯🇵",
      BR: "🇧🇷",
      IN: "🇮🇳",
      NL: "🇳🇱",
      IT: "🇮🇹",
      ES: "🇪🇸",
      RU: "🇷🇺",
      CN: "🇨🇳",
      KR: "🇰🇷",
    }
    return flagMap[countryCode] || "🌍"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-green-500/10" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-400" />
            Top Countries
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Loader2 className="h-12 w-12 text-blue-400 mx-auto" />
                </motion.div>
                <p className="text-white/70">Loading countries data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                <p className="text-red-400">{error}</p>
                <button
                  onClick={() => setTableError(null)}
                  className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {!Array.isArray(data) || data.length === 0 ? (
                <div className="text-center py-12 text-white/60">
                  <p>No country data available for this time period</p>
                </div>
              ) : (
                data.map((country, index) => (
                  <motion.div
                    key={`${country.country}-${index}`}
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
                        className="text-2xl"
                      >
                        {getCountryFlag(country.code || country.country)}
                      </motion.div>
                      <div>
                        <p className="text-white font-medium text-sm">{country.country}</p>
                        <p className="text-white/60 text-xs">{country.views.toLocaleString()} views</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {country.change !== undefined && country.change !== 0 && (
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            country.change > 0
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}
                        >
                          {country.change > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {Math.abs(country.change).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
