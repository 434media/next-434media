"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Globe, MapPin, Users, ChevronDown } from "lucide-react"
import type { InstagramDemographics } from "../../types/instagram-insights"

interface InstagramDemographicsProps {
  demographics: InstagramDemographics | null
  isLoading?: boolean
}

// Country code to flag emoji
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍"
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

// Format gender display
function formatGender(gender: string): string {
  switch (gender?.toUpperCase()) {
    case "M":
      return "Male"
    case "F":
      return "Female"
    case "U":
      return "Unknown"
    default:
      return gender || "Unknown"
  }
}

export function InstagramDemographics({ demographics, isLoading }: InstagramDemographicsProps) {
  const [activeTab, setActiveTab] = useState<"countries" | "cities" | "age_gender">("countries")
  const [showAll, setShowAll] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-pink-100 animate-pulse" />
          <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!demographics) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
        <Globe className="w-12 h-12 text-pink-300 mx-auto mb-3" />
        <p className="text-neutral-500 text-sm">Demographics data not available</p>
        <p className="text-neutral-400 text-xs mt-1">Requires 100+ followers</p>
      </div>
    )
  }

  const { countries, cities, age_gender } = demographics.engaged_audience

  const tabs = [
    { id: "countries" as const, label: "Countries", icon: Globe, count: countries.length },
    { id: "cities" as const, label: "Cities", icon: MapPin, count: cities.length },
    { id: "age_gender" as const, label: "Age & Gender", icon: Users, count: age_gender.length },
  ]

  const currentData =
    activeTab === "countries"
      ? countries
      : activeTab === "cities"
        ? cities
        : age_gender

  const displayData = showAll ? currentData : currentData.slice(0, 5)
  const maxValue = Math.max(...currentData.map((d: any) => d.value), 1)
  const totalValue = currentData.reduce((sum: number, d: any) => sum + d.value, 0)

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Header with Tabs */}
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setShowAll(false)
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-pink-100 text-pink-600 border border-pink-200"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className="text-xs opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="space-y-2">
          {displayData.map((item: any, index: number) => {
            const percentage = ((item.value / totalValue) * 100).toFixed(1)
            const barWidth = (item.value / maxValue) * 100

            return (
              <motion.div
                key={`${activeTab}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
              >
                <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors relative overflow-hidden">
                  {/* Progress bar background */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-pink-100"
                    style={{ width: `${barWidth}%` }}
                  />

                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-neutral-400 text-sm font-mono w-6">{index + 1}</span>
                    {activeTab === "countries" && (
                      <span className="text-lg">{getCountryFlag(item.dimension)}</span>
                    )}
                    {activeTab === "cities" && (
                      <MapPin className="w-4 h-4 text-pink-600" />
                    )}
                    {activeTab === "age_gender" && (
                      <span className="text-sm">
                        {item.gender === "M" ? "👨" : item.gender === "F" ? "👩" : "🧑"}
                      </span>
                    )}
                    <div>
                      <span className="text-neutral-900 font-medium text-sm">
                        {activeTab === "age_gender"
                          ? `${item.age} • ${formatGender(item.gender)}`
                          : item.dimension}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-neutral-500 text-xs">{percentage}%</span>
                    <span className="text-pink-600 font-bold text-sm tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Show More/Less */}
        {currentData.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full mt-3 py-2 text-sm text-pink-600 hover:text-pink-500 flex items-center justify-center gap-1 transition-colors"
          >
            {showAll ? "Show Less" : `Show All (${currentData.length})`}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-neutral-200 text-center">
          <p className="text-neutral-500 text-xs">
            Based on engaged audience over the last 90 days • Total: {totalValue.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
