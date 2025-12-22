"use client"

import { motion } from "motion/react"
import { Button } from "./Button"
import { RefreshCw, LogOut, Loader2, ChevronDown, Globe } from "lucide-react"
import type { AnalyticsProperty } from "../../types/analytics"

interface DashboardHeaderProps {
  onRefresh: () => void
  onLogout: () => void
  isLoading?: boolean
  availableProperties?: AnalyticsProperty[]
  selectedPropertyId?: string
  onPropertyChange?: (propertyId: string) => void
}

export function DashboardHeader({
  onRefresh,
  onLogout,
  isLoading = false,
  availableProperties = [],
  selectedPropertyId = "",
  onPropertyChange,
}: DashboardHeaderProps) {
  const selectedProperty = availableProperties.find((p) => p.id === selectedPropertyId)

  // Show loading state for property selector if properties are being loaded
  const isPropertiesLoading = !availableProperties.length && onPropertyChange

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

      {/* Enhanced Floating Elements with Green/Blue/emerald */}
      <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
      <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 bg-blue-400/25 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 bg-emerald-400/20 rounded-full blur-2xl animate-pulse delay-500" />
      <div className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 bg-teal-400/25 rounded-full blur-xl animate-pulse delay-700" />

      {/* Additional floating elements */}
      <div className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 bg-cyan-400/20 rounded-full blur-lg animate-pulse delay-300" />
      <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 bg-indigo-400/25 rounded-full blur-lg animate-pulse delay-900" />
      <div className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 bg-green-400/20 rounded-full blur-lg animate-pulse delay-1200" />

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
            className="p-3 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <GA4Icon className="h-6 w-6 text-blue-400" />
          </motion.div>
          <div>
            <motion.h1
              className="text-lg font-bold text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Analytics Dashboard
            </motion.h1>
            <motion.p
              className="text-white/60 text-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Real-time insights and performance metrics
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
          {/* Property Selector Dropdown - Full width on mobile */}
          {onPropertyChange && (
            <div className="relative w-full">
              {isPropertiesLoading ? (
                <div className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 pr-8 text-sm backdrop-blur-sm flex items-center w-full">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                  <span className="text-white/60">Loading...</span>
                </div>
              ) : availableProperties.length > 0 ? (
                <div className="relative w-full">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none z-10 flex-shrink-0" />
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => onPropertyChange(e.target.value)}
                    className="bg-white/10 border border-white/20 text-white rounded-lg pl-10 pr-8 py-2 text-sm backdrop-blur-sm hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer w-full"
                  >
                    {!selectedPropertyId && (
                      <option value="" className="bg-slate-800 text-white/60">
                        Select Property
                      </option>
                    )}
                    {availableProperties.map((property) => (
                      <option key={property.id} value={property.id} className="bg-slate-800 text-white">
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none flex-shrink-0" />
                </div>
              ) : (
                <div className="bg-white/10 border border-white/20 text-white/60 rounded-lg px-4 py-2 text-sm backdrop-blur-sm flex items-center w-full">
                  <Globe className="h-4 w-4 mr-2 text-white/40 flex-shrink-0" />
                  <span>No properties</span>
                </div>
              )}
            </div>
          )}

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
          </div>
        </motion.div>
      </div>

      {/* Desktop Layout (>= sm) - Original Layout Preserved */}
      <div className="relative z-10 hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-4 p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <motion.div
            className="p-3 bg-gradient-to-br from-blue-500/30 to-emerald-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <GA4Icon className="h-8 w-8 text-blue-400" />
          </motion.div>
          <div>
            <motion.h1
              className="text-xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Analytics Dashboard
            </motion.h1>
            <motion.p
              className="text-white/60 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Real-time insights and performance metrics
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          {/* Property Selector Dropdown - Always render container */}
          {onPropertyChange && (
            <div className="relative min-w-[180px]">
              {isPropertiesLoading ? (
                // Loading state for property selector
                <div className="bg-white/10 border border-white/20 text-white rounded-lg px-4 py-2 pr-8 text-sm backdrop-blur-sm flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span className="text-white/60">Loading...</span>
                </div>
              ) : availableProperties.length > 0 ? (
                // Property selector with options
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none z-10" />
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => onPropertyChange(e.target.value)}
                    className="bg-white/10 border border-white/20 text-white rounded-lg pl-10 pr-8 py-2 text-sm backdrop-blur-sm hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer w-full"
                  >
                    {!selectedPropertyId && (
                      <option value="" className="bg-slate-800 text-white/60">
                        Select Property
                      </option>
                    )}
                    {availableProperties.map((property) => (
                      <option key={property.id} value={property.id} className="bg-slate-800 text-white">
                        {property.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
                </div>
              ) : (
                // No properties available state
                <div className="bg-white/10 border border-white/20 text-white/60 rounded-lg px-4 py-2 text-sm backdrop-blur-sm flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-white/40" />
                  No properties
                </div>
              )}
            </div>
          )}

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

          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 backdrop-blur-sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </motion.div>
      </div>

      {/* Animated gradient line at bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-teal-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </div>
  )
}

// ga4 svg icon
function GA4Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.84 2.998v17.999a2.983 2.983 0 01-2.967 2.998 2.98 2.98 0 01-.368-.02 3.06 3.06 0 01-2.61-3.1V3.12A3.06 3.06 0 0119.51.02a2.983 2.983 0 013.329 2.978zM4.133 18.055a2.973 2.973 0 100 5.945 2.973 2.973 0 000-5.945zm7.872-9.01h-.05a3.06 3.06 0 00-2.892 3.126v7.985c0 2.167.954 3.482 2.35 3.763a2.978 2.978 0 003.57-2.927v-8.959a2.983 2.983 0 00-2.978-2.988z" />
    </svg>
  )
}