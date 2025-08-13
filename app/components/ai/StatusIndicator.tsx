"use client"

import { motion } from "motion/react"

type StatusType =
  | "connected"
  | "disconnected"
  | "loading"
  | "synced"
  | "outdated"
  | "error"
  | "available"
  | "unavailable"

interface StatusIndicatorProps {
  label: string
  status: StatusType
  description: string
}

export default function StatusIndicator({ label, status, description }: StatusIndicatorProps) {
  const getStatusConfig = (status: StatusType) => {
    switch (status) {
      case "connected":
      case "synced":
      case "available":
        return {
          color: "text-green-600",
          bgColor: "bg-green-100",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
        }
      case "loading":
        return {
          color: "text-blue-600",
          bgColor: "bg-blue-100",
          icon: <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />,
        }
      case "outdated":
        return {
          color: "text-yellow-600",
          bgColor: "bg-yellow-100",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        }
      case "error":
      case "disconnected":
      case "unavailable":
      default:
        return {
          color: "text-red-600",
          bgColor: "bg-red-100",
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center space-x-3"
    >
      <div className={`w-8 h-8 rounded-full ${config.bgColor} ${config.color} flex items-center justify-center`}>
        {config.icon}
      </div>
      {label && (
        <div className="flex-1">
          <div className="font-medium text-slate-900">{label}</div>
          {description && <div className="text-sm text-slate-600">{description}</div>}
        </div>
      )}
    </motion.div>
  )
}
