"use client"

import { motion } from "motion/react"
import { RefreshCw, LogOut, Loader2, ChevronDown, Mail } from 'lucide-react'
import { Button } from "../analytics/Button"
import type { MailchimpList } from "../../types/mailchimp-analytics"

interface MailchimpDashboardHeaderProps {
  isLoading: boolean
  onRefresh: () => void
  onLogout?: () => void
  selectedAudienceId: string
  onAudienceChange: (audienceId: string) => void
  availableAudiences: MailchimpList[]
}

export function MailchimpDashboardHeader({
  isLoading,
  onRefresh,
  onLogout,
  selectedAudienceId,
  onAudienceChange,
  availableAudiences,
}: MailchimpDashboardHeaderProps) {
  const selectedAudience = availableAudiences.find((a) => a.id === selectedAudienceId)
  const isAudiencesLoading = !availableAudiences.length && onAudienceChange

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 mb-8">
      {/* Sophisticated 434 Media Logo Pattern with Enhanced Contrast */}
      <div className="absolute inset-0 opacity-[0.08] sm:opacity-[0.12] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 sm:bg-[length:140px_140px]"
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "80px 80px",
            backgroundRepeat: "repeat",
            backgroundPosition: "0 0",
            animation: "float 25s ease-in-out infinite",
            filter: "brightness(1.2) contrast(1.1)",
          }}
        />
      </div>

      {/* Enhanced Floating Elements with Mailchimp Yellow (#FFE01B) */}
      <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full blur-2xl animate-pulse" style={{ backgroundColor: '#FFE01B20' }} />
      <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 rounded-full blur-3xl animate-pulse delay-1000" style={{ backgroundColor: '#FFE01B25' }} />
      <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 rounded-full blur-2xl animate-pulse delay-500" style={{ backgroundColor: '#FFE01B20' }} />
      <div className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 rounded-full blur-xl animate-pulse delay-700" style={{ backgroundColor: '#FFE01B25' }} />

      {/* Additional floating elements */}
      <div className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 rounded-full blur-lg animate-pulse delay-300" style={{ backgroundColor: '#FFE01B20' }} />
      <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 rounded-full blur-lg animate-pulse delay-900" style={{ backgroundColor: '#FFE01B25' }} />
      <div className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 rounded-full blur-lg animate-pulse delay-1200" style={{ backgroundColor: '#FFE01B20' }} />

      {/* Mobile Layout (< sm) */}
      <div className="relative z-10 flex flex-col gap-6 p-4 sm:hidden">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <motion.div
            className="p-3 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FFE01B30, #FFE01B20)' }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <MailchimpIcon className="h-6 w-6" style={{ color: '#FFE01B' }} />
          </motion.div>
          <div>
            <motion.h1
              className="text-lg font-bold text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Mailchimp Dashboard
            </motion.h1>
            <motion.p
              className="text-white/60 text-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Email marketing analytics and insights
            </motion.p>
          </div>
        </motion.div>

        {/* Controls Section - Stacked on mobile */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          {/* Audience Selector Dropdown - Full width on mobile */}
          <div className="relative w-full">
            {isAudiencesLoading ? (
              <div className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 pr-8 text-sm backdrop-blur-sm flex items-center w-full">
                <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                <span className="text-white/60">Loading audiences...</span>
              </div>
            ) : availableAudiences.length > 0 ? (
              <div className="relative w-full">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none z-10 flex-shrink-0" style={{ color: '#FFE01B' }} />
                <select
                  value={selectedAudienceId}
                  onChange={(e) => onAudienceChange(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white rounded-lg pl-10 pr-8 py-2 text-sm backdrop-blur-sm hover:bg-white/20 focus:outline-none focus:ring-2 appearance-none cursor-pointer w-full"
                  style={{ '--tw-ring-color': '#FFE01B80' } as React.CSSProperties}
                >
                  <option value="all" className="bg-slate-800 text-white">
                    All Audiences
                  </option>
                  {availableAudiences.map((audience) => (
                    <option key={audience.id} value={audience.id} className="bg-slate-800 text-white">
                      {audience.name} ({audience.stats.member_count.toLocaleString()})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none flex-shrink-0" />
              </div>
            ) : (
              <div className="bg-white/10 border border-white/20 text-white/60 rounded-lg px-4 py-2 text-sm backdrop-blur-sm flex items-center w-full">
                <Mail className="h-4 w-4 mr-2 text-white/40 flex-shrink-0" />
                <span>No audiences available</span>
              </div>
            )}
          </div>

          {/* Button Group - Full width on mobile */}
          <div className="flex gap-2 w-full">
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200 backdrop-blur-sm flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
              )}
              <span className="hidden xs:inline">Refresh</span>
              <span className="xs:hidden">Refresh</span>
            </Button>

            {onLogout && (
              <Button
                onClick={onLogout}
                variant="outline"
                size="sm"
                className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 backdrop-blur-sm flex-1"
              >
                <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden xs:inline">Logout</span>
                <span className="xs:hidden">Exit</span>
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Desktop Layout (>= sm) */}
      <div className="relative z-10 hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-4 p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <motion.div
            className="p-3 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FFE01B30, #FFE01B20)' }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <MailchimpIcon className="h-8 w-8" style={{ color: '#FFE01B' }} />
          </motion.div>
          <div>
            <motion.h1
              className="text-xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Mailchimp Dashboard
            </motion.h1>
            <motion.p
              className="text-white/60 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Email marketing analytics and insights
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          {/* Audience Selector Dropdown */}
          <div className="relative min-w-[200px]">
            {isAudiencesLoading ? (
              <div className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 pr-8 text-sm backdrop-blur-sm flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="text-white/60">Loading audiences...</span>
              </div>
            ) : availableAudiences.length > 0 ? (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 pointer-events-none z-10" style={{ color: '#FFE01B' }} />
                <select
                  value={selectedAudienceId}
                  onChange={(e) => onAudienceChange(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white rounded-lg pl-10 pr-8 py-2 text-sm backdrop-blur-sm hover:bg-white/20 focus:outline-none focus:ring-2 appearance-none cursor-pointer w-full"
                  style={{ '--tw-ring-color': '#FFE01B80' } as React.CSSProperties}
                >
                  <option value="all" className="bg-slate-800 text-white">
                    All Audiences
                  </option>
                  {availableAudiences.map((audience) => (
                    <option key={audience.id} value={audience.id} className="bg-slate-800 text-white">
                      {audience.name} ({audience.stats.member_count.toLocaleString()})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
              </div>
            ) : (
              <div className="bg-white/10 border border-white/20 text-white/60 rounded-lg px-4 py-2 text-sm backdrop-blur-sm flex items-center">
                <Mail className="h-4 w-4 mr-2 text-white/40" />
                No audiences available
              </div>
            )}
          </div>

          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200 backdrop-blur-sm"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>

          {onLogout && (
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 backdrop-blur-sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          )}
        </motion.div>
      </div>

      {/* Animated gradient line at bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ background: 'linear-gradient(90deg, #FFE01B, #FFE01B80, #FFE01B)' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </div>
  )
}

// mailchimp svg icon
export function MailchimpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M11.267 0C6.791-.015-1.82 10.246 1.397 12.964l.79.669a3.88 3.88 0 00-.22 1.792c.084.84.518 1.644 1.22 2.266.666.59 1.542.964 2.392.964 1.406 3.24 4.62 5.228 8.386 5.34 4.04.12 7.433-1.776 8.854-5.182.093-.24.488-1.316.488-2.267 0-.956-.54-1.352-.885-1.352-.01-.037-.078-.286-.172-.586-.093-.3-.19-.51-.19-.51.375-.563.382-1.065.332-1.35-.053-.353-.2-.653-.496-.964-.296-.311-.902-.63-1.753-.868l-.446-.124c-.002-.019-.024-1.053-.043-1.497-.014-.32-.042-.822-.197-1.315-.186-.668-.508-1.253-.911-1.627 1.112-1.152 1.806-2.422 1.804-3.511-.003-2.095-2.576-2.729-5.746-1.416l-.672.285A678.22 678.22 0 0012.7.504C12.304.159 11.817.002 11.267 0zm.073.873c.166 0 .322.019.465.058.297.084 1.28 1.224 1.28 1.224s-1.826 1.013-3.52 2.426c-2.28 1.757-4.005 4.311-5.037 7.082-.811.158-1.526.618-1.963 1.253-.261-.218-.748-.64-.834-.804-.698-1.326.761-3.902 1.781-5.357C5.834 3.44 9.37.867 11.34.873zm3.286 3.273c.04-.002.06.05.028.074-.143.11-.299.26-.413.414a.04.04 0 00.031.064c.659.004 1.587.235 2.192.574.041.023.012.103-.034.092-.915-.21-2.414-.369-3.97.01-1.39.34-2.45.863-3.224 1.426-.04.028-.086-.023-.055-.06.896-1.035 1.999-1.935 2.987-2.44.034-.018.07.019.052.052-.079.143-.23.447-.278.678-.007.035.032.063.062.042.615-.42 1.684-.868 2.622-.926zm3.023 3.205l.056.001a.896.896 0 01.456.146c.534.355.61 1.216.638 1.845.015.36.059 1.229.074 1.478.034.571.184.651.487.751.17.057.33.098.563.164.706.198 1.125.4 1.39.658.157.162.23.333.253.497.083.608-.472 1.36-1.942 2.041-1.607.746-3.557.935-4.904.785l-.471-.053c-1.078-.145-1.693 1.247-1.046 2.201.417.615 1.552 1.015 2.688 1.015 2.604 0 4.605-1.111 5.35-2.072a.987.987 0 00.06-.085c.036-.055.006-.085-.04-.054-.608.416-3.31 2.069-6.2 1.571 0 0-.351-.057-.672-.182-.255-.1-.788-.344-.853-.891 2.333.72 3.801.039 3.801.039a.072.072 0 00.042-.072.067.067 0 00-.074-.06s-1.911.283-3.718-.378c.197-.64.72-.408 1.51-.345a11.045 11.045 0 003.647-.394c.818-.234 1.892-.697 2.727-1.356.281.618.38 1.299.38 1.299s.219-.04.4.073c.173.106.299.326.213.895-.176 1.063-.628 1.926-1.387 2.72a5.714 5.714 0 01-1.666 1.244c-.34.18-.704.334-1.087.46-2.863.935-5.794-.093-6.739-2.3a3.545 3.545 0 01-.189-.522c-.403-1.455-.06-3.2 1.008-4.299.065-.07.132-.153.132-.256 0-.087-.055-.179-.102-.243-.374-.543-1.669-1.466-1.409-3.254.187-1.284 1.31-2.189 2.357-2.135.089.004.177.01.266.015.453.027.85.085 1.223.1.625.028 1.187-.063 1.853-.618.225-.187.405-.35.71-.401.028-.005.092-.028.215-.028zm.022 2.18a.42.42 0 00-.06.005c-.335.054-.347.468-.228 1.04.068.32.187.595.32.765.175-.02.343-.022.498 0 .089-.205.104-.557.024-.942-.112-.535-.261-.872-.554-.868zm-3.66 1.546a1.724 1.724 0 00-1.016.326c-.16.117-.311.28-.29.378.008.032.031.056.088.063.131.015.592-.217 1.122-.25.374-.023.684.094.923.2.239.104.386.173.443.113.037-.038.026-.11-.031-.204-.118-.192-.36-.387-.618-.497a1.601 1.601 0 00-.621-.129zm4.082.81c-.171-.003-.313.186-.317.42-.004.236.131.43.303.432.172.003.314-.185.318-.42.004-.236-.132-.429-.304-.432zm-3.58.172c-.05 0-.102.002-.155.008-.311.05-.483.152-.593.247-.094.082-.152.173-.152.237a.075.075 0 00.075.076c.07 0 .228-.063.228-.063a1.98 1.98 0 011.001-.104c.157.018.23.027.265-.026.01-.016.022-.049-.01-.1-.063-.103-.311-.269-.66-.275zm2.26.4c-.127 0-.235.051-.283.148-.075.154.035.363.246.466.21.104.443.063.52-.09.075-.155-.035-.364-.246-.467a.542.542 0 00-.237-.058zm-11.635.024c.048 0 .098 0 .149.003.73.04 1.806.6 2.052 2.19.217 1.41-.128 2.843-1.449 3.069-.123.02-.248.029-.374.026-1.22-.033-2.539-1.132-2.67-2.435-.145-1.44.591-2.548 1.894-2.811.117-.024.252-.04.398-.042zm-.07.927a1.144 1.144 0 00-.847.364c-.38.418-.439.988-.366 1.19.027.073.07.094.1.098.064.008.16-.039.22-.2a1.2 1.2 0 00.017-.052 1.58 1.58 0 01.157-.37.689.689 0 01.955-.199c.266.174.369.5.255.81-.058.161-.154.469-.133.721.043.511.357.717.64.738.274.01.466-.143.515-.256.029-.067.005-.107-.011-.125-.043-.053-.113-.037-.18-.021a.638.638 0 01-.16.022.347.347 0 01-.294-.148c-.078-.12-.073-.3.013-.504.011-.028.025-.058.04-.092.138-.308.368-.825.11-1.317-.195-.37-.513-.602-.894-.65a1.135 1.135 0 00-.138-.01z" />
    </svg>
  )
}