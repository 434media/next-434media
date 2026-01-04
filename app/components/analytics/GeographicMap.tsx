"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { MapPin, Loader2, Globe, Users } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface GeographicMapProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
}

export function GeographicMap({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
}: GeographicMapProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        let url = `/api/analytics?endpoint=geographic&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }))
          console.error("Geographic API error:", response.status, errorData)
          throw new Error(errorData.error || "Failed to fetch geographic data")
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
  }, [dateRange, setError, propertyId])

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)
  const uniqueCities = data.filter((item) => item.city && item.city !== "(not set)").length

  return (
    <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
      <Card className="border border-neutral-200 bg-white shadow-lg h-full overflow-hidden w-full max-w-full">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 via-transparent to-red-50/50 rounded-lg" />

        <CardHeader className="relative pb-4 sm:pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg sm:rounded-xl shadow-sm shrink-0 transition-transform hover:scale-105">
              <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-neutral-900 text-base sm:text-lg font-bold mb-0.5 leading-tight">Geographic Distribution</CardTitle>
              <p className="text-neutral-600 text-xs sm:text-sm font-medium truncate">
                {totalSessions.toLocaleString()} sessions
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative pt-0">
          {isLoading || parentLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-h-[380px] overflow-y-auto pr-1">
              {/* Top Countries Section */}
              <div className="space-y-3">
                <div className="rounded-lg p-3 border border-orange-200 shadow-sm bg-gradient-to-r from-orange-100 to-red-100">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-orange-200/50 rounded-lg">
                      <MapPin className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="text-neutral-900 font-bold text-sm">Top Countries</h4>
                      <p className="text-neutral-600 text-xs font-medium">Most active regions</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {data.slice(0, 5).map((location, index) => (
                    <div
                      key={`${location.country}-${index}`}
                      className="group p-3 rounded-xl bg-gradient-to-r from-orange-50 to-red-50/50 border border-neutral-200 hover:border-orange-300 transition-all duration-300 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="text-lg">{getCountryFlag(location.country)}</div>
                          <span className="text-neutral-900 font-semibold text-sm">{location.country}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-neutral-400" />
                          <span className="text-neutral-900 font-bold text-sm">{location.sessions.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Cities Section */}
              <div className="space-y-3">
                <div className="rounded-lg p-3 border border-red-200 shadow-sm bg-gradient-to-r from-red-100 to-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-red-200/50 rounded-lg">
                      <MapPin className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <h4 className="text-neutral-900 font-bold text-sm">Top Cities</h4>
                      <p className="text-neutral-600 text-xs font-medium">{uniqueCities} cities tracked</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {data
                    .filter((item) => item.city && item.city !== "(not set)")
                    .slice(0, 5)
                    .map((location, index) => (
                      <div
                        key={`${location.city}-${index}`}
                        className="group p-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50/50 border border-neutral-200 hover:border-red-300 transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-neutral-900 font-semibold text-sm block leading-tight">{location.city}</span>
                            <span className="text-neutral-500 text-xs font-medium">{location.country}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-neutral-400" />
                            <span className="text-neutral-900 font-bold text-sm">{location.sessions.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Helper function to get country flags
function getCountryFlag(country: string): string {
  const flagMap: { [key: string]: string } = {
    "United States": "🇺🇸",
    "United Kingdom": "🇬🇧",
    Canada: "🇨🇦",
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
    Switzerland: "🇨🇭",
    Austria: "🇦🇹",
    Belgium: "🇧🇪",
    Portugal: "🇵🇹",
    Ireland: "🇮🇪",
    "New Zealand": "🇳🇿",
    "South Korea": "🇰🇷",
    Singapore: "🇸🇬",
    "Hong Kong": "🇭🇰",
    Taiwan: "🇹🇼",
    Thailand: "🇹🇭",
    Malaysia: "🇲🇾",
    Philippines: "🇵🇭",
    Indonesia: "🇮🇩",
    Vietnam: "🇻🇳",
    "South Africa": "🇿🇦",
    Egypt: "🇪🇬",
    Nigeria: "🇳🇬",
    Kenya: "🇰🇪",
    Morocco: "🇲🇦",
    Israel: "🇮🇱",
    "United Arab Emirates": "🇦🇪",
    "Saudi Arabia": "🇸🇦",
    Turkey: "🇹🇷",
    Russia: "🇷🇺",
    Ukraine: "🇺🇦",
    Poland: "🇵🇱",
    "Czech Republic": "🇨🇿",
    Hungary: "🇭🇺",
    Romania: "🇷🇴",
    Bulgaria: "🇧🇬",
    Croatia: "🇭🇷",
    Serbia: "🇷🇸",
    Slovenia: "🇸🇮",
    Slovakia: "🇸🇰",
    Lithuania: "🇱🇹",
    Latvia: "🇱🇻",
    Estonia: "🇪🇪",
    Greece: "🇬🇷",
    Cyprus: "🇨🇾",
    Malta: "🇲🇹",
    Iceland: "🇮🇸",
    Luxembourg: "🇱🇺",
    Chile: "🇨🇱",
    Argentina: "🇦🇷",
    Colombia: "🇨🇴",
    Peru: "🇵🇪",
    Venezuela: "🇻🇪",
    Ecuador: "🇪🇨",
    Uruguay: "🇺🇾",
    Paraguay: "🇵🇾",
    Bolivia: "🇧🇴",
    "Costa Rica": "🇨🇷",
    Panama: "🇵🇦",
    Guatemala: "🇬🇹",
    Honduras: "🇭🇳",
    "El Salvador": "🇸🇻",
    Nicaragua: "🇳🇮",
    "Dominican Republic": "🇩🇴",
    Jamaica: "🇯🇲",
    "Puerto Rico": "🇵🇷",
    Cuba: "🇨🇺",
    Haiti: "🇭🇹",
    "Trinidad and Tobago": "🇹🇹",
    Barbados: "🇧🇧",
    Bahamas: "🇧🇸",
  }

  return flagMap[country] || "🌍"
}
