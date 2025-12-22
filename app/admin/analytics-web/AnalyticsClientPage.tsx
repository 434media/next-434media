"use client"

import { useState, useEffect, useCallback } from "react"
import { AnalyticsHeader } from "../../components/analytics/AnalyticsHeader"
import { MetricsOverview } from "../../components/analytics/MetricsOverview"
import { PageViewsChart } from "../../components/analytics/PageViewsChart"
import { TopPagesTable } from "../../components/analytics/TopPagesTable"
import { TrafficSourcesChart } from "../../components/analytics/TrafficSourcesChart"
import { DeviceBreakdown } from "../../components/analytics/DeviceBreakdown"
import { GeographicMap } from "../../components/analytics/GeographicMap"
import { InfoTooltip } from "../../components/analytics/InfoTooltip"
import type { DateRange, AnalyticsConnectionStatus, AnalyticsProperty } from "../../types/analytics"

// Download analytics summary as CSV
async function downloadAnalyticsCSV(dateRange: DateRange, propertyId?: string, propertyName?: string) {
  try {
    const response = await fetch(`/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch analytics data')
    }
    
    const data = await response.json()
    
    // Determine property ID and name
    const displayPropertyId = propertyId || data.propertyId || '488543948'
    const displayPropertyName = propertyName || PROPERTY_NAMES[displayPropertyId] || '434 MEDIA'
    
    // Format the date for filename
    const today = new Date().toISOString().split('T')[0]
    const labelSlug = (dateRange.label || 'custom').replace(/\s+/g, '-').toLowerCase()
    const propertySlug = displayPropertyName.replace(/\s+/g, '-').toLowerCase()
    const filename = `${propertySlug}-analytics-${labelSlug}-${today}.csv`
    
    // Create CSV content
    let csvContent = `${displayPropertyName} Analytics Report\n`
    csvContent += `Property ID: ${displayPropertyId}\n`
    csvContent += `Date Range: ${dateRange.label || 'Custom'}\n`
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`
    csvContent += "Metric,Value\n"
    
    if (data.metrics) {
      Object.entries(data.metrics).forEach(([key, value]) => {
        csvContent += `${key},${value}\n`
      })
    } else if (data) {
      // Fallback for different response structures
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value !== 'object') {
          csvContent += `${key},${value}\n`
        }
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

// Metrics to exclude from PNG export
const EXCLUDED_METRICS = ['pageViewsChange', 'sessionsChange', 'usersChange', 'bounceRateChange', '_source', 'source', 'propertyId']

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
    // Fetch analytics data and top pages in parallel
    const [summaryResponse, pagesResponse] = await Promise.all([
      fetch(`/api/analytics?endpoint=summary&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`),
      fetch(`/api/analytics?endpoint=top-pages&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ''}`)
    ])
    
    if (!summaryResponse.ok) {
      throw new Error('Failed to fetch analytics data')
    }
    
    const data = await summaryResponse.json()
    const pagesData = pagesResponse.ok ? await pagesResponse.json() : { data: [] }
    const topPages = pagesData.data?.slice(0, 5) || []
    
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
    
    // Set canvas size (taller to accommodate top pages)
    canvas.width = 1200
    canvas.height = topPages.length > 0 ? 950 : 800
    
    // Draw background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw gradient accent bar at top
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
    gradient.addColorStop(0, '#3b82f6')
    gradient.addColorStop(1, '#8b5cf6')
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
    }
    
    // Draw footer
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Powered by Google Analytics 4 • 434 Media', canvas.width / 2, canvas.height - 40)
    
    // Draw decorative gradient line at bottom
    const bottomGradient = ctx.createLinearGradient(0, canvas.height - 6, canvas.width, canvas.height - 6)
    bottomGradient.addColorStop(0, '#3b82f6')
    bottomGradient.addColorStop(1, '#8b5cf6')
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

export default function AnalyticsClientPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({
    startDate: "30daysAgo",
    endDate: "today",
    label: "Last 30 days",
  })
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("")
  const [availableProperties, setAvailableProperties] = useState<AnalyticsProperty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<AnalyticsConnectionStatus | null>(null)

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
    <div className="min-h-screen bg-black pt-[56px] md:pt-[64px]">
      {/* Unified Sticky Analytics Header */}
      <div className="sticky top-[56px] md:top-[64px] z-40">
        <AnalyticsHeader
          onRefresh={handleRefresh}
          onLogout={handleLogout}
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
      
      <div className="py-6">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Connection Status - Only show if connected */}
          {connectionStatus?.success && (
            <div className="mb-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Google Analytics Connected</p>
                    <p className="text-xs text-white/50 mt-1">
                      Property: {connectionStatus.propertyId} | Dimensions: {connectionStatus.dimensionCount} | Metrics:{" "}
                      {connectionStatus.metricCount}
                    </p>
                  </div>
                  <button
                    onClick={testConnection}
                    disabled={isLoading}
                    className="text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
                  >
                    {isLoading ? "Testing..." : "Test Connection"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-xs text-white/60 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md transition-colors mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Analytics Dashboard - Always show components */}
          <>
            {/* Metrics Overview */}
            <div className="mb-10 md:mb-12">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Key Metrics</h2>
                <InfoTooltip content="High-level overview of your website's performance. Users are unique visitors, Sessions are visits, Page Views are total pages loaded, and Bounce Rate is the percentage of single-page visits." />
              </div>
              <MetricsOverview
                dateRange={selectedDateRange}
                isLoading={isLoading}
                setError={setError}
                propertyId={selectedPropertyId}
              />
            </div>

            {/* Page Views Chart */}
            <div className="mb-10 md:mb-12">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Traffic Trend</h2>
                <InfoTooltip content="Daily page view trends showing traffic patterns over time. Use this to identify peak traffic days and overall growth trends." />
              </div>
              <PageViewsChart
                dateRange={selectedDateRange}
                isLoading={isLoading}
                setError={setError}
                propertyId={selectedPropertyId}
              />
            </div>

            {/* Top Pages and Traffic Sources - Side by Side on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-10 md:mb-12">
              <div>
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Top Performing Pages</h2>
                  <InfoTooltip content="Your most visited pages ranked by views. This helps identify your most valuable content and where users spend their time." />
                </div>
                <TopPagesTable
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                />
              </div>

              <div>
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Traffic Sources</h2>
                  <InfoTooltip content="Where your visitors are coming from. Referral traffic comes from other websites, organic is from search engines, and direct is when users type your URL directly." />
                </div>
                <TrafficSourcesChart
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                />
              </div>
            </div>

            {/* Geographic Distribution and Device Types - Side by Side on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-10 md:mb-12 pb-8">
              <div>
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Geographic Distribution</h2>
                  <InfoTooltip content="Where your visitors are located geographically. This helps understand your audience's location and can inform regional content strategies." />
                </div>
                <GeographicMap
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                />
              </div>

              <div>
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Device Types</h2>
                  <InfoTooltip content="The types of devices visitors use to access your site. This helps ensure your site is optimized for the most common device types." />
                </div>
                <DeviceBreakdown
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                />
              </div>
            </div>
          </>

          {/* Footer */}
          <div className="text-center text-white/40 text-sm pt-8 pb-4">
            <p>
              Powered by Google Analytics 4 <span className="hidden md:inline">•</span>{" "}
              <span className="block md:inline">Last updated: {new Date().toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
