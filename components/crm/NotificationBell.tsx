"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Bell, X, CheckCircle2, UserPlus, AtSign, ExternalLink, Clock, Trash2, History } from "lucide-react"
import { useNotifications, type Notification } from "../../context/notification-context"

interface NotificationBellProps {
  onOpenTask?: (taskId: string) => void
  onOpenContentPost?: (postId: string) => void
}

export function NotificationBell({ onOpenTask, onOpenContentPost }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"new" | "history">("new")
  const panelRef = useRef<HTMLDivElement>(null)

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

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (notification.task_id) {
      // Check if this is a content post notification
      if (notification.is_content_post && onOpenContentPost) {
        onOpenContentPost(notification.task_id)
      } else if (onOpenTask) {
        onOpenTask(notification.task_id)
      }
    }
    markAsRead([notification.id])
    setIsOpen(false)
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
    const itemType = notification.is_content_post ? "content post" : "task"
    switch (notification.type) {
      case "mention":
        return (
          <span>
            <strong>{notification.comment_author}</strong> mentioned you in a {itemType}
          </span>
        )
      case "assignment":
        return (
          <span>
            <strong>{notification.assigned_by}</strong> assigned you to this {itemType}
          </span>
        )
      case "tagged":
        return (
          <span>
            <strong>{notification.assigned_by}</strong> tagged you in this {itemType}
          </span>
        )
      default:
        return <span>New notification</span>
    }
  }

  const currentNotifications = activeTab === "new" ? notifications : notificationHistory

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
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
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
            <div className="max-h-96 overflow-y-auto">
              {isLoading && currentNotifications.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              ) : currentNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  {activeTab === "new" ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                      <p className="text-gray-600 font-medium">You&apos;re all caught up!</p>
                      <p className="text-gray-400 text-sm mt-1">No new notifications</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-12 h-12 text-neutral-300 mb-3" />
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
                      onClick={() => activeTab === "new" ? handleNotificationClick(notification) : onOpenTask && notification.task_id ? onOpenTask(notification.task_id) : null}
                      className={`w-full px-4 py-3 text-left transition-colors flex gap-3 ${
                        activeTab === "new" || (onOpenTask && notification.task_id)
                          ? "hover:bg-gray-50 cursor-pointer" 
                          : "cursor-default"
                      } ${activeTab === "history" ? "opacity-75" : ""}`}
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
