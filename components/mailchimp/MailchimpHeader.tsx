"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "../analytics/Button"
import { 
  RefreshCw, 
  LogOut, 
  Loader2, 
  Calendar,
  CalendarDays,
  FileText,
  Image
} from "lucide-react"

interface MailchimpHeaderProps {
  // Dashboard controls
  onRefresh: () => void
  onLogout?: () => void
  isLoading?: boolean
  // Date range
  dateRange: { startDate: string; endDate: string }
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void
  // Audience info
  audienceName?: string
  audienceId?: string
  memberCount?: number
  // Download options
  onDownloadCSV?: () => void
  onDownloadPNG?: () => void
}

interface DateRangeOption {
  startDate: string
  endDate: string
  label: string
}

const dateRangeOptions: DateRangeOption[] = [
  { startDate: "today", endDate: "today", label: "Today" },
  { startDate: "7daysAgo", endDate: "today", label: "Last 7 days" },
  { startDate: "30daysAgo", endDate: "today", label: "Last 30 days" },
  { startDate: "90daysAgo", endDate: "today", label: "Last 90 days" },
]

export function MailchimpHeader({
  onRefresh,
  onLogout,
  isLoading = false,
  dateRange,
  onDateRangeChange,
  audienceName = "434 Media",
  audienceId,
  memberCount = 0,
  onDownloadCSV,
  onDownloadPNG,
}: MailchimpHeaderProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  const formatDateForInput = (dateString: string) => {
    if (dateString === "today") return new Date().toISOString().split("T")[0]
    if (dateString.includes("daysAgo")) {
      const days = Number.parseInt(dateString.replace("daysAgo", ""))
      const date = new Date()
      date.setDate(date.getDate() - days)
      return date.toISOString().split("T")[0]
    }
    return dateString
  }

  const handlePresetRange = (option: DateRangeOption) => {
    const startDate = formatDateForInput(option.startDate)
    const endDate = formatDateForInput(option.endDate)
    onDateRangeChange({ startDate, endDate })
  }

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      onDateRangeChange({ startDate: customStartDate, endDate: customEndDate })
      setShowCustom(false)
    }
  }

  const isRangeActive = (option: DateRangeOption) => {
    const optionStart = formatDateForInput(option.startDate)
    const optionEnd = formatDateForInput(option.endDate)
    return dateRange.startDate === optionStart && dateRange.endDate === optionEnd
  }

  return (
    <div className="bg-white border-b border-neutral-200 overflow-x-hidden w-full pt-20">
      {/* Top Row: Title, Audience Info, Actions */}
      <div className="px-3 sm:px-4 lg:px-6 overflow-x-hidden w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 py-3 sm:py-4">
          {/* Left: Title and Audience Info */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg sm:rounded-xl border border-yellow-200 shrink-0">
                <MailchimpIcon className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                  {audienceName}
                </h1>
                <p className="text-neutral-500 text-[10px] sm:text-xs truncate">
                  {memberCount > 0 ? `${memberCount.toLocaleString()} subscribers` : "Mailchimp Analytics"}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
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

            {onLogout && (
              <Button
                onClick={onLogout}
                variant="outline"
                size="sm"
                className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Date Range and Download */}
      <div className="border-t border-neutral-100 bg-neutral-50 overflow-x-hidden w-full">
        <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 overflow-x-hidden w-full">
          <div className="flex flex-col gap-2 sm:gap-3">
            {/* Date Range Options */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-600 hidden sm:block shrink-0" />
              {dateRangeOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handlePresetRange(option)}
                  className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-lg transition-all whitespace-nowrap ${
                    isRangeActive(option)
                      ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                      : "bg-neutral-100 text-neutral-600 border border-transparent hover:bg-neutral-200 hover:text-neutral-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(!showCustom)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  showCustom
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                    : "bg-neutral-100 text-neutral-600 border border-transparent hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Custom
              </button>
            </div>

            {/* Download Options */}
            {(onDownloadCSV || onDownloadPNG) && (
              <div className="flex items-center gap-3">
                <span className="text-neutral-400 text-xs hidden sm:block">Export:</span>
                {onDownloadCSV && (
                  <button
                    onClick={onDownloadCSV}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-600 hover:text-yellow-700 bg-neutral-100 hover:bg-yellow-50 rounded-lg border border-neutral-200 hover:border-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-600 hover:text-yellow-700 bg-neutral-100 hover:bg-yellow-50 rounded-lg border border-neutral-200 hover:border-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Custom Date Range Picker - Expandable */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-neutral-100"
          >
            <div className="px-4 lg:px-6 py-4 bg-neutral-50">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 max-w-xl">
                <div className="flex-1 space-y-1.5 w-full sm:w-auto">
                  <label className="text-neutral-500 text-xs font-medium">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate || dateRange.startDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1.5 w-full sm:w-auto">
                  <label className="text-neutral-500 text-xs font-medium">End Date</label>
                  <input
                    type="date"
                    value={customEndDate || dateRange.endDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCustomDateApply}
                    disabled={!customStartDate || !customEndDate}
                    size="sm"
                    className="bg-yellow-500 hover:bg-yellow-600 text-black border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </Button>
                  <Button
                    onClick={() => setShowCustom(false)}
                    variant="outline"
                    size="sm"
                    className="bg-neutral-100 border-neutral-200 text-neutral-600 hover:bg-neutral-200"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mailchimp SVG icon
function MailchimpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M11.267 0C6.791-.015-1.82 10.246 1.397 12.964l.79.669a3.88 3.88 0 00-.22 1.792c.084.84.518 1.644 1.22 2.266.666.59 1.542.964 2.392.964 1.406 3.24 4.62 5.228 8.386 5.34 4.04.12 7.433-1.776 8.854-5.182.093-.24.488-1.316.488-2.267 0-.956-.54-1.352-.885-1.352-.01-.037-.078-.286-.172-.586-.093-.3-.19-.51-.19-.51.375-.563.382-1.065.332-1.35-.053-.353-.2-.653-.496-.964-.296-.311-.902-.63-1.753-.868l-.446-.124c-.002-.019-.024-1.053-.043-1.497-.014-.32-.042-.822-.197-1.315-.186-.668-.508-1.253-.911-1.627 1.112-1.152 1.806-2.422 1.804-3.511-.003-2.095-2.576-2.729-5.746-1.416l-.672.285A678.22 678.22 0 0012.7.504C12.304.159 11.817.002 11.267 0zm.073.873c.166 0 .322.019.465.058.297.084 1.28 1.224 1.28 1.224s-1.826 1.013-3.52 2.426c-2.28 1.757-4.005 4.311-5.037 7.082-.811.158-1.526.618-1.963 1.253-.261-.218-.748-.64-.834-.804-.698-1.326.761-3.902 1.781-5.357C5.834 3.44 9.37.867 11.34.873z" />
    </svg>
  )
}
