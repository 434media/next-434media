"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../analytics/Card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../analytics/Chart"
import type { MailchimpEngagementResponse } from "../../types/mailchimp-analytics"

interface MailchimpEngagementChartProps {
  data: MailchimpEngagementResponse
}

export function MailchimpEngagementChart({ data }: MailchimpEngagementChartProps) {
  // Transform data for chart display
  const chartData = data.data
    .slice(0, 10) // Show last 10 campaigns
    .reverse() // Show chronologically
    .map((campaign, index) => ({
      campaign: `Campaign ${index + 1}`,
      campaignTitle:
        campaign.campaignTitle.length > 20
          ? campaign.campaignTitle.substring(0, 20) + "..."
          : campaign.campaignTitle,
      opens: campaign.opens,
      clicks: campaign.clicks,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Engagement Trends</CardTitle>
        <CardDescription>Total opens and clicks for your recent campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            opens: {
              label: "Opens",
              color: "hsl(var(--chart-1))",
            },
            clicks: {
              label: "Clicks",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="campaign" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload
                  return data ? data.campaignTitle : label
                }}
              />
              <Line
                type="monotone"
                dataKey="opens"
                stroke="var(--color-opens)"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Opens"
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="var(--color-clicks)"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Clicks"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
