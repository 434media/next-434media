"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"

export interface Notification {
  id: string
  type: "mention" | "assignment" | "tagged" | "system"
  task_id?: string
  task_title?: string
  comment_author?: string
  comment_preview?: string
  assigned_by?: string
  message?: string
  created_at: string
  read: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  notificationHistory: Notification[]
  unreadCount: number
  isLoading: boolean
  hasNewNotification: boolean
  fetchNotifications: () => Promise<void>
  markAsRead: (notificationIds: string[]) => Promise<void>
  markAllAsRead: () => Promise<void>
  clearHistory: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const HISTORY_STORAGE_KEY = "admin_notification_history"
const MAX_HISTORY_ITEMS = 50

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationHistory, setNotificationHistory] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false)
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const previousCountRef = useRef(0)

  // Load history from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Notification[]
          setNotificationHistory(parsed)
        } catch (e) {
          console.error("Failed to parse notification history:", e)
        }
      }
    }
  }, [])

  // Save history to localStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined" && notificationHistory.length > 0) {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(notificationHistory))
    }
  }, [notificationHistory])

  // Add notification to history
  const addToHistory = useCallback((notification: Notification) => {
    setNotificationHistory(prev => {
      // Check if already in history
      if (prev.some(n => n.id === notification.id)) {
        return prev
      }
      // Add to beginning, limit to max items
      const updated = [{ ...notification, read: true }, ...prev].slice(0, MAX_HISTORY_ITEMS)
      return updated
    })
  }, [])

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

  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      // Add to history before removing
      notificationIds.forEach(id => {
        const notification = notifications.find(n => n.id === id)
        if (notification) {
          addToHistory(notification)
        }
      })

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
  }, [notifications, addToHistory])

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (notifications.length > 0) {
      await markAsRead(notifications.map(n => n.id))
    }
  }, [notifications, markAsRead])

  // Clear history
  const clearHistory = useCallback(() => {
    setNotificationHistory([])
    if (typeof window !== "undefined") {
      localStorage.removeItem(HISTORY_STORAGE_KEY)
    }
  }, [])

  // Fetch on mount and poll every 15 seconds
  useEffect(() => {
    fetchNotifications()
    
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = notifications.length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notificationHistory,
        unreadCount,
        isLoading,
        hasNewNotification,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        clearHistory,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
