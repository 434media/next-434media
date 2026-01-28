"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Bell, 
  LogOut, 
  ChevronDown, 
  CheckCircle2, 
  AtSign, 
  UserPlus, 
  ExternalLink,
  Clock,
  Trash2,
  History
} from "lucide-react"
import { useNotifications, type Notification } from "../context/notification-context"

interface AdminUserMenuProps {
  user: {
    name: string
    email: string
    picture?: string
  }
  greeting?: string
}

export function AdminUserMenu({ user, greeting }: AdminUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"new" | "history">("new")
  const menuRef = useRef<HTMLDivElement>(null)
  
  const {
    notifications,
    notificationHistory,
    unreadCount,
    isLoading,
    hasNewNotification,
    markAsRead,
    markAllAsRead,
    clearHistory,
  } = useNotifications()

  // Debug log on mount and when notifications change
  useEffect(() => {
    console.log("[AdminUserMenu] Mounted with notifications:", {
      unreadCount,
      notifications,
      isLoading,
      user: user.email
    })
  }, [unreadCount, notifications, isLoading, user.email])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" })
      window.location.href = "/admin"
    } catch (error) {
      console.error("Failed to logout:", error)
      window.location.href = "/admin"
    }
  }

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "mention":
        return <AtSign className="w-4 h-4 text-blue-500" />
      case "assignment":
        return <UserPlus className="w-4 h-4 text-green-500" />
      case "tagged":
        return <AtSign className="w-4 h-4 text-purple-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  // Get notification message
  const getNotificationMessage = (notification: Notification) => {
    switch (notification.type) {
      case "mention":
        return (
          <span>
            <strong>{notification.comment_author}</strong> mentioned you
          </span>
        )
      case "assignment":
        return (
          <span>
            <strong>{notification.assigned_by}</strong> assigned you
          </span>
        )
      case "tagged":
        return (
          <span>
            <strong>{notification.assigned_by}</strong> tagged you
          </span>
        )
      case "system":
        return <span>{notification.message}</span>
      default:
        return <span>New notification</span>
    }
  }

  // Handle notification click - navigate to CRM
  const handleNotificationClick = (notification: Notification) => {
    if (notification.task_id) {
      // Store the task ID to open when CRM loads
      sessionStorage.setItem("openTaskId", notification.task_id)
      window.location.href = "/admin/crm"
    }
    markAsRead([notification.id])
    setIsOpen(false)
  }

  const currentNotifications = activeTab === "new" ? notifications : notificationHistory

  return (
    <div className="relative" ref={menuRef}>
      {/* User Button with Notification Badge */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors group"
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-sm text-neutral-600 group-hover:text-neutral-900">
          {greeting && <span className="hidden sm:inline">{greeting}, </span>}
          <span className="font-semibold text-neutral-900">{user.name}</span>
        </span>
        
        {/* Notification Badge */}
        <div className="relative">
          <motion.div
            animate={hasNewNotification ? { 
              rotate: [0, -15, 15, -15, 15, 0],
              scale: [1, 1.1, 1.1, 1.1, 1.1, 1]
            } : {}}
            transition={{ duration: 0.5 }}
          >
            <Bell className={`w-4 h-4 ${hasNewNotification ? 'text-red-500' : 'text-neutral-400'}`} />
          </motion.div>
          
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
          
          {/* Pulse animation for new notifications */}
          {hasNewNotification && (
            <motion.span
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1, repeat: 2 }}
              className="absolute inset-0 rounded-full bg-red-400"
            />
          )}
        </div>
        
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
          >
            {/* User Info Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-neutral-50 to-neutral-100 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {user.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.name}
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center text-neutral-600 font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("new")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "new"
                    ? "text-neutral-900 border-b-2 border-neutral-900 bg-neutral-50"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <Bell className="w-4 h-4" />
                New
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "history"
                    ? "text-neutral-900 border-b-2 border-neutral-900 bg-neutral-50"
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <History className="w-4 h-4" />
                History
                {notificationHistory.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 bg-neutral-200 rounded-full">
                    {notificationHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Actions Bar */}
            {currentNotifications.length > 0 && (
              <div className="flex items-center justify-end gap-2 px-4 py-2 bg-neutral-50 border-b border-gray-100">
                {activeTab === "new" && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                {activeTab === "history" && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear history
                  </button>
                )}
              </div>
            )}

            {/* Notification List */}
            <div className="max-h-72 overflow-y-auto">
              {isLoading && currentNotifications.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              ) : currentNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  {activeTab === "new" ? (
                    <>
                      <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
                      <p className="text-gray-600 font-medium">All caught up!</p>
                      <p className="text-gray-400 text-sm mt-1">No new notifications</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-10 h-10 text-neutral-300 mb-3" />
                      <p className="text-gray-600 font-medium">No history yet</p>
                      <p className="text-gray-400 text-sm mt-1">Read notifications will appear here</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {currentNotifications.map((notification) => (
                    <motion.button
                      key={notification.id}
                      onClick={() => activeTab === "new" ? handleNotificationClick(notification) : null}
                      className={`w-full px-4 py-3 text-left transition-colors flex gap-3 ${
                        activeTab === "new" 
                          ? "hover:bg-gray-50 cursor-pointer" 
                          : "cursor-default opacity-75"
                      }`}
                      whileHover={activeTab === "new" ? { x: 2 } : {}}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {notification.task_title && (
                          <p className="text-sm text-gray-900 line-clamp-1 font-medium">
                            {notification.task_title}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          {getNotificationMessage(notification)}
                        </p>
                        {notification.comment_preview && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">
                            &ldquo;{notification.comment_preview}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                      {activeTab === "new" && (
                        <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
