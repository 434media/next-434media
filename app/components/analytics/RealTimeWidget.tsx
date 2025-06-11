"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { Activity, Users, Eye, Loader2 } from "lucide-react"

interface RealtimeWidgetProps {
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

interface RealtimeData {
  activeUsers: number
  screenPageViews: number
  topPages: Array<{
    path: string
    activeUsers: number
  }>
}

export function RealtimeWidget({ setError }: RealtimeWidgetProps) {
  const [data, setData] = useState<RealtimeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const adminKey = sessionStorage.getItem("adminKey")
        const response = await fetch("/api/analytics?endpoint=realtime", {
          headers: {
            "x-admin-key": adminKey || "",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch realtime data")
        }

        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error("Error loading realtime data:", error)
        setError("Failed to load realtime data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Refresh realtime data every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [setError])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-green-500/10 rounded-xl" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-lg">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            Real-time Activity
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="w-2 h-2 bg-emerald-400 rounded-full ml-auto"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-emerald-400" />
                  <span className="text-white/80 text-sm">Active Users</span>
                </div>
                <div className="text-3xl font-bold text-white">{data?.activeUsers || 0}</div>
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-blue-400" />
                  <span className="text-white/80 text-sm">Page Views</span>
                </div>
                <div className="text-3xl font-bold text-white">{data?.screenPageViews || 0}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <div className="text-white/80 text-sm font-medium mb-3">Top Active Pages</div>
                {data?.topPages?.slice(0, 3).map((page, index) => (
                  <motion.div
                    key={page.path}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                  >
                    <span className="text-white/70 text-xs truncate">{page.path}</span>
                    <span className="text-emerald-400 font-medium text-xs">{page.activeUsers}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
