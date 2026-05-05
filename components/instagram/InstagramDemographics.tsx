"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Globe, MapPin, Users, ChevronDown } from "lucide-react"
import type { InstagramDemographics } from "../../types/instagram-insights"

interface InstagramDemographicsProps {
  demographics: InstagramDemographics | null
  isLoading?: boolean
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍"
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

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
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-md bg-neutral-100 animate-pulse" />
          <div className="h-5 w-40 bg-neutral-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!demographics) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6 text-center">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
          <Globe className="w-5 h-5" />
        </div>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxValue = Math.max(...currentData.map((d: any) => d.value), 1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalValue = currentData.reduce((sum: number, d: any) => sum + d.value, 0)

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
      {/* Header with Tabs — segmented control */}
      <div className="border-b border-neutral-100 px-4 py-3">
        <div className="inline-flex h-9 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setShowAll(false)
                }}
                className={`inline-flex items-center gap-2 px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`text-[10px] tabular-nums ${isActive ? "text-white/70" : "text-neutral-400"}`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="space-y-1.5">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {displayData.map((item: any, index: number) => {
            const percentage = ((item.value / totalValue) * 100).toFixed(1)
            const barWidth = (item.value / maxValue) * 100

            return (
              <motion.div
                key={`${activeTab}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="relative"
              >
                <div className="flex items-center justify-between p-3 rounded-md ring-1 ring-neutral-200/70 hover:ring-neutral-300 transition-colors relative overflow-hidden">
                  {/* Neutral progress bar background */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-neutral-100"
                    style={{ width: `${barWidth}%` }}
                  />

                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-neutral-400 text-xs font-mono tabular-nums w-5">{index + 1}</span>
                    {activeTab === "countries" && (
                      <span className="text-base">{getCountryFlag(item.dimension)}</span>
                    )}
                    {activeTab === "cities" && (
                      <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    {activeTab === "age_gender" && (
                      <span className="text-sm">
                        {item.gender === "M" ? "👨" : item.gender === "F" ? "👩" : "🧑"}
                      </span>
                    )}
                    <span className="text-neutral-900 font-medium text-sm">
                      {activeTab === "age_gender"
                        ? `${item.age} · ${formatGender(item.gender)}`
                        : item.dimension}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-neutral-500 text-xs tabular-nums">{percentage}%</span>
                    <span className="text-neutral-900 font-semibold text-sm tabular-nums">
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
            className="w-full mt-3 py-2 text-xs text-neutral-700 hover:text-neutral-900 flex items-center justify-center gap-1 transition-colors"
          >
            {showAll ? "Show less" : `Show all (${currentData.length})`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-neutral-100 text-center">
          <p className="text-neutral-500 text-xs tabular-nums">
            Engaged audience · last 90 days · Total: {totalValue.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
