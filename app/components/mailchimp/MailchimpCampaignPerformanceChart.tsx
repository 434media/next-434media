"use client"

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../analytics/Card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../analytics/Chart"
import type { MailchimpCampaignPerformanceResponse } from "../../types/mailchimp-analytics"

interface MailchimpCampaignPerformanceChartProps {
  data: MailchimpCampaignPerformanceResponse
}

export function MailchimpCampaignPerformanceChart({ data }: MailchimpCampaignPerformanceChartProps) {
  // Group data by date and aggregate metrics
  const chartData = data.data.reduce((acc, campaign) => {
    const existingDate = acc.find((item) => item.date === campaign.date)

    if (existingDate) {
      existingDate.emailsSent += campaign.emailsSent
      existingDate.opens += campaign.opens
      existingDate.clicks += campaign.clicks
    } else {
      acc.push({
        date: campaign.date,
        emailsSent: campaign.emailsSent,
        opens: campaign.opens,
        clicks: campaign.clicks,
        formattedDate: new Date(campaign.date).toLocaleDateString(),
      })
    }

    return acc
  }, [] as any[])

  // Sort by date
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Performance Over Time</CardTitle>
        <CardDescription>Email sends, opens, and clicks by date</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            emailsSent: {
              label: "Emails Sent",
              color: "hsl(var(--chart-1))",
            },
            opens: {
              label: "Opens",
              color: "hsl(var(--chart-2))",
            },
            clicks: {
              label: "Clicks",
              color: "hsl(var(--chart-3))",
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="emailsSent" fill="var(--color-emailsSent)" name="Emails Sent" />
              <Bar dataKey="opens" fill="var(--color-opens)" name="Opens" />
              <Bar dataKey="clicks" fill="var(--color-clicks)" name="Clicks" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
