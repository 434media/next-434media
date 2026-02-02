"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Plus,
  Filter,
  X,
  Check
} from "lucide-react"
import type { ContentPost, SocialPlatform, ContentPostStatus, TeamMember } from "./types"
import { SOCIAL_PLATFORM_OPTIONS, CONTENT_POST_STATUS_OPTIONS, BRANDS, TEAM_MEMBERS } from "./types"

interface SocialCalendarViewProps {
  contentPosts: ContentPost[]
  onOpenPost: (post: ContentPost) => void
  onAddPost: () => void
}

type CalendarViewMode = "day" | "week" | "month"

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Date[] = []
  const startDayOfWeek = firstDay.getDay()
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(new Date(year, month, -startDayOfWeek + i + 1))
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day))
  }
  const remainingDays = 7 - (days.length % 7)
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }
  }
  return days
}

function getDaysInWeek(date: Date): Date[] {
  const days: Date[] = []
  const dayOfWeek = date.getDay()
  const startOfWeek = new Date(date)
  startOfWeek.setDate(date.getDate() - dayOfWeek)
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    days.push(day)
  }
  return days
}

function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getStatusStyle(status: ContentPostStatus): { bg: string; border: string; text: string } {
  switch (status) {
    case "to_do":
    case "planning":
    case "in_progress":
      return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600" }
    case "needs_approval":
      return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" }
    case "approved":
      return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" }
    case "scheduled":
      return { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" }
    case "posted":
      return { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" }
    default:
      return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600" }
  }
}

const PlatformIcon = ({ platform, className = "w-4 h-4", style }: { platform: SocialPlatform; className?: string; style?: React.CSSProperties }) => {
  switch (platform) {
    case "instagram":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      )
    case "youtube":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      )
    case "tiktok":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      )
    case "linkedin":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      )
    case "facebook":
      return (
        <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    default:
      return null
  }
}

function PlatformBadge({ platform, size = "sm" }: { platform: SocialPlatform; size?: "sm" | "md" | "lg" }) {
  const platformConfig = SOCIAL_PLATFORM_OPTIONS.find(p => p.value === platform)
  if (!platformConfig) return null
  const sizeClasses = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" }
  return <PlatformIcon platform={platform} className={`${sizeClasses[size]} flex-shrink-0`} style={{ color: platformConfig.color }} />
}

function PostCard({ post, onClick, compact = false }: { post: ContentPost; onClick: () => void; compact?: boolean }) {
  const statusStyle = getStatusStyle(post.status)
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`group cursor-pointer rounded transition-all border ${statusStyle.bg} ${statusStyle.border} hover:shadow-sm hover:border-neutral-300 ${compact ? "px-1.5 py-1" : "px-2 py-1.5"}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {post.social_platforms?.slice(0, compact ? 2 : 3).map(platform => (
            <PlatformBadge key={platform} platform={platform} size="sm" />
          ))}
          {post.social_platforms && post.social_platforms.length > (compact ? 2 : 3) && (
            <span className="text-[9px] font-medium text-neutral-400">+{post.social_platforms.length - (compact ? 2 : 3)}</span>
          )}
        </div>
        <span className={`truncate leading-tight font-medium ${statusStyle.text} ${compact ? "text-[11px]" : "text-xs"}`}>{post.title}</span>
      </div>
    </motion.div>
  )
}

function FilterSection({ title, options, selectedValues, onToggle, renderOption }: { 
  title: string
  options: { value: string; label: string; color?: string }[]
  selectedValues: Set<string>
  onToggle: (value: string) => void
  renderOption?: (option: { value: string; label: string; color?: string }, isSelected: boolean) => React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selectedValues.has(option.value)
          if (renderOption) {
            return <button key={option.value} onClick={() => onToggle(option.value)} className="transition-all">{renderOption(option, isSelected)}</button>
          }
          return (
            <button
              key={option.value}
              onClick={() => onToggle(option.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${isSelected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SocialCalendarView({ contentPosts, onOpenPost, onAddPost }: SocialCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/team-members")
      const data = await response.json()
      const firestoreMembers: TeamMember[] = data.success && data.data ? data.data.filter((m: TeamMember) => m.isActive) : []
      const defaultMembers = TEAM_MEMBERS.map((m, i) => ({ id: `default-${i}`, name: m.name, email: m.email, isActive: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }))
      const firestoreNames = new Set(firestoreMembers.map(m => m.name.toLowerCase()))
      const missingDefaults = defaultMembers.filter(d => !firestoreNames.has(d.name.toLowerCase()))
      const allMembers = [...firestoreMembers, ...missingDefaults]
      allMembers.sort((a, b) => a.name.localeCompare(b.name))
      setTeamMembers(allMembers)
    } catch {
      setTeamMembers(TEAM_MEMBERS.map((m, i) => ({ id: `default-${i}`, name: m.name, email: m.email, isActive: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })))
    }
  }, [])
  
  useEffect(() => { fetchTeamMembers() }, [fetchTeamMembers])
  
  const toggleUser = (user: string) => { setSelectedUsers(prev => { const next = new Set(prev); next.has(user) ? next.delete(user) : next.add(user); return next }) }
  const togglePlatform = (platform: string) => { setSelectedPlatforms(prev => { const next = new Set(prev); next.has(platform) ? next.delete(platform) : next.add(platform); return next }) }
  const toggleStatus = (status: string) => { setSelectedStatuses(prev => { const next = new Set(prev); next.has(status) ? next.delete(status) : next.add(status); return next }) }
  const clearAllFilters = () => { setSelectedUsers(new Set()); setSelectedPlatforms(new Set()); setSelectedStatuses(new Set()) }
  const hasActiveFilters = selectedUsers.size > 0 || selectedPlatforms.size > 0 || selectedStatuses.size > 0
  
  const filteredPosts = useMemo(() => {
    return contentPosts.filter(post => {
      if (selectedUsers.size > 0 && !selectedUsers.has(post.user)) return false
      if (selectedPlatforms.size > 0 && post.platform && !selectedPlatforms.has(post.platform)) return false
      if (selectedStatuses.size > 0 && !selectedStatuses.has(post.status)) return false
      return true
    })
  }, [contentPosts, selectedUsers, selectedPlatforms, selectedStatuses])
  
  const postsByDate = useMemo(() => {
    const grouped: Record<string, ContentPost[]> = {}
    filteredPosts.forEach(post => {
      if (post.date_to_post) {
        const dateKey = post.date_to_post.split("T")[0]
        if (!grouped[dateKey]) grouped[dateKey] = []
        grouped[dateKey].push(post)
      }
    })
    return grouped
  }, [filteredPosts])
  
  const calendarDays = useMemo(() => {
    if (viewMode === "day") return [currentDate]
    if (viewMode === "week") return getDaysInWeek(currentDate)
    return getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())
  }, [currentDate, viewMode])
  
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") newDate.setDate(currentDate.getDate() - 1)
    else if (viewMode === "week") newDate.setDate(currentDate.getDate() - 7)
    else newDate.setMonth(currentDate.getMonth() - 1)
    setCurrentDate(newDate)
  }
  
  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") newDate.setDate(currentDate.getDate() + 1)
    else if (viewMode === "week") newDate.setDate(currentDate.getDate() + 7)
    else newDate.setMonth(currentDate.getMonth() + 1)
    setCurrentDate(newDate)
  }
  
  const goToToday = () => setCurrentDate(new Date())
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth()
  const isToday = (date: Date) => toDateString(date) === toDateString(new Date())
  
  const getHeaderText = () => {
    if (viewMode === "day") return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    if (viewMode === "week") {
      const weekDays = getDaysInWeek(currentDate)
      const start = weekDays[0], end = weekDays[6]
      if (start.getMonth() === end.getMonth()) return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    }
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  
  const platformStats = useMemo(() => {
    const stats: Record<SocialPlatform, number> = { instagram: 0, youtube: 0, tiktok: 0, linkedin: 0, facebook: 0 }
    filteredPosts.forEach(post => { post.social_platforms?.forEach(platform => { stats[platform]++ }) })
    return stats
  }, [filteredPosts])
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const statusOptions = CONTENT_POST_STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label, color: s.color }))
  const brandOptions = BRANDS.map(b => ({ value: b, label: b }))
  
  // Filter out specific users from the calendar filter list
  const EXCLUDED_USERS = ["barbara carreon", "elon john", "guna", "nichole snow", "testing"]
  const userOptions = teamMembers
    .filter(m => !EXCLUDED_USERS.some(excluded => m.name.toLowerCase() === excluded.toLowerCase()))
    .map(m => ({ value: m.name, label: m.name }))
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Content Calendar</h2>
          <span className="text-sm text-neutral-500">{filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}</span>
        </div>
        <button onClick={onAddPost} className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" />Add Post
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white rounded-lg border border-neutral-200">
                <button onClick={goToPrevious} className="p-2 hover:bg-neutral-100 rounded-l-lg transition-colors border-r border-neutral-200"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={goToToday} className="px-3 py-2 text-sm font-medium hover:bg-neutral-100 transition-colors">Today</button>
                <button onClick={goToNext} className="p-2 hover:bg-neutral-100 rounded-r-lg transition-colors border-l border-neutral-200"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <h2 className="text-base font-semibold text-neutral-900">{getHeaderText()}</h2>
            </div>
            <div className="flex items-center bg-white rounded-lg border border-neutral-200 p-0.5">
              <button onClick={() => setViewMode("day")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === "day" ? "bg-neutral-900 text-white" : "hover:bg-neutral-100 text-neutral-600"}`}><CalendarDays className="w-4 h-4" />Day</button>
              <button onClick={() => setViewMode("week")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === "week" ? "bg-neutral-900 text-white" : "hover:bg-neutral-100 text-neutral-600"}`}><CalendarRange className="w-4 h-4" />Week</button>
              <button onClick={() => setViewMode("month")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === "month" ? "bg-neutral-900 text-white" : "hover:bg-neutral-100 text-neutral-600"}`}><LayoutGrid className="w-4 h-4" />Month</button>
            </div>
          </div>
          
          {viewMode === "day" && (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 bg-neutral-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900">{currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
                  <span className="text-sm text-neutral-500">{postsByDate[toDateString(currentDate)]?.length || 0} posts scheduled</span>
                </div>
              </div>
              <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
                {(postsByDate[toDateString(currentDate)] || []).length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                    <p className="text-neutral-500">No posts scheduled for this day</p>
                    <button onClick={onAddPost} className="mt-3 text-sm text-neutral-600 hover:text-neutral-900 font-medium">+ Add a post</button>
                  </div>
                ) : (
                  (postsByDate[toDateString(currentDate)] || []).map(post => {
                    const statusStyle = getStatusStyle(post.status)
                    const statusOption = CONTENT_POST_STATUS_OPTIONS.find(s => s.value === post.status)
                    return (
                      <div key={post.id} onClick={() => onOpenPost(post)} className={`p-4 hover:bg-neutral-50 cursor-pointer transition-colors border-l-4 ${statusStyle.border.replace("border-", "border-l-")}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-1 flex-shrink-0">{post.social_platforms?.map(platform => <PlatformBadge key={platform} platform={platform} size="lg" />)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-neutral-900">{post.title}</p>
                            {post.social_copy && <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{post.social_copy}</p>}
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>{statusOption?.label || post.status}</span>
                              {post.user && <span className="text-xs text-neutral-500">{post.user}</span>}
                              {post.platform && <span className="text-xs text-neutral-400">{post.platform}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
          
          {viewMode === "week" && (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200">
                {calendarDays.map((date, i) => (
                  <div key={i} className={`px-2 py-3 text-center border-r last:border-r-0 border-neutral-200 ${isToday(date) ? "bg-blue-50" : ""}`}>
                    <p className="text-xs font-medium text-neutral-500 leading-tight">{weekDays[i]}</p>
                    <p className={`text-lg font-semibold mt-0.5 leading-tight ${isToday(date) ? "text-blue-600" : "text-neutral-900"}`}>{date.getDate()}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {calendarDays.map((date, i) => {
                  const dateKey = toDateString(date)
                  const dayPosts = postsByDate[dateKey] || []
                  return (
                    <div key={i} className={`p-2 border-r last:border-r-0 border-neutral-100 ${isToday(date) ? "bg-blue-50/50" : ""}`}>
                      <div className="space-y-1 max-h-[380px] overflow-y-auto scrollbar-thin">
                        <AnimatePresence mode="popLayout">{dayPosts.map(post => <PostCard key={post.id} post={post} onClick={() => onOpenPost(post)} compact />)}</AnimatePresence>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {viewMode === "month" && (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200">
                {weekDays.map(day => <div key={day} className="px-2 py-2.5 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((date, index) => {
                  const dateKey = toDateString(date)
                  const dayPosts = postsByDate[dateKey] || []
                  const isCurrentMonthDay = isCurrentMonth(date)
                  const isTodayDate = isToday(date)
                  return (
                    <div 
                      key={index} 
                      className={`min-h-[100px] max-h-[140px] border-b border-r border-neutral-100 p-1.5 transition-colors flex flex-col ${!isCurrentMonthDay ? "bg-neutral-50/50" : "bg-white"} ${isTodayDate ? "bg-blue-50/60" : ""} ${hoveredDay === dateKey ? "bg-neutral-50" : ""}`} 
                      onMouseEnter={() => setHoveredDay(dateKey)} 
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                        <span className={`text-xs font-semibold leading-none ${!isCurrentMonthDay ? "text-neutral-300" : isTodayDate ? "text-white" : "text-neutral-700"} ${isTodayDate ? "bg-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-[11px]" : ""}`}>{date.getDate()}</span>
                        {dayPosts.length > 0 && !isTodayDate && <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{dayPosts.length}</span>}
                      </div>
                      <div className="space-y-1 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-track-transparent hover:scrollbar-thumb-neutral-300">
                        <AnimatePresence mode="popLayout">{dayPosts.map(post => <PostCard key={post.id} post={post} onClick={() => onOpenPost(post)} compact />)}</AnimatePresence>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden sticky top-4">
            <div className="p-3 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-neutral-500" /><h3 className="font-semibold text-neutral-900 text-sm">Filters</h3></div>
                {hasActiveFilters && <button onClick={clearAllFilters} className="text-xs text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1"><X className="w-3 h-3" />Clear</button>}
              </div>
            </div>
            <div className="p-3 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
              <FilterSection title="User" options={userOptions} selectedValues={selectedUsers} onToggle={toggleUser} />
              <FilterSection title="Platform" options={brandOptions} selectedValues={selectedPlatforms} onToggle={togglePlatform} />
              <FilterSection title="Status" options={statusOptions} selectedValues={selectedStatuses} onToggle={toggleStatus} renderOption={(option, isSelected) => {
                const statusConfig = CONTENT_POST_STATUS_OPTIONS.find(s => s.value === option.value)
                return (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all inline-flex items-center gap-1 ${isSelected ? `${statusConfig?.bgColor || "bg-neutral-100"} ${statusConfig?.borderColor || "border-neutral-200"} border-2` : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`} style={isSelected ? { color: option.color } : undefined}>
                    {isSelected && <Check className="w-3 h-3" />}{option.label}
                  </span>
                )
              }} />
            </div>
            <div className="p-3 border-t border-neutral-200 bg-neutral-50">
              <p className="text-xs text-neutral-500 mb-2">Status Legend</p>
              <div className="space-y-1">
                {CONTENT_POST_STATUS_OPTIONS.map(status => <div key={status.value} className="flex items-center gap-2 text-xs"><div className={`w-3 h-3 rounded ${status.bgColor} ${status.borderColor} border`} /><span className="text-neutral-600">{status.label}</span></div>)}
              </div>
            </div>
            <div className="p-3 border-t border-neutral-200 bg-neutral-50">
              <p className="text-xs text-neutral-500 mb-2">Platform breakdown</p>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORM_OPTIONS.map(platform => { const count = platformStats[platform.value]; if (count === 0) return null; return <div key={platform.value} className="flex items-center gap-1 text-xs"><PlatformBadge platform={platform.value} size="sm" /><span className="text-neutral-600">{count}</span></div> })}
                {Object.values(platformStats).every(v => v === 0) && <span className="text-xs text-neutral-400">No posts yet</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
