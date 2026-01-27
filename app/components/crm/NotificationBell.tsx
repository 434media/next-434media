"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Bell, X, CheckCircle2, UserPlus, AtSign, ExternalLink } from "lucide-react"

interface Notification {
  id: string
  type: "mention" | "assignment" | "tagged"
  task_id: string
  task_title: string
  comment_author?: string
  comment_preview?: string
  assigned_by?: string
  created_at: string
  read: boolean
}

interface NotificationBellProps {
  onOpenTask?: (taskId: string) => void
}

export function NotificationBell({ onOpenTask }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false)
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const previousCountRef = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/admin/crm/notifications", {
        credentials: "include",
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.notifications) {
          const newNotifications = data.notifications as Notification[]
          
          // Check if there are new notifications since last check
          if (hasCheckedOnce && newNotifications.length > previousCountRef.current) {
            setHasNewNotification(true)
            // Reset the animation after 3 seconds
            setTimeout(() => setHasNewNotification(false), 3000)
          }
          
          previousCountRef.current = newNotifications.length
          setNotifications(newNotifications)
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    } finally {
      setIsLoading(false)
      setHasCheckedOnce(true)
    }
  }, [hasCheckedOnce])

  // Fetch on mount and poll every 15 seconds for more responsive in-app notifications
  useEffect(() => {
    fetchNotifications()
    
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Mark notifications as read
  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch("/api/admin/crm/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationIds }),
      })
      
      // Update local state
      setNotifications(prev => 
        prev.filter(n => !notificationIds.includes(n.id))
      )
    } catch (error) {
      console.error("Failed to mark notifications as read:", error)
    }
  }

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (onOpenTask) {
      onOpenTask(notification.task_id)
    }
    markAsRead([notification.id])
    setIsOpen(false)
  }

  // Mark all as read
  const handleMarkAllAsRead = () => {
    if (notifications.length > 0) {
      markAsRead(notifications.map(n => n.id))
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
            <strong>{notification.comment_author}</strong> mentioned you in a comment
          </span>
        )
      case "assignment":
        return (
          <span>
            <strong>{notification.assigned_by}</strong> assigned you to this task
          </span>
        )
      case "tagged":
        return (
          <span>
            <strong>{notification.assigned_by}</strong> tagged you in this task
          </span>
        )
      default:
        return <span>New notification</span>
    }
  }

  const unreadCount = notifications.length

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        aria-label="Notifications"
        animate={hasNewNotification ? { 
          rotate: [0, -15, 15, -15, 15, 0],
          scale: [1, 1.1, 1.1, 1.1, 1.1, 1]
        } : {}}
        transition={{ duration: 0.5 }}
      >
        <Bell className={`w-5 h-5 ${hasNewNotification ? 'text-red-500' : 'text-neutral-600'}`} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full"
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
            className="absolute inset-0 rounded-lg bg-red-400"
          />
        )}
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-neutral-50 to-neutral-100 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading && !hasCheckedOnce ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="text-gray-600 font-medium">You&apos;re all caught up!</p>
                  <p className="text-gray-400 text-sm mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <motion.button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex gap-3"
                      whileHover={{ x: 2 }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-1 font-medium">
                          {notification.task_title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {getNotificationMessage(notification)}
                        </p>
                        {notification.comment_preview && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">
                            &ldquo;{notification.comment_preview}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
