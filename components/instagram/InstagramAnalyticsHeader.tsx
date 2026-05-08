"use client"

import {
  RefreshCw,
  LogOut,
  Loader2,
  Calendar,
  FileText,
  Image,
  ChevronDown
} from "lucide-react"
import { InstagramIcon } from "@/components/icons/InstagramIcon"
import type { InstagramTimeRange, InstagramAccount } from "../../types/instagram-insights"

// Instagram accounts available for selection
const instagramAccounts = [
  { id: "txmx", label: "TXMX Boxing", value: "txmxboxing", available: true },
  { id: "vemos", label: "Vemos Vamos", value: "vemosvamos", available: true },
  { id: "digitalcanvas", label: "Digital Canvas", value: "digitalcanvas", available: false },
  { id: "ampd", label: "AMPD Project", value: "ampdproject", available: true },
  { id: "milcity", label: "MilCityUSA", value: "milcityusa", available: true },
]

interface InstagramAnalyticsHeaderProps {
  // Dashboard controls
  onRefresh: () => void
  onLogout: () => void
  isLoading?: boolean
  accountData?: InstagramAccount | null
  connectionStatus?: {
    success: boolean
    message?: string
    account?: any
  } | null
  // Date range
  selectedRange: InstagramTimeRange
  onRangeChange: (range: InstagramTimeRange) => void
  // Download options
  onDownloadCSV?: () => void
  onDownloadPNG?: () => void
  // Account selection
  selectedAccount?: string
  onAccountChange?: (accountId: string) => void
}

const dateRangeOptions: Array<{ value: InstagramTimeRange; label: string }> = [
  { value: "1d", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
]

export function InstagramAnalyticsHeader({
  onRefresh,
  onLogout,
  isLoading = false,
  accountData,
  connectionStatus,
  selectedRange,
  onRangeChange,
  onDownloadCSV,
  onDownloadPNG,
  selectedAccount = "txmx",
  onAccountChange,
}: InstagramAnalyticsHeaderProps) {
  const isConnected = connectionStatus?.success
  const currentAccount = instagramAccounts.find(a => a.id === selectedAccount) || instagramAccounts[0]

  return (
    <div className="bg-white border-b border-neutral-200 overflow-x-hidden">
      {/* Top Row: Title, Account Info, Actions */}
      <div className="px-3 sm:px-4 lg:px-6 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 py-3 sm:py-4">
          {/* Left: Title and Account */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mono icon tile — pink reserved for the brand-color SVG fill on the icon */}
              <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 shrink-0">
                <InstagramIcon className="h-5 w-5 text-pink-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-medium text-neutral-900 truncate">
                  Instagram Insights
                </h1>
              </div>
            </div>

            {/* Connection Status — mono pill with state-colored dot */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}
                  aria-hidden="true"
                />
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions — uniform h-9 controls */}
          <div className="flex items-center gap-2">
            {/* Account Dropdown */}
            <div className="relative">
              <select
                value={selectedAccount}
                onChange={(e) => {
                  const account = instagramAccounts.find(a => a.id === e.target.value)
                  if (account?.available) {
                    onAccountChange?.(e.target.value)
                  }
                }}
                disabled={isLoading}
                aria-label="Select Instagram account"
                className="appearance-none bg-white ring-1 ring-neutral-200 text-neutral-900 text-xs sm:text-sm rounded-md h-9 px-3 pr-8 hover:bg-neutral-50 transition-colors cursor-pointer focus:outline-none focus:ring-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {instagramAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                    className="bg-white text-neutral-900"
                    disabled={!account.available}
                  >
                    {account.label}{!account.available ? " (Coming Soon)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            </div>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-sm bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-sm text-red-600 hover:bg-red-50 ring-1 ring-neutral-200 hover:ring-red-200 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Date Range and Download — flat strip, no tinted band */}
      <div className="border-t border-neutral-100 overflow-x-hidden">
        <div className="px-3 sm:px-4 lg:px-6 py-2.5 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {/* Date Range — segmented mono control, active = bg-neutral-900 */}
            <div className="inline-flex items-center h-9 rounded-md ring-1 ring-neutral-200 bg-white overflow-hidden divide-x divide-neutral-200">
              <div className="grid place-items-center w-9 h-9 text-neutral-500" aria-hidden="true">
                <Calendar className="h-4 w-4" />
              </div>
              {dateRangeOptions.map((option) => {
                const active = selectedRange === option.value
                return (
                  <button
                    key={option.label}
                    onClick={() => onRangeChange(option.value)}
                    aria-pressed={active}
                    className={`h-9 px-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {/* Export */}
            {(onDownloadCSV || onDownloadPNG) && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 hidden sm:block">Export</span>
                {onDownloadCSV && (
                  <button
                    onClick={onDownloadCSV}
                    disabled={isLoading}
                    aria-label="Download CSV"
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-700 bg-white ring-1 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    CSV
                  </button>
                )}
                {onDownloadPNG && (
                  <button
                    onClick={onDownloadPNG}
                    disabled={isLoading}
                    aria-label="Download PNG"
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-700 bg-white ring-1 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Image className="h-3.5 w-3.5" />
                    PNG
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
