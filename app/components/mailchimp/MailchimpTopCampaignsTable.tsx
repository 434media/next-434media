"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../analytics/Card"
import { Badge } from "../analytics/Badge"
import { Button } from "../analytics/Button"
import { ExternalLink } from "lucide-react"
import type { MailchimpCampaignsResponse } from "../../types/mailchimp-analytics"

interface MailchimpTopCampaignsTableProps {
  data: MailchimpCampaignsResponse
}

export function MailchimpTopCampaignsTable({ data }: MailchimpTopCampaignsTableProps) {
  const campaigns = data.data.slice(0, 10) // Show top 10 campaigns

  const getPerformanceBadge = (openRate: number) => {
    if (openRate >= 25) return <Badge variant="default">Excellent</Badge>
    if (openRate >= 20) return <Badge variant="secondary">Good</Badge>
    if (openRate >= 15) return <Badge variant="outline">Average</Badge>
    return <Badge variant="destructive">Poor</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Campaigns</CardTitle>
        <CardDescription>Performance overview of your recent email campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Campaign</th>
                <th className="text-left py-2 px-4">Send Date</th>
                <th className="text-left py-2 px-4">Recipients</th>
                <th className="text-left py-2 px-4">Opens</th>
                <th className="text-left py-2 px-4">Clicks</th>
                <th className="text-left py-2 px-4">Open Rate</th>
                <th className="text-left py-2 px-4">Click Rate</th>
                <th className="text-left py-2 px-4">Performance</th>
                <th className="text-left py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium">{campaign.settings.title}</div>
                      <div className="text-sm text-muted-foreground">{campaign.settings.subject_line}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{new Date(campaign.send_time).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-sm">{campaign.recipients.recipient_count.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm">{campaign.report_summary.opens.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm">{campaign.report_summary.clicks.toLocaleString()}</td>
                  <td className="py-3 px-4 text-sm font-medium">
                    {(campaign.report_summary.open_rate * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-sm font-medium">
                    {(campaign.report_summary.click_rate * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-4">{getPerformanceBadge(campaign.report_summary.open_rate * 100)}</td>
                  <td className="py-3 px-4">
                    <Button variant="ghost" size="sm" onClick={() => window.open(campaign.archive_url, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {campaigns.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No campaigns found for the selected date range.</div>
        )}
      </CardContent>
    </Card>
  )
}
