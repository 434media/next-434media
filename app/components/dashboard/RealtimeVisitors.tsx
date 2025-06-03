"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Users, Loader2, AlertCircle } from "lucide-react"
import { fetchAnalyticsData } from "../../lib/analytics-api"

export function RealtimeVisitors() {
  const [visitors, setVisitors] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRealtimeData = async () => {
      try {
        const result = await fetchAnalyticsData("realtime", "1h")
        if (result && typeof result.visitors === "number") {
          setVisitors(result.visitors)
        } else {
          setVisitors(0) // Default to 0 if no data
        }
        setError(null)
      } catch (error) {
        console.error("Error loading realtime visitors:", error)
        setError("Failed to load realtime data")
        setVisitors(null)
      } finally {
        setIsLoading(false)
      }
    }

    // Load initial data
    loadRealtimeData()

    // Set up polling for realtime updates every 30 seconds
    const interval = setInterval(loadRealtimeData, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-blue-500/15" />
        <CardHeader className="relative">
          <CardTitle className="text-white flex items-center gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}>
              <Users className="h-5 w-5 text-emerald-400" />
            </motion.div>
            Realtime Visitors
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-emerald-400" />
              </motion.div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-20">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <motion.div
                key={visitors}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-4xl font-bold text-white mb-2"
              >
                {visitors !== null ? visitors.toLocaleString() : "0"}
              </motion.div>
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                />
                <p className="text-white/70 text-sm">Active now</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
