"use client"

import { Button } from "../analytics/Button"
import { 
  RefreshCw, 
  LogOut, 
  Loader2, 
  Calendar,
  FileText,
  Image,
  Instagram,
  ChevronDown
} from "lucide-react"
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
    <div className="bg-white border-b border-neutral-200 pt-20 overflow-x-hidden">
      {/* Top Row: Title, Account Info, Actions */}
      <div className="px-3 sm:px-4 lg:px-6 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 py-3 sm:py-4">
          {/* Left: Title and Account */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-lg sm:rounded-xl border border-neutral-200 shrink-0">
                <Instagram className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                  Instagram Insights
                </h1>
              </div>
            </div>

            {/* Connection Status Badge */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                isConnected 
                  ? "bg-pink-100 text-pink-700 border border-pink-200" 
                  : "bg-red-100 text-red-700 border border-red-200"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-pink-500" : "bg-red-500"}`} />
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
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
                className="appearance-none bg-neutral-100 border border-neutral-200 text-neutral-900 text-xs sm:text-sm rounded-lg px-3 py-2 pr-8 hover:bg-neutral-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
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

            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200 transition-colors"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>

            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Date Range and Download */}
      <div className="border-t border-neutral-100 bg-neutral-50 overflow-x-hidden">
        <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {/* Date Range Options - Wrap on mobile */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-pink-600 hidden sm:block shrink-0" />
              {dateRangeOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => onRangeChange(option.value)}
                  className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-lg transition-all whitespace-nowrap ${
                    selectedRange === option.value
                      ? "bg-pink-100 text-pink-700 border border-pink-200"
                      : "bg-neutral-100 text-neutral-600 border border-transparent hover:bg-neutral-200 hover:text-neutral-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Download Options */}
            {(onDownloadCSV || onDownloadPNG) && (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-neutral-400 text-xs hidden sm:block">Export:</span>
                {onDownloadCSV && (
                  <button
                    onClick={onDownloadCSV}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-600 hover:text-pink-600 bg-neutral-100 hover:bg-pink-50 rounded-lg border border-neutral-200 hover:border-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download CSV"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>CSV</span>
                  </button>
                )}
                {onDownloadPNG && (
                  <button
                    onClick={onDownloadPNG}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-600 hover:text-pink-600 bg-neutral-100 hover:bg-pink-50 rounded-lg border border-neutral-200 hover:border-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download PNG"
                  >
                    <Image className="h-3.5 w-3.5" />
                    <span>PNG</span>
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
