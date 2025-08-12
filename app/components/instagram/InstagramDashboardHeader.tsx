"use client"

import type React from "react"

import { motion } from "motion/react"
import { RefreshCw, LogOut, Loader2, ChevronDown } from "lucide-react"
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../components/analytics/Button"

interface InstagramDashboardHeaderProps {
  connectionStatus: {
    success: boolean
    message?: string
    account?: {
      id: string
      username: string
      name: string
      followers_count: number
      follows_count: number
      media_count: number
    }
  } | null
  accountData: {
    username: string
    name: string
    profile_picture_url: string
  } | null
  onRefresh?: () => void
  onLogout?: () => void
  isLoading?: boolean
}

export function InstagramDashboardHeader({
  connectionStatus,
  accountData,
  onRefresh = () => {},
  onLogout = () => {},
  isLoading = false,
}: InstagramDashboardHeaderProps) {
  // Simple account dropdown (future-ready). Default to TXMX Boxing
  const derivedAccountLabel = accountData ? `@${accountData.username}` : "TXMX Boxing"
  const [selectedAccount, setSelectedAccount] = useState<string>(derivedAccountLabel)

  const accounts = [
    { name: derivedAccountLabel, disabled: false },
    { name: "Digital Canvas", disabled: true },
    { name: "Vemos Vamos", disabled: true },
    { name: "MilCityUSA", disabled: true },
    { name: "The AMPD Project", disabled: true },
  ]

  const isConnected = !!connectionStatus?.success

  // Reusable account selector (custom popover replacing native <select>)
  function AccountSelector({ compact = false }: { compact?: boolean }) {
    const [open, setOpen] = useState(false)
    const btnRef = useRef<HTMLButtonElement | null>(null)
    const listRef = useRef<HTMLUListElement | null>(null)
    const [highlightIndex, setHighlightIndex] = useState<number>(
      () => accounts.findIndex((a) => a.name === selectedAccount) || 0,
    )
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

    const close = useCallback(() => setOpen(false), [])

    // Close on outside click
    useEffect(() => {
      if (!open) return
      function handle(e: MouseEvent) {
        if (!btnRef.current && !listRef.current) return
        if (btnRef.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return
        close()
      }
      window.addEventListener("mousedown", handle)
      return () => window.removeEventListener("mousedown", handle)
    }, [open, close])

    // Compute absolute viewport position (for portal) so we can escape overflow-hidden clipping
    const computePosition = useCallback(() => {
      if (!btnRef.current) return
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.top + (window.scrollY || window.pageYOffset) + rect.height + 4,
        left: rect.left + (window.scrollX || window.pageXOffset),
        width: rect.width,
      })
    }, [])

    useLayoutEffect(() => {
      if (open) computePosition()
    }, [open, computePosition])

    useEffect(() => {
      if (!open) return
      function onResize() { computePosition() }
      function onScroll() { computePosition() }
      window.addEventListener("resize", onResize)
      window.addEventListener("scroll", onScroll, true)
      return () => {
        window.removeEventListener("resize", onResize)
        window.removeEventListener("scroll", onScroll, true)
      }
    }, [open, computePosition])

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (!open) {
          setOpen(true)
        } else {
          const selectedAccountData = accounts[highlightIndex]
          if (!selectedAccountData.disabled) {
            setSelectedAccount(selectedAccountData.name)
            close()
          }
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setOpen(true)
        setHighlightIndex((i) => (i + 1) % accounts.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setOpen(true)
        setHighlightIndex((i) => (i - 1 + accounts.length) % accounts.length)
      } else if (e.key === "Escape") {
        if (open) {
          e.preventDefault()
          close()
        }
      } else if (e.key === "Tab") {
        close()
      }
    }

    // Ensure highlight follows selected when list opens
    useEffect(() => {
      if (open) {
        const idx = accounts.findIndex((a) => a.name === selectedAccount)
        if (idx >= 0) setHighlightIndex(idx)
      }
    }, [open, selectedAccount])

    const baseClasses = compact ? "pl-8 pr-8 py-2 text-sm" : "pl-10 pr-9 py-2 text-sm"

    return (
      <div className={`relative ${compact ? "w-full" : "min-w-[180px]"}`}>
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={`group w-full rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-pink-500/50 backdrop-blur-sm text-left text-white relative transition-colors ${baseClasses}`}
        >
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"} pointer-events-none`}
          />
          <span className="block truncate pr-2">{selectedAccount}</span>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 group-hover:text-white/80 transition-colors" />
        </button>
        {open && menuPos && typeof document !== "undefined" &&
          createPortal(
            <ul
              ref={listRef}
              role="listbox"
              aria-activedescendant={`insta-acc-${highlightIndex}`}
              tabIndex={-1}
              style={{ position: "absolute", top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 1000, animation: "fadeIn 0.15s ease-out" }}
              className="max-h-60 overflow-auto rounded-lg border border-white/20 bg-slate-900/95 backdrop-blur-md shadow-xl ring-1 ring-black/20 focus:outline-none"
            >
              {accounts.map((acc, i) => {
                const active = i === highlightIndex
                const selected = acc.name === selectedAccount
                const disabled = acc.disabled
                return (
                  <li
                    id={`insta-acc-${i}`}
                    key={acc.name}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={disabled}
                    onMouseEnter={() => setHighlightIndex(i)}
                    onMouseDown={(e) => {
                      if (disabled) return
                      e.preventDefault()
                      setSelectedAccount(acc.name)
                      close()
                    }}
                    className={`px-3 py-2.5 text-sm flex items-center gap-3 transition-colors duration-150 ${
                      disabled
                        ? "cursor-not-allowed text-white/30"
                        : `cursor-pointer ${active ? "bg-pink-500/20" : ""} ${selected ? "text-pink-300 font-medium" : "text-white/90"} hover:bg-pink-500/30`
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        disabled
                          ? "bg-gray-500"
                          : selected
                            ? (isConnected ? "bg-green-400" : "bg-red-400")
                            : "bg-gray-400"
                      }`}
                    />
                    <span className="truncate flex-1">{acc.name}</span>
                    {selected && !disabled && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-pink-300/70 flex-shrink-0">
                        Selected
                      </span>
                    )}
                    {disabled && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-white/20 flex-shrink-0">
                        Coming Soon
                      </span>
                    )}
                  </li>
                )
              })}
              {accounts.length === 0 && <li className="px-3 py-2 text-xs text-white/50">No accounts</li>}
            </ul>,
            document.body
          )}
      </div>
    )
  }

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

      {/* Enhanced Floating Elements with Instagram Colors */}
      <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 bg-pink-400/20 rounded-full blur-2xl animate-pulse" />
      <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 bg-purple-400/25 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 bg-orange-400/20 rounded-full blur-2xl animate-pulse delay-500" />
      <div className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 bg-yellow-400/25 rounded-full blur-xl animate-pulse delay-700" />

      {/* Additional floating elements */}
      <div className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 bg-red-400/20 rounded-full blur-lg animate-pulse delay-300" />
      <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 bg-indigo-400/25 rounded-full blur-lg animate-pulse delay-900" />
      <div className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 bg-pink-400/20 rounded-full blur-lg animate-pulse delay-1200" />

      {/* Mobile Layout (< sm) */}
      <div className="relative z-10 flex flex-col gap-6 p-4 sm:hidden">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="p-3 bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <InstagramIcon className="w-8 h-8 text-pink-400" />
            </motion.div>
          </div>
          <div>
            <motion.h1
              className="text-lg font-bold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Meta Insights
            </motion.h1>
            <motion.p
              className="text-white/60 text-[11px] mt-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Social media insights and engagement metrics
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
          {/* Account Selector (mobile) */}
          <AccountSelector compact />
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
          <div className="flex items-center gap-4">
            <motion.div
              className="p-3 bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <InstagramIcon className="w-8 h-8 text-pink-400" />
            </motion.div>
          </div>
          <div>
            <motion.h1
              className="text-xl font-bold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Meta Insights
            </motion.h1>
            <motion.p
              className="text-white/60 text-xs mt-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Social media insights and engagement metrics
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          {/* Account Selector + Inline Status */}
          <div className="flex items-center gap-3">
            <AccountSelector />
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
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </div>
  )
}

// instagram svg icon
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 00-2.124 1.388 5.878 5.878 0 00-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 002.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 002.123-1.388 5.881 5.881 0 001.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 00-1.387-2.123 5.857 5.857 0 00-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 01-1.382-.895 3.695 3.695 0 01-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 011.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 01-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 101.437-1.442 1.44 1.44 0 00-1.437 1.442M5.839 12.012a6.161 6.161 0 1012.323-.024 6.162 6.162 0 00-12.323.024M8 12.008A4 4 0 1112.008 16 4 4 0 018 12.008" />
    </svg>
  )
}
