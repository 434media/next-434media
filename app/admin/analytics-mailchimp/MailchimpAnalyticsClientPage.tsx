"use client"

import { useState, useEffect } from "react"
import { MailchimpDashboardHeader } from "../../components/mailchimp/MailchimpDashboardHeader"
import { PDFExportButton } from "../../components/analytics/PDFExportButton"
import { MailchimpMetricsOverview } from "../../components/mailchimp/MailchimpMetricsOverview"
import { MailchimpTopCampaignsTable } from "../../components/mailchimp/MailchimpTopCampaignsTable"
import { MailchimpDateRangeSelector } from "../../components/mailchimp/MailchimpDateRangeSelector"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import { useToast } from "../../hooks/use-toast"
import type {
  MailchimpAnalyticsSummary,
  MailchimpCampaignPerformanceResponse,
  MailchimpSubscriberGrowthResponse,
  MailchimpEngagementResponse,
  MailchimpGeographicResponse,
  MailchimpListsResponse,
  MailchimpCampaignsResponse,
  MailchimpRealtimeData,
} from "../../types/mailchimp-analytics"

interface MailchimpAnalyticsData {
  summary?: MailchimpAnalyticsSummary
  campaigns?: MailchimpCampaignPerformanceResponse
  subscribers?: MailchimpSubscriberGrowthResponse
  engagement?: MailchimpEngagementResponse
  geographic?: MailchimpGeographicResponse
  lists?: MailchimpListsResponse
  allCampaigns?: MailchimpCampaignsResponse
  realtime?: MailchimpRealtimeData
}

export default function MailchimpAnalyticsClientPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<MailchimpAnalyticsData>({})
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days ago
    endDate: new Date().toISOString().split("T")[0], // today
  })
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>("")
  const [configStatus, setConfigStatus] = useState<any>(null)
  const { toast } = useToast()

  // Check configuration on component mount
  useEffect(() => {
    fetchConfig()
  }, [])

  // Fetch data when date range changes
  useEffect(() => {
    fetchAllData()
  }, [dateRange, selectedAudienceId])

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/mailchimp/config-check")
      const result = await response.json()
      setConfigStatus(result)

      if (!result.configured) {
        toast({
          title: "Configuration Required",
          description: "Mailchimp API credentials are not properly configured.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch configuration:", error)
      toast({
        title: "Configuration Error",
        description: "Failed to check Mailchimp configuration.",
        variant: "destructive",
      })
    }
  }

  const fetchData = async (endpoint: string, requiresDateRange = true) => {
    const params = new URLSearchParams({ endpoint })

    if (requiresDateRange) {
      params.append("startDate", dateRange.startDate)
      params.append("endDate", dateRange.endDate)
    }

    if (selectedAudienceId && selectedAudienceId !== "all") {
      params.append("audienceId", selectedAudienceId)
    }

    const response = await fetch(`/api/mailchimp?${params}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || `Failed to fetch ${endpoint} data`)
    }

    return result.data
  }

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [summary, campaigns, subscribers, engagement, geographic, lists, allCampaigns, realtime] =
        await Promise.all([
          fetchData("summary"),
          fetchData("campaigns"),
          fetchData("subscribers"),
          fetchData("engagement"),
          fetchData("geographic", false),
          fetchData("lists", false),
          fetchData("all-campaigns"),
          fetchData("realtime", false),
        ])

      setData({
        summary,
        campaigns,
        subscribers,
        engagement,
        geographic,
        lists,
        allCampaigns,
        realtime,
      })

      toast({
        title: "Data Updated",
        description: "Mailchimp analytics data has been refreshed successfully.",
      })
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Data Fetch Error",
        description: error instanceof Error ? error.message : "Failed to fetch analytics data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateRangeChange = (newRange: { startDate: string; endDate: string }) => {
    setDateRange(newRange)
  }

  const handleAudienceChange = (audienceId: string) => {
    setSelectedAudienceId(audienceId)
  }

  if (!configStatus?.configured) {
    return (
      <div className="container mx-auto px-4 py-8 pt-32 md:pt-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Mailchimp Configuration Required
              <Badge variant="destructive">Not Configured</Badge>
            </CardTitle>
            <CardDescription>
              Mailchimp API credentials need to be configured before accessing analytics data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Missing Configuration:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {configStatus?.validation?.missingVariables?.map((variable: string) => (
                    <li key={variable}>{variable}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Required Environment Variables:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>MAILCHIMP_API_KEY</li>
                  <li>MAILCHIMP_AUDIENCE_ID_434MEDIA (or MAILCHIMP_AUDIENCE_ID_TXMX)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div id="analytics-root" className="container mx-auto px-4 py-8 space-y-8 pt-32 md:pt-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <MailchimpDashboardHeader
          isLoading={isLoading}
          onRefresh={fetchAllData}
          selectedAudienceId={selectedAudienceId}
          onAudienceChange={handleAudienceChange}
          availableAudiences={data.lists?.data || []}
        />
        <div className="flex items-start justify-end">
          <PDFExportButton filename={`mailchimp-analytics-${new Date().toISOString().slice(0,10)}.pdf`} contextLabel="Mailchimp Analytics" variant="full" />
        </div>
      </div>

      <MailchimpDateRangeSelector dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />

      {data.summary && (
        <MailchimpMetricsOverview
          data={data.summary}
          campaignData={data.allCampaigns?.data || []}
          geographicData={data.geographic?.data || []}
          allAudiences={data.lists?.data || []}
          selectedAudienceId={selectedAudienceId}
        />
      )}

      {data.allCampaigns && <MailchimpTopCampaignsTable data={data.allCampaigns} />}
    </div>
  )
}
