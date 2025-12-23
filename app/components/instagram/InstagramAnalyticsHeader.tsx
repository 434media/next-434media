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
  { id: "txmx", label: "TXMX Boxing", value: "txmxboxing" },
  { id: "vemos", label: "Vemos Vamos", value: "vemosvamos" },
  { id: "digitalcanvas", label: "Digital Canvas", value: "digitalcanvas" },
  { id: "ampd", label: "AMPD Project", value: "ampdproject" },
  { id: "milcity", label: "MilCityUSA", value: "milcityusa" },
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
    <div className="bg-black border-b border-white/10 pt-20 overflow-x-hidden">
      {/* Top Row: Title, Account Info, Actions */}
      <div className="px-3 sm:px-4 lg:px-6 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 py-3 sm:py-4">
          {/* Left: Title and Account */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-lg sm:rounded-xl border border-white/10 shrink-0">
                <Instagram className="h-5 w-5 sm:h-6 sm:w-6 text-pink-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  Instagram Insights
                </h1>
              </div>
            </div>

            {/* Connection Status Badge */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                isConnected 
                  ? "bg-pink-500/15 text-pink-400 border border-pink-500/20" 
                  : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-pink-400" : "bg-red-400"}`} />
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
                onChange={(e) => onAccountChange?.(e.target.value)}
                disabled={isLoading}
                className="appearance-none bg-white/5 border border-white/10 text-white text-xs sm:text-sm rounded-lg px-3 py-2 pr-8 hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {instagramAccounts.map((account) => (
                  <option key={account.id} value={account.id} className="bg-neutral-900 text-white">
                    {account.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            </div>

            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>

            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Date Range and Download */}
      <div className="border-t border-white/5 bg-neutral-950/80 backdrop-blur-md overflow-x-hidden">
        <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            {/* Date Range Options - Wrap on mobile */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-pink-400 hidden sm:block shrink-0" />
              {dateRangeOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => onRangeChange(option.value)}
                  className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-lg transition-all whitespace-nowrap ${
                    selectedRange === option.value
                      ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                      : "bg-white/5 text-white/70 border border-transparent hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Download Options */}
            {(onDownloadCSV || onDownloadPNG) && (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-white/40 text-xs hidden sm:block">Export:</span>
                {onDownloadCSV && (
                  <button
                    onClick={onDownloadCSV}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-pink-400 bg-white/5 hover:bg-pink-500/10 rounded-lg border border-white/10 hover:border-pink-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-pink-400 bg-white/5 hover:bg-pink-500/10 rounded-lg border border-white/10 hover:border-pink-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
