"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader"
import { HeroMetric } from "@/components/analytics/HeroMetric"
import { WhatChangedPanel } from "@/components/analytics/WhatChangedPanel"
import { PageViewsChart } from "@/components/analytics/PageViewsChart"
import { TopPagesTable } from "@/components/analytics/TopPagesTable"
import { TrafficSourcesChart } from "@/components/analytics/TrafficSourcesChart"
import { DeviceBreakdown } from "@/components/analytics/DeviceBreakdown"
import { GeographicMap } from "@/components/analytics/GeographicMap"
import { InfoTooltip } from "@/components/analytics/InfoTooltip"
import { EventsConversionsPanel } from "@/components/analytics/EventsConversionsPanel"
import { SearchPerformancePanel } from "@/components/analytics/SearchPerformancePanel"
import { CoreWebVitalsPanel } from "@/components/analytics/CoreWebVitalsPanel"
import { CohortRetentionPanel } from "@/components/analytics/CohortRetentionPanel"
import { InsightsPanel } from "@/components/analytics/InsightsPanel"
import { AnnotationManager, type ChartAnnotation } from "@/components/analytics/AnnotationManager"
import { GoalsKpiPanel } from "@/components/analytics/GoalsKpiPanel"
import { AnalyticsFilterBar } from "@/components/analytics/AnalyticsFilterBar"
import { dateRangeFromUrl, rangeKeyFromDateRange } from "@/lib/analytics-url-state"
import type { DateRange, AnalyticsConnectionStatus, AnalyticsProperty, AnalyticsFilters } from "@/types/analytics"

// Download analytics summary as CSV
async function downloadAnalyticsCSV(dateRange: DateRange, propertyId?: string, propertyName?: string) {
  try {
    // Fetch all data in parallel
    const [summaryResponse, pagesResponse, trafficResponse, devicesResponse] = await Promise.all([
      fetch(`/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=top-pages&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=trafficsources&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=devices&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`)
    ])
    
    if (!summaryResponse.ok) {
      throw new Error('Failed to fetch analytics data')
    }
    
    const data = await summaryResponse.json()
    const pagesData = pagesResponse.ok ? await pagesResponse.json() : { data: [] }
    const trafficData = trafficResponse.ok ? await trafficResponse.json() : { data: [] }
    const devicesData = devicesResponse.ok ? await devicesResponse.json() : { data: [] }
    
    const topPages = pagesData.data?.slice(0, 10) || []
    const trafficSources = trafficData.data?.slice(0, 6) || []
    const devices = devicesData.data || []
    
    // Determine property ID and name
    const displayPropertyId = propertyId || data.propertyId || '488543948'
    const displayPropertyName = propertyName || PROPERTY_NAMES[displayPropertyId] || '434 MEDIA'
    
    // Format the date for filename
    const today = new Date().toISOString().split('T')[0]
    const labelSlug = (dateRange.label || 'custom').replace(/\s+/g, '-').toLowerCase()
    const propertySlug = displayPropertyName.replace(/\s+/g, '-').toLowerCase()
    const filename = `${propertySlug}-analytics-${labelSlug}-${today}.csv`
    
    // Metrics to exclude from CSV export
    const csvExcludedMetrics = ['pageViewsChange', 'sessionsChange', 'usersChange', 'bounceRateChange', '_source', 'source', 'propertyId', 'averageSessionDuration', 'activeUsers', 'avgSessionDuration']
    
    // Create CSV content
    let csvContent = `${displayPropertyName} Analytics Report\n`
    csvContent += `Property ID: ${displayPropertyId}\n`
    csvContent += `Date Range: ${dateRange.label || 'Custom'}\n`
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`
    
    // Key Metrics Section
    csvContent += "=== KEY METRICS ===\n"
    csvContent += "Metric,Value\n"
    
    const metrics = data.metrics || data
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value !== 'object' && !csvExcludedMetrics.some(excluded => key.toLowerCase().includes(excluded.toLowerCase()))) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
        csvContent += `${formattedKey},${formatMetricValue(key, value as number | string)}\n`
      }
    })
    
    // Top Pages Section
    if (topPages.length > 0) {
      csvContent += "\n=== TOP PAGES ===\n"
      csvContent += "Page,Views\n"
      topPages.forEach((page: { pagePath?: string; path?: string; pageViews?: number; views?: number }) => {
        const pagePath = page.pagePath || page.path || '/'
        const views = page.pageViews || page.views || 0
        csvContent += `"${pagePath}",${views}\n`
      })
    }
    
    // Traffic Sources Section
    if (trafficSources.length > 0) {
      csvContent += "\n=== TRAFFIC SOURCES ===\n"
      csvContent += "Source,Sessions,Users\n"
      trafficSources.forEach((source: { source: string; sessions: number; users: number }) => {
        csvContent += `"${source.source}",${source.sessions},${source.users}\n`
      })
    }
    
    // Device Types Section
    if (devices.length > 0) {
      csvContent += "\n=== DEVICE TYPES ===\n"
      csvContent += "Device,Sessions,Users\n"
      devices.forEach((device: { deviceCategory: string; sessions: number; users: number }) => {
        csvContent += `"${device.deviceCategory}",${device.sessions},${device.users}\n`
      })
    }
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Download failed:', error)
    alert('Failed to download analytics report. Please try again.')
  }
}

// Helper to format numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString()
}

// Helper to format metric values for display
function formatMetricValue(key: string, value: number | string): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value))
  
  // Format bounce rate as percentage
  if (key.toLowerCase().includes('bouncerate') || key.toLowerCase().includes('bounce_rate')) {
    if (numValue <= 1) {
      return `${(numValue * 100).toFixed(1)}%`
    }
    return `${numValue.toFixed(1)}%`
  }
  
  // Format other percentages
  if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('percentage')) {
    return `${numValue.toFixed(1)}%`
  }
  
  // Format regular numbers
  if (typeof value === 'number') {
    return formatNumber(value)
  }
  
  return String(value)
}

// Metrics to exclude from PNG export (including average session duration and active users)
const EXCLUDED_METRICS = ['pageViewsChange', 'sessionsChange', 'usersChange', 'bounceRateChange', '_source', 'source', 'propertyId', 'averageSessionDuration', 'activeUsers', 'avgSessionDuration']

// Property name lookup map
const PROPERTY_NAMES: Record<string, string> = {
  '488543948': '434 MEDIA',
  '492867424': 'TXMX Boxing',
  '492895637': 'Vemos Vamos',
  '492925168': 'AIM Health R&D Summit',
  '492857375': 'Salute to Troops',
  '488563710': 'The AMPD Project',
  '492925088': 'Digital Canvas',
}

// Download analytics as PNG using Canvas API (avoids CSS color parsing issues)
async function downloadAnalyticsPNG(dateRange: DateRange, propertyId?: string, propertyName?: string) {
  try {
    // Fetch all data in parallel
    const [summaryResponse, pagesResponse, trafficResponse, devicesResponse] = await Promise.all([
      fetch(`/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=top-pages&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=trafficsources&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=devices&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`)
    ])
    
    if (!summaryResponse.ok) {
      throw new Error('Failed to fetch analytics data')
    }
    
    const data = await summaryResponse.json()
    const pagesData = pagesResponse.ok ? await pagesResponse.json() : { data: [] }
    const trafficData = trafficResponse.ok ? await trafficResponse.json() : { data: [] }
    const devicesData = devicesResponse.ok ? await devicesResponse.json() : { data: [] }
    
    const topPages = pagesData.data?.slice(0, 5) || []
    const trafficSources = trafficData.data?.slice(0, 5) || []
    const devices = devicesData.data || []
    
    // Determine property ID and name
    const displayPropertyId = propertyId || data.propertyId || '488543948'
    const displayPropertyName = propertyName || PROPERTY_NAMES[displayPropertyId] || '434 MEDIA'
    
    // Create canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      alert('Unable to create canvas. Please try again.')
      return
    }
    
    // Calculate dynamic canvas height based on content
    const hasPages = topPages.length > 0
    const hasSources = trafficSources.length > 0
    const hasDevices = devices.length > 0
    let canvasHeight = 500 // Base height for header + metrics
    if (hasPages) canvasHeight += 280 // Top pages section
    if (hasSources || hasDevices) canvasHeight += 300 // Traffic sources and devices section
    
    // Set canvas size
    canvas.width = 1200
    canvas.height = canvasHeight
    
    // Draw background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw gradient accent bar at top
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
    gradient.addColorStop(0, '#10b981')
    gradient.addColorStop(1, '#14b8a6')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, 6)
    
    // Draw header with property name
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${displayPropertyName} Analytics Report`, 60, 70)
    
    // Draw property info (ID)
    ctx.fillStyle = '#9ca3af'
    ctx.font = '14px system-ui, -apple-system, sans-serif'
    ctx.fillText(`Property ID: ${displayPropertyId}`, 60, 100)
    
    // Draw date range
    ctx.fillStyle = '#9ca3af'
    ctx.font = '18px system-ui, -apple-system, sans-serif'
    ctx.fillText(`Date Range: ${dateRange.label || 'Custom'}`, 60, 130)
    
    // Draw generated date
    ctx.fillStyle = '#6b7280'
    ctx.font = '14px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, canvas.width - 60, 70)
    
    // Draw divider
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(60, 160)
    ctx.lineTo(canvas.width - 60, 160)
    ctx.stroke()
    
    // Extract metrics from data, filtering out excluded ones
    const metrics = data.metrics || data
    const metricsArray = Object.entries(metrics)
      .filter(([key, value]) => 
        typeof value !== 'object' && 
        !EXCLUDED_METRICS.includes(key) &&
        !key.startsWith('_')
      )
    
    // Draw metrics cards
    const cardWidth = 250
    const cardHeight = 120
    const cardsPerRow = 4
    const startX = 60
    const startY = 200
    const gapX = 30
    const gapY = 30
    
    metricsArray.slice(0, 8).forEach(([key, value], index) => {
      const row = Math.floor(index / cardsPerRow)
      const col = index % cardsPerRow
      const x = startX + col * (cardWidth + gapX)
      const y = startY + row * (cardHeight + gapY)
      
      // Card background
      ctx.fillStyle = '#1f2937'
      ctx.beginPath()
      ctx.roundRect(x, y, cardWidth, cardHeight, 12)
      ctx.fill()
      
      // Card border
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x, y, cardWidth, cardHeight, 12)
      ctx.stroke()
      
      // Metric label
      ctx.fillStyle = '#9ca3af'
      ctx.font = '12px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
      ctx.fillText(formattedKey.toUpperCase(), x + 20, y + 35)
      
      // Metric value (with proper formatting)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
      const displayValue = formatMetricValue(key, value as number | string)
      ctx.fillText(displayValue, x + 20, y + 80)
    })
    
    // Calculate Y position after metrics cards
    const metricsRows = Math.ceil(Math.min(metricsArray.length, 8) / cardsPerRow)
    let currentY = startY + metricsRows * (cardHeight + gapY) + 20
    
    // Draw Top Pages section if available
    if (topPages.length > 0) {
      // Section header
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('Top Pages', 60, currentY + 30)
      
      currentY += 60
      
      // Draw top pages table
      const tableX = 60
      const tableWidth = canvas.width - 120
      const rowHeight = 40
      
      // Table header
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(tableX, currentY, tableWidth, rowHeight)
      
      ctx.fillStyle = '#9ca3af'
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      ctx.fillText('PAGE', tableX + 20, currentY + 25)
      ctx.textAlign = 'right'
      ctx.fillText('VIEWS', tableX + tableWidth - 20, currentY + 25)
      
      currentY += rowHeight
      
      // Table rows
      topPages.forEach((page: { pagePath?: string; path?: string; pageViews?: number; views?: number }, index: number) => {
        // Alternating row background
        ctx.fillStyle = index % 2 === 0 ? '#111827' : '#0a0a0a'
        ctx.fillRect(tableX, currentY, tableWidth, rowHeight)
        
        // Page path
        ctx.fillStyle = '#e5e7eb'
        ctx.font = '14px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'left'
        const pagePath = page.pagePath || page.path || '/'
        const truncatedPath = pagePath.length > 60 ? pagePath.substring(0, 57) + '...' : pagePath
        ctx.fillText(truncatedPath, tableX + 20, currentY + 25)
        
        // Page views
        ctx.fillStyle = '#3b82f6'
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'right'
        const views = page.pageViews || page.views || 0
        ctx.fillText(formatNumber(views), tableX + tableWidth - 20, currentY + 25)
        
        currentY += rowHeight
      })
      
      currentY += 30 // Add spacing after top pages
    }
    
    // Draw Traffic Sources and Device Types side by side
    if (trafficSources.length > 0 || devices.length > 0) {
      const sectionWidth = (canvas.width - 140) / 2
      const tableX = 60
      const rowHeight = 35
      
      // Traffic Sources Section (left side)
      if (trafficSources.length > 0) {
        // Section header
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('Traffic Sources', tableX, currentY + 25)
        
        let sourceY = currentY + 50
        
        // Table header
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(tableX, sourceY, sectionWidth, rowHeight)
        
        ctx.fillStyle = '#9ca3af'
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('SOURCE', tableX + 15, sourceY + 22)
        ctx.textAlign = 'right'
        ctx.fillText('SESSIONS', tableX + sectionWidth - 15, sourceY + 22)
        
        sourceY += rowHeight
        
        // Traffic source rows
        trafficSources.forEach((source: { source: string; sessions: number; users: number }, index: number) => {
          ctx.fillStyle = index % 2 === 0 ? '#111827' : '#0a0a0a'
          ctx.fillRect(tableX, sourceY, sectionWidth, rowHeight)
          
          ctx.fillStyle = '#e5e7eb'
          ctx.font = '13px system-ui, -apple-system, sans-serif'
          ctx.textAlign = 'left'
          const sourceName = source.source === '(direct)' ? 'Direct' : source.source
          const truncatedSource = sourceName.length > 25 ? sourceName.substring(0, 22) + '...' : sourceName
          ctx.fillText(truncatedSource, tableX + 15, sourceY + 22)
          
          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
          ctx.textAlign = 'right'
          ctx.fillText(formatNumber(source.sessions), tableX + sectionWidth - 15, sourceY + 22)
          
          sourceY += rowHeight
        })
      }
      
      // Device Types Section (right side)
      if (devices.length > 0) {
        const deviceX = tableX + sectionWidth + 20
        
        // Section header
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('Device Types', deviceX, currentY + 25)
        
        let deviceY = currentY + 50
        
        // Table header
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(deviceX, deviceY, sectionWidth, rowHeight)
        
        ctx.fillStyle = '#9ca3af'
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText('DEVICE', deviceX + 15, deviceY + 22)
        ctx.textAlign = 'right'
        ctx.fillText('SESSIONS', deviceX + sectionWidth - 15, deviceY + 22)
        
        deviceY += rowHeight
        
        // Device type rows
        devices.forEach((device: { deviceCategory: string; sessions: number; users: number }, index: number) => {
          ctx.fillStyle = index % 2 === 0 ? '#111827' : '#0a0a0a'
          ctx.fillRect(deviceX, deviceY, sectionWidth, rowHeight)
          
          ctx.fillStyle = '#e5e7eb'
          ctx.font = '13px system-ui, -apple-system, sans-serif'
          ctx.textAlign = 'left'
          const deviceName = device.deviceCategory.charAt(0).toUpperCase() + device.deviceCategory.slice(1)
          ctx.fillText(deviceName, deviceX + 15, deviceY + 22)
          
          ctx.fillStyle = '#8b5cf6'
          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
          ctx.textAlign = 'right'
          ctx.fillText(formatNumber(device.sessions), deviceX + sectionWidth - 15, deviceY + 22)
          
          deviceY += rowHeight
        })
      }
    }
    
    // Draw footer
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Powered by Google Analytics 4 • 434 Media', canvas.width / 2, canvas.height - 40)
    
    // Draw decorative gradient line at bottom
    const bottomGradient = ctx.createLinearGradient(0, canvas.height - 6, canvas.width, canvas.height - 6)
    bottomGradient.addColorStop(0, '#10b981')
    bottomGradient.addColorStop(1, '#14b8a6')
    ctx.fillStyle = bottomGradient
    ctx.fillRect(0, canvas.height - 6, canvas.width, 6)
    
    // Format the date for filename
    const today = new Date().toISOString().split('T')[0]
    const labelSlug = (dateRange.label || 'custom').replace(/\s+/g, '-').toLowerCase()
    const propertySlug = displayPropertyName.replace(/\s+/g, '-').toLowerCase()
    const filename = `${propertySlug}-analytics-${labelSlug}-${today}.png`
    
    // Create and download the file
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('PNG download failed:', error)
    alert('Failed to download analytics report. Please try again.')
  }
}

/**
 * Snapshot freshness indicator. Tells the rep whether they're looking at
 * this morning's cached snapshot (default — fast) or a live GA4 query.
 * Click to toggle between the two modes — also flips the `?live=1` URL param.
 */
function SnapshotPill({
  meta,
  useSnapshot,
  onToggle,
}: {
  meta: { snapshotDate: string; generatedAt: string } | null
  useSnapshot: boolean
  onToggle: () => void
}) {
  const baseClasses =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer hover:brightness-95"

  if (!useSnapshot) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Click to switch to cached snapshot (faster)"
        className={`${baseClasses} bg-emerald-50 text-emerald-700 border border-emerald-100`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Live data
      </button>
    )
  }
  if (!meta) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Click to switch to live data"
        className={`${baseClasses} bg-neutral-100 text-neutral-500 border border-neutral-200`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        Loading snapshot…
      </button>
    )
  }
  let when = meta.generatedAt
  try {
    when = new Date(meta.generatedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    /* keep raw string */
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Click to switch to live data (slower, hits GA4 directly)"
      className={`${baseClasses} bg-blue-50 text-blue-700 border border-blue-100`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      Cached snapshot · {when}
    </button>
  )
}

/**
 * Realtime active-users pill. Polls /api/analytics?endpoint=realtime every
 * 30s. The endpoint already returns top countries + top pages; we surface
 * just the headline number and reveal the rest in the title attribute for now.
 * (Phase 3 will add a hover popover.)
 */
function RealtimePill({ propertyId }: { propertyId: string }) {
  const [active, setActive] = useState<number | null>(null)
  const [topPages, setTopPages] = useState<Array<{ path: string; activeUsers: number }>>([])

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const fetchRealtime = async () => {
      try {
        const res = await fetch(
          `/api/analytics?endpoint=realtime&propertyId=${encodeURIComponent(propertyId)}`,
          { cache: "no-store" },
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setActive(typeof data.totalActiveUsers === "number" ? data.totalActiveUsers : 0)
        setTopPages(Array.isArray(data.topPages) ? data.topPages.slice(0, 3) : [])
      } catch {
        /* silent — pill is non-critical */
      }
    }
    fetchRealtime()
    const id = setInterval(fetchRealtime, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [propertyId])

  if (active === null) return null

  const tooltip = topPages.length > 0
    ? `Top: ${topPages.map((p) => `${p.path} (${p.activeUsers})`).join(", ")}`
    : undefined

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-100"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
      <span className="tabular-nums">{active}</span>
      <span>active now</span>
    </span>
  )
}

export default function AnalyticsClientPage() {
  // URL-driven state — refresh restores, share-link works, Cmd+K can deep-link.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [isLoading, setIsLoading] = useState(false)
  // Seed from URL on first render. The `?range=` key drives the date selector;
  // `?start=`/`?end=` apply when range=custom; `?property=` drives the GA4
  // property dropdown; `?live=1` flips data source to live (default snapshot).
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() =>
    dateRangeFromUrl(new URLSearchParams(searchParams?.toString() ?? "")),
  )
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    () => searchParams?.get("property") ?? "",
  )
  const [availableProperties, setAvailableProperties] = useState<AnalyticsProperty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<AnalyticsConnectionStatus | null>(null)
  const [dataSource, setDataSource] = useState<"snapshot" | "live">(
    () => (searchParams?.get("live") === "1" ? "live" : "snapshot"),
  )
  const [snapshotMeta, setSnapshotMeta] = useState<{ snapshotDate: string; generatedAt: string } | null>(null)
  const useSnapshot = dataSource === "snapshot"

  // PR 3d filter state. Seeded from URL — refresh + share-link work.
  // Only summary / daily-metrics / top-pages chart components actually
  // consume `filters` (see FILTER_AWARE_ENDPOINTS in lib/analytics-url.ts);
  // breakdown charts (sources / devices / geographic) intentionally don't.
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({
    deviceCategory: searchParams?.get("device") || undefined,
    channelGroup: searchParams?.get("channel") || undefined,
    country: searchParams?.get("country") || undefined,
  }))

  // PR 5b — annotations state. Lives at the page level so the Traffic Trend
  // chart can render markers and the manager popover can mutate the list.
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([])

  // Push state changes back to the URL. Avoids re-render loops by checking
  // each param against its current URL value before pushing.
  useEffect(() => {
    const current = new URLSearchParams(searchParams?.toString() ?? "")
    const next = new URLSearchParams(current.toString())

    const desiredRangeKey = rangeKeyFromDateRange(selectedDateRange)
    next.set("range", desiredRangeKey)
    if (desiredRangeKey === "custom") {
      next.set("start", selectedDateRange.startDate)
      next.set("end", selectedDateRange.endDate)
    } else {
      next.delete("start")
      next.delete("end")
    }

    if (selectedPropertyId) {
      next.set("property", selectedPropertyId)
    } else {
      next.delete("property")
    }

    if (dataSource === "live") {
      next.set("live", "1")
    } else {
      next.delete("live")
    }

    // Filter chips → URL. Empty values delete their key for clean URLs.
    if (filters.deviceCategory) {
      next.set("device", filters.deviceCategory)
    } else {
      next.delete("device")
    }
    if (filters.channelGroup) {
      next.set("channel", filters.channelGroup)
    } else {
      next.delete("channel")
    }
    if (filters.country) {
      next.set("country", filters.country)
    } else {
      next.delete("country")
    }

    if (next.toString() !== current.toString()) {
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateRange, selectedPropertyId, dataSource, filters])

  // React to back/forward URL changes from the browser. Mostly a no-op since
  // user-initiated changes already round-trip via the effect above, but
  // necessary for "share this view" links and browser nav to work.
  useEffect(() => {
    const next = dateRangeFromUrl(new URLSearchParams(searchParams?.toString() ?? ""))
    if (next.label !== selectedDateRange.label) setSelectedDateRange(next)
    const propertyParam = searchParams?.get("property") ?? ""
    if (propertyParam && propertyParam !== selectedPropertyId) setSelectedPropertyId(propertyParam)
    const liveParam = searchParams?.get("live") === "1" ? "live" : "snapshot"
    if (liveParam !== dataSource) setDataSource(liveParam)
    const nextFilters: AnalyticsFilters = {
      deviceCategory: searchParams?.get("device") || undefined,
      channelGroup: searchParams?.get("channel") || undefined,
      country: searchParams?.get("country") || undefined,
    }
    if (
      nextFilters.deviceCategory !== filters.deviceCategory ||
      nextFilters.channelGroup !== filters.channelGroup ||
      nextFilters.country !== filters.country
    ) {
      setFilters(nextFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Load properties on component mount
  useEffect(() => {
    loadAvailableProperties()
    testConnection()
  }, [])

  // Refresh data when date range or property changes
  useEffect(() => {
    if (selectedPropertyId) {
      forceRefreshData()
    }
  }, [selectedDateRange, selectedPropertyId])

  const loadAvailableProperties = async () => {
    try {
      console.log("Loading available properties...")

      const response = await fetch("/api/analytics?endpoint=properties")

      if (response.ok) {
        const result = await response.json()
        console.log("Properties API response:", result)

        // Handle different possible response formats
        let properties: AnalyticsProperty[] = []

        if (Array.isArray(result)) {
          properties = result
        } else if (result.properties && Array.isArray(result.properties)) {
          properties = result.properties
        } else if (result.data && Array.isArray(result.data)) {
          properties = result.data
        } else if (result.availableProperties && Array.isArray(result.availableProperties)) {
          properties = result.availableProperties
        } else {
          console.warn("Unexpected properties response format:", result)
          properties = []
        }

        console.log("Setting available properties:", properties)
        setAvailableProperties(properties)

        // Set default property (first configured property or first property)
        if (properties.length > 0 && !selectedPropertyId) {
          const defaultProperty = properties.find((p: AnalyticsProperty) => p.isConfigured) || properties[0]
          if (defaultProperty) {
            console.log("Setting default property:", defaultProperty)
            setSelectedPropertyId(defaultProperty.id)
          }
        }
      } else {
        console.error("Failed to load properties:", response.status, response.statusText)
      }
    } catch (err) {
      console.error("Failed to load properties:", err)
    }
  }

  // Force refresh data when needed
  const forceRefreshData = useCallback(() => {
    setIsLoading(true)
    // Create a custom event to trigger data refresh in child components
    window.dispatchEvent(
      new CustomEvent("analytics-refresh", {
        detail: {
          timestamp: Date.now(),
          propertyId: selectedPropertyId,
          dateRange: selectedDateRange,
        },
      }),
    )

    // Set a timeout to ensure loading state is visible
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }, [selectedPropertyId, selectedDateRange])

  const handleRefresh = () => {
    testConnection()
    forceRefreshData()
  }

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
    setError(null)
  }

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setError(null)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    window.location.href = "/admin"
  }

  const testConnection = async () => {
    try {      const url = selectedPropertyId
        ? `/api/analytics?endpoint=test-connection&propertyId=${selectedPropertyId}`
        : "/api/analytics?endpoint=test-connection"

      const response = await fetch(url)

      if (response.ok) {
        const status = await response.json()
        setConnectionStatus(status)
      }
    } catch (err) {
      console.error("Connection test error:", err)
      // Don't set error - just continue with zero data
    }
  }

  return (
    <div className="w-full max-w-full min-w-0 bg-neutral-50">
      {/* Analytics Header */}
      <div className="w-full max-w-full">
        <AnalyticsHeader
          isLoading={isLoading}
          availableProperties={availableProperties}
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={handlePropertyChange}
          selectedRange={selectedDateRange}
          onRangeChange={handleDateRangeChange}
          onDownloadCSV={() => {
            const selectedProperty = availableProperties.find(p => p.id === selectedPropertyId)
            downloadAnalyticsCSV(selectedDateRange, selectedPropertyId, selectedProperty?.name)
          }}
          onDownloadPNG={() => {
            const selectedProperty = availableProperties.find(p => p.id === selectedPropertyId)
            downloadAnalyticsPNG(selectedDateRange, selectedPropertyId, selectedProperty?.name)
          }}
        />
      </div>
      
      <div className="py-4 sm:py-6 w-full max-w-full">
        <div className="px-4 sm:px-5 lg:px-6 w-full max-w-full min-w-0">
          {/* Error Display */}
          {error && (
            <div className="mb-4">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-600">Error</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Status row — snapshot freshness + realtime active users.
              Tells the rep at a glance whether they're on cached or live data
              and how many people are on the site right now. */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SnapshotPill
              meta={snapshotMeta}
              useSnapshot={useSnapshot}
              onToggle={() => setDataSource(useSnapshot ? "live" : "snapshot")}
            />
            <RealtimePill propertyId={selectedPropertyId} />
          </div>

          {/* Analytics Dashboard - Always show components */}
          <>
            {/* Phase 5c — Goals/KPI panel. Renders only when goals are
                configured for this property (or portfolio-wide). Pinned at
                the very top so the BD team's eye lands on "are we hitting
                targets?" before any of the diagnostic data below. */}
            {selectedPropertyId && <GoalsKpiPanel propertyId={selectedPropertyId} />}

            {/* Phase 5a — Insights panel. Renders only when current period
                deviates >20% from trailing 3-period average on a key metric.
                First thing the eye lands on, since "what should I look at"
                is the highest-leverage question on a dashboard. Quiet by
                design — when nothing's anomalous, this whole block disappears. */}
            {selectedPropertyId && (
              <InsightsPanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                filters={filters}
              />
            )}

            {/* PR 3d filter bar — narrows audience charts (hero / what-changed /
                page-views chart / top-pages) by device, channel, country.
                Source/device/geography breakdown charts intentionally exempt. */}
            {selectedPropertyId && (
              <AnalyticsFilterBar
                filters={filters}
                onFiltersChange={setFilters}
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
              />
            )}

            {/* Hero metric — Sessions front and center with sparkline + delta,
                three secondary metrics stacked on the right. Replaces the old
                4-card equal-weight grid. (Phase 3b — Vercel pattern.) */}
            <div className="py-4 sm:py-6 relative z-10">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Key Metrics</h2>
                <InfoTooltip content="Sessions is the lead metric — overall traffic volume. Users counts unique visitors. Page Views counts every page load. Engagement Rate is GA4's primary quality signal: % of sessions where users stayed engaged for 10+ seconds, viewed multiple pages, or triggered a key event. All deltas compare to the previous period of the same length." />
              </div>
              <HeroMetric
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                filters={filters}
                setError={setError}
                onSnapshotMeta={setSnapshotMeta}
              />
            </div>

            {/* "What changed" — biggest page-level risers and fallers vs the
                previous period. (Phase 3b — Linear pattern.) Sits right under
                the hero so the team's eye lands on the most actionable signal
                before scrolling into the rest of the dashboard. */}
            <div className="mt-2 sm:mt-4 w-full max-w-full relative z-10">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">What changed</h2>
                <InfoTooltip content="Pages with the biggest week-over-week (or period-over-period) change in views. Filtered to pages with at least 20 views in either period to keep the noise out — a tiny page going from 1 to 5 views isn't a meaningful signal." />
              </div>
              <WhatChangedPanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                filters={filters}
                setError={setError}
              />
            </div>

            {/* Page Views Chart */}
            <div className="mt-2 sm:mt-4 w-full max-w-full min-w-0 relative z-10">
              <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Traffic Trend</h2>
                  <InfoTooltip content="Daily page view trends showing traffic patterns over time. Use this to identify peak traffic days and overall growth trends. Annotations let you pin context — campaign launches, redesigns, outages — directly on the chart." />
                </div>
                {/* PR 5b — annotation manager. Owns the list, exposes it via
                    onAnnotationsChange so the chart can render markers. */}
                {selectedPropertyId && (
                  <AnnotationManager
                    propertyId={selectedPropertyId}
                    onAnnotationsChange={setAnnotations}
                  />
                )}
              </div>
              <div className="w-full max-w-full">
                <PageViewsChart
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                  filters={filters}
                  annotations={annotations}
                />
              </div>
            </div>

            {/* Events & Conversions — Phase 2: surfaces server-side measurement
                protocol writes (lead_capture, lead_qualified, lead_converted,
                opportunity_won) plus any client-side custom events */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Events & Conversions
                </h2>
                <InfoTooltip content="Custom events fired from the public sites (page CTAs, form submits, video plays) and from CRM mutations server-side (lead_converted, opportunity_won). Conversion events are tagged in GA4 Admin → Events." />
              </div>
              <EventsConversionsPanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                isLoading={isLoading}
                setError={setError}
              />
            </div>

            {/* Phase 4a — Search Console organic-search performance.
                Sits next to Events because both surface intent (events =
                site-side action signals; queries = pre-arrival intent).
                Renders an empty-state when SEARCH_CONSOLE_SITE_<key> isn't set. */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Organic search
                </h2>
                <InfoTooltip content="Top queries that drove organic search clicks to this site, with impressions, CTR, and average position. Pulled from Google Search Console — different data source from GA4. Position is averaged weighted by impressions." />
              </div>
              <SearchPerformancePanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                setError={setError}
              />
            </div>

            {/* Phase 4b — Core Web Vitals via CrUX. Real-user p75 LCP / INP /
                CLS / TTFB / FCP from Chrome's anonymous usage telemetry.
                28-day rolling window — no date selector needed (CrUX ignores
                custom ranges). Renders empty state until CRUX_API_KEY is set. */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Core Web Vitals
                </h2>
                <InfoTooltip content="Real-user performance from Chrome (p75 across the last 28 days). LCP measures loading, INP measures responsiveness, CLS measures visual stability — these three are Google's official Core Web Vitals and directly affect search ranking. Green = Good, amber = Needs improvement, red = Poor." />
              </div>
              <CoreWebVitalsPanel propertyId={selectedPropertyId} setError={setError} />
            </div>

            {/* Phase 4c — Cohort retention. Weekly acquisition cohorts × weekly
                retention buckets. The triangle that tells you whether content
                creates an audience or just generates one-and-done traffic. */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Audience retention
                </h2>
                <InfoTooltip content="Each row = users whose first session fell in that week (a cohort). Each column = % of that cohort that came back N weeks later. Higher right-side numbers = stickier audience. For media businesses, week-1 retention above 20% is healthy; above 30% is excellent." />
              </div>
              <CohortRetentionPanel propertyId={selectedPropertyId} setError={setError} />
            </div>

            {/* Top Pages and Traffic Sources - Stack on mobile */}
            <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 py-8 sm:py-12 w-full max-w-full overflow-hidden">
              <div className="min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-2 mb-4 sm:mb-5">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Top Performing Pages</h2>
                  <InfoTooltip content="Your most visited pages ranked by views. This helps identify your most valuable content and where users spend their time." />
                </div>
                <TopPagesTable
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                  filters={filters}
                />
              </div>

              <div className="min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-2 mb-4 sm:mb-5">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Traffic Sources</h2>
                  <InfoTooltip content="Where your visitors are coming from. Referral traffic comes from other websites, organic is from search engines, and direct is when users type your URL directly." />
                </div>
                <TrafficSourcesChart
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                />
              </div>
            </div>

            {/* Geographic Distribution and Device Types - Stack on mobile */}
            <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 py-6 sm:py-12 w-full max-w-full overflow-hidden">
              <div className="min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-2 mb-4 sm:mb-5">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Geographic Distribution</h2>
                  <InfoTooltip content="Where your visitors are located geographically. This helps understand your audience's location and can inform regional content strategies." />
                </div>
                <GeographicMap
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                />
              </div>

              <div className="min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-2 mb-4 sm:mb-5">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Device Types</h2>
                  <InfoTooltip content="The types of devices visitors use to access your site. This helps ensure your site is optimized for the most common device types." />
                </div>
                <DeviceBreakdown
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                />
              </div>
            </div>
          </>

          {/* Footer */}
          <div className="text-center text-neutral-500 text-xs sm:text-sm pt-8 pb-6 border-t border-neutral-200 mt-8">
            <p className="leading-relaxed">
              Powered by Google Analytics 4{" "}
              <span className="hidden sm:inline">•</span>
              <span className="block sm:inline sm:ml-1">Last updated: {new Date().toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
