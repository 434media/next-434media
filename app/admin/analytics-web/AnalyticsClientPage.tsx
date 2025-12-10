"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardHeader } from "../../components/analytics/DashboardHeader"
import { DateRangeSelector } from "../../components/analytics/DateRangeSelector"
import { MetricsOverview } from "../../components/analytics/MetricsOverview"
import { PageViewsChart } from "../../components/analytics/PageViewsChart"
import { TopPagesTable } from "../../components/analytics/TopPagesTable"
import { TrafficSourcesChart } from "../../components/analytics/TrafficSourcesChart"
import { DeviceBreakdown } from "../../components/analytics/DeviceBreakdown"
import { GeographicMap } from "../../components/analytics/GeographicMap"
import { InfoTooltip } from "../../components/analytics/InfoTooltip"
import type { DateRange, AnalyticsConnectionStatus, AnalyticsProperty } from "../../types/analytics"

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
    <div className="min-h-screen bg-black pt-24 md:pt-20">
      <div className="pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <DashboardHeader
            onRefresh={handleRefresh}
            onLogout={handleLogout}
            isLoading={isLoading}
            availableProperties={availableProperties}
            selectedPropertyId={selectedPropertyId}
            onPropertyChange={handlePropertyChange}
          />

          {/* Date Range Selector */}
          <div className="mb-8">
            <DateRangeSelector selectedRange={selectedDateRange} onRangeChange={handleDateRangeChange} />
          </div>

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
