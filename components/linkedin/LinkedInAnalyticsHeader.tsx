"use client"

import { ChevronDown } from "lucide-react"
import type { LinkedInTimeRange } from "../../types/linkedin-insights"

// LinkedIn pages available for selection
const linkedinPages = [
  { id: "devsa", label: "DEVSA", value: "devsa", available: true },
  { id: "434media", label: "434 MEDIA", value: "434media", available: false },
  { id: "vemosvamos", label: "Vemos Vamos", value: "vemosvamos", available: false },
]

interface LinkedInAnalyticsHeaderProps {
  onRefresh: () => void
  onLogout: () => void
  isLoading: boolean
  organizationData: {
    name: string
    vanityName: string
    followersCount: number
  } | null
  connectionStatus: {
    success: boolean
    message?: string
    organization?: any
  } | null
  selectedRange: LinkedInTimeRange
  onRangeChange: (range: LinkedInTimeRange) => void
  onDownloadCSV?: () => void
  onDownloadPNG?: () => void
  selectedPage?: string
  onPageChange?: (pageId: string) => void
}

const timeRanges: { value: LinkedInTimeRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "12 months" },
]

export function LinkedInAnalyticsHeader({
  onRefresh,
  onLogout,
  isLoading,
  organizationData,
  connectionStatus,
  selectedRange,
  onRangeChange,
  onDownloadCSV,
  onDownloadPNG,
  selectedPage = "devsa",
  onPageChange,
}: LinkedInAnalyticsHeaderProps) {
  const currentPage = linkedinPages.find(p => p.id === selectedPage) || linkedinPages[0]

  return (
    <div className="bg-white border-b border-neutral-200">
      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Top Row: Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {/* LinkedIn Logo */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#0077B5] flex items-center justify-center shadow-lg shadow-[#0077B5]/20">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="white">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-neutral-900">
                LinkedIn Analytics
              </h1>
              {organizationData && (
                <p className="text-xs sm:text-sm text-neutral-500">
                  {organizationData.name}{" "}
                  <span className="text-[#0077B5]">
                    • {organizationData.followersCount.toLocaleString()} followers
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Page Dropdown */}
            <div className="relative">
              <select
                value={selectedPage}
                onChange={(e) => {
                  const page = linkedinPages.find(p => p.id === e.target.value)
                  if (page?.available) {
                    onPageChange?.(e.target.value)
                  }
                }}
                disabled={isLoading}
                className="appearance-none bg-neutral-100 border border-neutral-200 text-neutral-900 text-xs sm:text-sm rounded-lg px-3 py-2 pr-8 hover:bg-neutral-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0077B5]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linkedinPages.map((page) => (
                  <option 
                    key={page.id} 
                    value={page.id} 
                    className="bg-white text-neutral-900"
                    disabled={!page.available}
                  >
                    {page.label}{!page.available ? " (Coming Soon)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            </div>

            {/* Download Buttons */}
            {onDownloadCSV && (
              <button
                onClick={onDownloadCSV}
                disabled={isLoading}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                CSV
              </button>
            )}

            {onDownloadPNG && (
              <button
                onClick={onDownloadPNG}
                disabled={isLoading}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                PNG
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Connection Status */}
        {connectionStatus && (
          <div
            className={`flex items-center gap-2 text-xs mb-4 ${
              connectionStatus.success ? "text-emerald-600" : "text-red-600"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus.success ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            {connectionStatus.success ? "Connected to LinkedIn API" : connectionStatus.message}
          </div>
        )}

        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400 mr-1">Period:</span>
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => onRangeChange(range.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedRange === range.value
                  ? "bg-[#0077B5] text-white shadow-lg shadow-[#0077B5]/20"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
