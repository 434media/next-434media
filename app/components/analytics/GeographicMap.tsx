"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { MapPin, Loader2, Globe, Users } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface GeographicMapProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export function GeographicMap({ dateRange, isLoading: parentLoading = false, setError }: GeographicMapProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const adminKey = sessionStorage.getItem("adminKey")
        const response = await fetch(
          `/api/analytics?endpoint=geographic&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          {
            headers: {
              "x-admin-key": adminKey || "",
            },
          },
        )

        if (!response.ok) {
          throw new Error("Failed to fetch geographic data")
        }

        const result = await response.json()
        setData(result.data)
      } catch (error) {
        console.error("Error loading geographic data:", error)
        setError("Failed to load geographic data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange, setError])

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)
  const uniqueCities = data.filter((item) => item.city && item.city !== "(not set)").length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="h-full"
    >
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 rounded-lg" />

        <CardHeader className="relative pb-6">
          <div className="flex items-center gap-4">
            <motion.div
              className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl shadow-lg"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Globe className="h-6 w-6 text-orange-400" />
            </motion.div>
            <div>
              <CardTitle className="text-white text-xl font-bold mb-1">Geographic Distribution</CardTitle>
              <p className="text-white/60 text-sm font-medium">
                {totalSessions.toLocaleString()} sessions across regions
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
                <Loader2 className="h-8 w-8 text-orange-400" />
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-80 overflow-y-auto pr-1">
              {/* Top Countries Section */}
              <div className="space-y-4">
                <motion.div
                  className="sticky top-0 z-20 rounded-lg p-3 border border-white/30 shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(249, 115, 22, 0.95) 0%, rgba(239, 68, 68, 0.95) 100%)",
                    backdropFilter: "blur(40px) saturate(200%)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                  }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-orange-500/40 to-red-500/40 rounded-lg backdrop-blur-sm">
                      <MapPin className="h-4 w-4 text-orange-200" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-base drop-shadow-sm">Top Countries</h4>
                      <p className="text-white/80 text-xs drop-shadow-sm">Most active regions</p>
                    </div>
                  </div>
                </motion.div>

                <div className="space-y-3">
                  {data.slice(0, 5).map((location, index) => (
                    <motion.div
                      key={`${location.country}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                      className="group p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-lg">{getCountryFlag(location.country)}</div>
                          <span className="text-white font-medium text-sm">{location.country}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-white/60" />
                          <span className="text-white font-bold text-sm">{location.sessions.toLocaleString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Top Cities Section */}
              <div className="space-y-4">
                <motion.div
                  className="sticky top-0 z-20 rounded-lg p-3 border border-white/30 shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(249, 115, 22, 0.95) 100%)",
                    backdropFilter: "blur(40px) saturate(200%)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                  }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-red-500/40 to-orange-500/40 rounded-lg backdrop-blur-sm">
                      <MapPin className="h-4 w-4 text-red-200" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-base drop-shadow-sm">Top Cities</h4>
                      <p className="text-white/80 text-xs drop-shadow-sm">{uniqueCities} cities tracked</p>
                    </div>
                  </div>
                </motion.div>

                <div className="space-y-3">
                  {data
                    .filter((item) => item.city && item.city !== "(not set)")
                    .slice(0, 5)
                    .map((location, index) => (
                      <motion.div
                        key={`${location.city}-${index}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.05 }}
                        className="group p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white font-medium text-sm block">{location.city}</span>
                            <span className="text-white/60 text-xs">{location.country}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-white/60" />
                            <span className="text-white font-bold text-sm">{location.sessions.toLocaleString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Helper function to get country flags (basic implementation)
function getCountryFlag(country: string): string {
  const flagMap: { [key: string]: string } = {
    "United States": "🇺🇸",
    Canada: "🇨🇦",
    "United Kingdom": "🇬🇧",
    Germany: "🇩🇪",
    France: "🇫🇷",
    Japan: "🇯🇵",
    Australia: "🇦🇺",
    Brazil: "🇧🇷",
    India: "🇮🇳",
    China: "🇨🇳",
    Mexico: "🇲🇽",
    Spain: "🇪🇸",
    Italy: "🇮🇹",
    Netherlands: "🇳🇱",
    Sweden: "🇸🇪",
    Norway: "🇳🇴",
    Denmark: "🇩🇰",
    Finland: "🇫🇮",
    "South Korea": "🇰🇷",
    Singapore: "🇸🇬",
  }

  return flagMap[country] || "🌍"
}
