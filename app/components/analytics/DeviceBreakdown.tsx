"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./Card"
import { Smartphone, Monitor, Loader2, Tablet } from "lucide-react"
import type { DateRange } from "../../types/analytics"

interface DeviceBreakdownProps {
  dateRange: DateRange
  isLoading?: boolean
  setError: React.Dispatch<React.SetStateAction<string | null>>
  propertyId?: string
}

const getDeviceIcon = (device: string) => {
  switch (device.toLowerCase()) {
    case "mobile":
      return <Smartphone className="h-5 w-5" />
    case "desktop":
      return <Monitor className="h-5 w-5" />
    case "tablet":
      return <Tablet className="h-5 w-5" />
    default:
      return <Monitor className="h-5 w-5" />
  }
}

const getDeviceColor = (device: string, index: number) => {
  // Using distinct shades of white/gray for black/white theme
  const colors = [
    "#FFFFFF", // White for first device
    "#A0A0A0", // Medium gray for second
    "#606060", // Darker gray for third
  ]
  return colors[index] || "#808080"
}

export function DeviceBreakdown({
  dateRange,
  isLoading: parentLoading = false,
  setError,
  propertyId,
}: DeviceBreakdownProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        let url = `/api/analytics?endpoint=devices&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        if (propertyId) {
          url += `&propertyId=${propertyId}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }))
          console.error("Device data API error:", response.status, errorData)
          throw new Error(errorData.error || "Failed to fetch device data")
        }

        const result = await response.json()
        // Sort by sessions descending to show most popular first
        const sortedData = result.data.sort((a: any, b: any) => b.sessions - a.sessions)
        setData(sortedData)
      } catch (error) {
        console.error("Error loading device data:", error)
        setError("Failed to load device data")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [dateRange, setError, propertyId])

  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0)

  // Calculate pie chart segments
  const createPieChart = () => {
    let cumulativePercent = 0
    
    return data.map((device, index) => {
      const percentage = totalSessions > 0 ? (device.sessions / totalSessions) * 100 : 0
      const startAngle = (cumulativePercent * 360) / 100
      const endAngle = ((cumulativePercent + percentage) * 360) / 100
      cumulativePercent += percentage

      // Convert to radians
      const startRad = (startAngle - 90) * (Math.PI / 180)
      const endRad = (endAngle - 90) * (Math.PI / 180)

      // Calculate arc path
      const radius = 80
      const centerX = 100
      const centerY = 100
      
      const x1 = centerX + radius * Math.cos(startRad)
      const y1 = centerY + radius * Math.sin(startRad)
      const x2 = centerX + radius * Math.cos(endRad)
      const y2 = centerY + radius * Math.sin(endRad)
      
      const largeArc = percentage > 50 ? 1 : 0
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')

      return {
        device: device.deviceCategory,
        sessions: device.sessions,
        users: device.users,
        percentage,
        pathData,
        color: getDeviceColor(device.deviceCategory, index)
      }
    })
  }

  const pieSegments = createPieChart()

  return (
    <Card className="border border-white/10 bg-white/5 transition-colors duration-300">
      <CardContent className="p-6">
        {isLoading || parentLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
            {/* Pie Chart */}
            <div className="flex-shrink-0 relative">
              <svg width="200" height="200" viewBox="0 0 200 200" className="drop-shadow-lg">
                {pieSegments.map((segment, index) => (
                  <g key={segment.device}>
                    <path
                      d={segment.pathData}
                      fill={segment.color}
                      className="transition-all duration-200 cursor-pointer"
                      strokeWidth="2"
                      stroke="#000"
                      style={{
                        opacity: hoveredDevice === null || hoveredDevice === segment.device ? 1 : 0.3,
                        transform: hoveredDevice === segment.device ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: '100px 100px'
                      }}
                      onMouseEnter={() => setHoveredDevice(segment.device)}
                      onMouseLeave={() => setHoveredDevice(null)}
                    />
                  </g>
                ))}
              </svg>
              
              {/* Hover Tooltip */}
              {hoveredDevice && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="bg-black border border-white/20 rounded-lg px-4 py-3 shadow-xl">
                    {pieSegments.filter(s => s.device === hoveredDevice).map(segment => (
                      <div key={segment.device} className="text-center whitespace-nowrap">
                        <div className="text-white font-bold text-2xl">{segment.percentage.toFixed(1)}%</div>
                        <div className="text-white/70 text-sm capitalize">{segment.device}</div>
                        <div className="text-white/50 text-xs mt-1">{segment.sessions.toLocaleString()} sessions</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-4 w-full lg:w-auto">
              {pieSegments.map((segment, index) => (
                <div 
                  key={segment.device}
                  className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    hoveredDevice === segment.device
                      ? 'bg-white/20 border-white/30 scale-105'
                      : hoveredDevice === null
                      ? 'bg-white/5 border-white/10 hover:bg-white/10'
                      : 'bg-white/5 border-white/10 opacity-40'
                  }`}
                  onMouseEnter={() => setHoveredDevice(segment.device)}
                  onMouseLeave={() => setHoveredDevice(null)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div 
                      className="w-4 h-4 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: segment.color }}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">{getDeviceIcon(segment.device)}</span>
                      <span className="text-white font-medium capitalize">{segment.device}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-bold text-lg">{segment.percentage.toFixed(1)}%</div>
                    <div className="text-white/50 text-xs">{segment.sessions.toLocaleString()} sessions</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
