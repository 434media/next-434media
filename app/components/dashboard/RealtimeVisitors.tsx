"use client"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Activity } from "lucide-react"

export function RealtimeVisitors() {
  const [count, setCount] = useState(Math.floor(Math.random() * 10) + 5)
  const [pulses, setPulses] = useState<{ id: number; timestamp: number }[]>([])

  // Simulate real-time visitor changes
  useEffect(() => {
    const interval = setInterval(() => {
      const change = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0
      const newCount = Math.max(1, count + change)

      if (change !== 0) {
        setCount(newCount)

        if (change > 0) {
          // Add a pulse when a new visitor arrives
          setPulses((prev) => [...prev, { id: Date.now(), timestamp: Date.now() }])
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [count])

  // Remove old pulses
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      setPulses((prev) => prev.filter((pulse) => now - pulse.timestamp < 3000))
    }, 1000)

    return () => clearInterval(cleanup)
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
        <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white/80">Real-time Visitors</CardTitle>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.8, 1],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="text-emerald-400"
          >
            <Activity className="h-5 w-5" />
          </motion.div>
        </CardHeader>
        <CardContent className="relative">
          <div className="relative">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-3xl font-bold text-white mb-1 flex items-center"
            >
              {count}
              <span className="text-white/60 text-sm ml-2">active now</span>
            </motion.div>

            {/* Pulse animations */}
            {pulses.map((pulse) => (
              <motion.div
                key={pulse.id}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500"
                style={{ zIndex: -1 }}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="text-xs text-white/60 mt-2"
          >
            Live data from your website visitors
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
