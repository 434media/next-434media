"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Clock,
  CalendarDays,
  CalendarRange,
  LayoutGrid
} from "lucide-react"
import type { Task, SocialPlatform } from "./types"
import { SOCIAL_PLATFORM_OPTIONS, formatDate } from "./types"

interface SocialCalendarViewProps {
  tasks: Task[]
  onOpenTask: (task: Task) => void
}

type CalendarViewMode = "day" | "week" | "month"

// Helper function to get days in a month
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

// Helper to get days in a week
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

// Helper to format date as YYYY-MM-DD for comparison
function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Platform SVG icons
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

// Platform badge component with SVG icons (no circle background)
function PlatformBadge({ platform, size = "sm" }: { platform: SocialPlatform; size?: "sm" | "md" | "lg" }) {
  const platformConfig = SOCIAL_PLATFORM_OPTIONS.find(p => p.value === platform)
  if (!platformConfig) return null
  
  const sizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  }
  
  return (
    <PlatformIcon 
      platform={platform} 
      className={`${sizeClasses[size]} flex-shrink-0`}
      style={{ color: platformConfig.color }}
    />
  )
}

// Compact task card for calendar cells
function TaskCard({ task, onClick, compact = false }: { task: Task; onClick: () => void; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`group cursor-pointer rounded transition-colors ${
        compact 
          ? "px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200" 
          : "px-2 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {task.social_platforms?.slice(0, compact ? 2 : 3).map(platform => (
            <PlatformBadge key={platform} platform={platform} size="sm" />
          ))}
          {task.social_platforms && task.social_platforms.length > (compact ? 2 : 3) && (
            <span className="text-[8px] text-neutral-400">
              +{task.social_platforms.length - (compact ? 2 : 3)}
            </span>
          )}
        </div>
        <span className={`truncate text-neutral-700 ${compact ? "text-[10px]" : "text-xs"}`}>
          {task.title}
        </span>
      </div>
    </motion.div>
  )
}

export function SocialCalendarView({
  tasks,
  onOpenTask,
}: SocialCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  
  // Filter tasks that are social posts
  const socialTasks = useMemo(() => {
    return tasks.filter(task => 
      task.is_social_post && 
      task.social_post_date
    )
  }, [tasks])
  
  // Group social tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    socialTasks.forEach(task => {
      if (task.social_post_date) {
        const dateKey = task.social_post_date.split("T")[0]
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push(task)
      }
    })
    return grouped
  }, [socialTasks])
  
  // Get calendar days based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate]
    } else if (viewMode === "week") {
      return getDaysInWeek(currentDate)
    } else {
      return getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())
    }
  }, [currentDate, viewMode])
  
  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(currentDate.getDate() - 1)
    } else if (viewMode === "week") {
      newDate.setDate(currentDate.getDate() - 7)
    } else {
      newDate.setMonth(currentDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }
  
  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(currentDate.getDate() + 1)
    } else if (viewMode === "week") {
      newDate.setDate(currentDate.getDate() + 7)
    } else {
      newDate.setMonth(currentDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }
  
  const goToToday = () => {
    setCurrentDate(new Date())
  }
  
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }
  
  const isToday = (date: Date) => {
    const today = new Date()
    return toDateString(date) === toDateString(today)
  }
  
  // Get header text based on view mode
  const getHeaderText = () => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    } else if (viewMode === "week") {
      const weekDays = getDaysInWeek(currentDate)
      const start = weekDays[0]
      const end = weekDays[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
      }
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    }
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  
  // Upcoming posts
  const upcomingPosts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return socialTasks
      .filter(task => {
        if (!task.social_post_date) return false
        const postDate = new Date(task.social_post_date)
        postDate.setHours(0, 0, 0, 0)
        return postDate >= today
      })
      .sort((a, b) => 
        new Date(a.social_post_date || "").getTime() - new Date(b.social_post_date || "").getTime()
      )
      .slice(0, 10)
  }, [socialTasks])
  
  // Platform stats
  const platformStats = useMemo(() => {
    const stats: Record<SocialPlatform, number> = {
      instagram: 0,
      youtube: 0,
      tiktok: 0,
      linkedin: 0,
      facebook: 0,
    }
    
    socialTasks.forEach(task => {
      task.social_platforms?.forEach(platform => {
        stats[platform]++
      })
    })
    
    return stats
  }, [socialTasks])
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  
  return (
    <div className="space-y-4">
      {/* Main content - side by side layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar section - takes up 3 columns */}
        <div className="lg:col-span-3 space-y-3">
          {/* Combined header: Navigation + Date on left, View mode selector on right */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Navigation */}
              <div className="flex items-center bg-white rounded-lg border border-neutral-200">
                <button
                  onClick={goToPrevious}
                  className="p-2 hover:bg-neutral-100 rounded-l-lg transition-colors border-r border-neutral-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-2 text-sm font-medium hover:bg-neutral-100 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={goToNext}
                  className="p-2 hover:bg-neutral-100 rounded-r-lg transition-colors border-l border-neutral-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <h2 className="text-base font-semibold text-neutral-900">
                {getHeaderText()}
              </h2>
            </div>
            
            {/* View mode selector */}
            <div className="flex items-center bg-white rounded-lg border border-neutral-200 p-0.5">
              <button
                onClick={() => setViewMode("day")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "day" 
                    ? "bg-neutral-900 text-white" 
                    : "hover:bg-neutral-100 text-neutral-600"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Day
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "week" 
                    ? "bg-neutral-900 text-white" 
                    : "hover:bg-neutral-100 text-neutral-600"
                }`}
              >
                <CalendarRange className="w-4 h-4" />
                Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === "month" 
                    ? "bg-neutral-900 text-white" 
                    : "hover:bg-neutral-100 text-neutral-600"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Month
              </button>
            </div>
          </div>
          
          {/* Day View */}
          {viewMode === "day" && (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="p-4 border-b border-neutral-200 bg-neutral-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900">
                    {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <span className="text-sm text-neutral-500">
                    {tasksByDate[toDateString(currentDate)]?.length || 0} posts scheduled
                  </span>
                </div>
              </div>
              <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
                {(tasksByDate[toDateString(currentDate)] || []).length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                    <p className="text-neutral-500">No posts scheduled for this day</p>
                  </div>
                ) : (
                  (tasksByDate[toDateString(currentDate)] || []).map(task => (
                    <div
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className="p-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {task.social_platforms?.map(platform => (
                            <PlatformBadge key={platform} platform={platform} size="lg" />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              task.status === "completed" 
                                ? "bg-green-100 text-green-700"
                                : task.status === "in_progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-neutral-100 text-neutral-600"
                            }`}>
                              {task.status.replace("_", " ")}
                            </span>
                            {task.assigned_to && (
                              <span className="text-xs text-neutral-500">
                                {task.assigned_to}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Week View */}
          {viewMode === "week" && (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200">
                {calendarDays.map((date, i) => (
                  <div 
                    key={i} 
                    className={`px-2 py-3 text-center border-r last:border-r-0 border-neutral-200 ${
                      isToday(date) ? "bg-pink-50" : ""
                    }`}
                  >
                    <p className="text-xs text-neutral-500">{weekDays[i]}</p>
                    <p className={`text-lg font-semibold mt-0.5 ${
                      isToday(date) ? "text-pink-600" : "text-neutral-900"
                    }`}>
                      {date.getDate()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {calendarDays.map((date, i) => {
                  const dateKey = toDateString(date)
                  const dayTasks = tasksByDate[dateKey] || []
                  
                  return (
                    <div 
                      key={i}
                      className={`p-2 border-r last:border-r-0 border-neutral-100 ${
                        isToday(date) ? "bg-pink-50/50" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        <AnimatePresence mode="popLayout">
                          {dayTasks.map(task => (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              onClick={() => onOpenTask(task)}
                              compact
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Month View */}
          {viewMode === "month" && (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200">
                {weekDays.map(day => (
                  <div key={day} className="px-2 py-2 text-center text-xs font-medium text-neutral-500">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((date, index) => {
                  const dateKey = toDateString(date)
                  const dayTasks = tasksByDate[dateKey] || []
                  const isCurrentMonthDay = isCurrentMonth(date)
                  const isTodayDate = isToday(date)
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[80px] border-b border-r border-neutral-100 p-1.5 transition-colors ${
                        !isCurrentMonthDay ? "bg-neutral-50/50" : "bg-white"
                      } ${isTodayDate ? "bg-pink-50" : ""} ${
                        hoveredDay === dateKey ? "bg-neutral-50" : ""
                      }`}
                      onMouseEnter={() => setHoveredDay(dateKey)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-medium leading-none ${
                            !isCurrentMonthDay
                              ? "text-neutral-300"
                              : isTodayDate
                              ? "text-white"
                              : "text-neutral-600"
                          } ${isTodayDate ? "bg-pink-600 w-5 h-5 rounded-full flex items-center justify-center" : ""}`}
                        >
                          {date.getDate()}
                        </span>
                        {dayTasks.length > 0 && !isTodayDate && (
                          <span className="text-[10px] text-neutral-400">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-0.5 overflow-hidden max-h-[52px]">
                        <AnimatePresence mode="popLayout">
                          {dayTasks.slice(0, 2).map(task => (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              onClick={() => onOpenTask(task)}
                              compact
                            />
                          ))}
                        </AnimatePresence>
                        {dayTasks.length > 2 && (
                          <button
                            onClick={() => {
                              setCurrentDate(date)
                              setViewMode("day")
                            }}
                            className="text-[10px] text-neutral-400 hover:text-neutral-600 px-1"
                          >
                            +{dayTasks.length - 2} more
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar - Upcoming posts */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden sticky top-4">
            <div className="p-3 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <h3 className="font-semibold text-neutral-900 text-sm">Upcoming Posts</h3>
              </div>
            </div>
            
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {upcomingPosts.length === 0 ? (
                <div className="p-4 text-center">
                  <Calendar className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500">No upcoming posts</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Link tasks to the social calendar</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {upcomingPosts.map(task => {
                    const postDate = new Date(task.social_post_date || "")
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    postDate.setHours(0, 0, 0, 0)
                    const isTaskToday = postDate.getTime() === today.getTime()
                    const isTomorrow = postDate.getTime() === today.getTime() + 86400000
                    
                    let dateLabel = formatDate(task.social_post_date || "")
                    if (isTaskToday) dateLabel = "Today"
                    else if (isTomorrow) dateLabel = "Tomorrow"
                    
                    return (
                      <div
                        key={task.id}
                        onClick={() => onOpenTask(task)}
                        className="p-3 hover:bg-neutral-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {task.social_platforms?.slice(0, 3).map(platform => (
                            <PlatformBadge key={platform} platform={platform} size="sm" />
                          ))}
                          {task.social_platforms && task.social_platforms.length > 3 && (
                            <span className="text-[10px] text-neutral-400">
                              +{task.social_platforms.length - 3}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-neutral-900 truncate mb-1">
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${
                            isTaskToday ? "text-pink-600 font-medium" : "text-neutral-500"
                          }`}>
                            {dateLabel}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            task.status === "completed" 
                              ? "bg-green-100 text-green-700"
                              : task.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-neutral-100 text-neutral-600"
                          }`}>
                            {task.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* Quick stats at bottom */}
            <div className="p-3 border-t border-neutral-200 bg-neutral-50">
              <p className="text-xs text-neutral-500 mb-2">Platform breakdown</p>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORM_OPTIONS.map(platform => {
                  const count = platformStats[platform.value]
                  if (count === 0) return null
                  return (
                    <div 
                      key={platform.value}
                      className="flex items-center gap-1 text-xs"
                    >
                      <PlatformBadge platform={platform.value} size="sm" />
                      <span className="text-neutral-600">{count}</span>
                    </div>
                  )
                })}
                {Object.values(platformStats).every(v => v === 0) && (
                  <span className="text-xs text-neutral-400">No posts yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
