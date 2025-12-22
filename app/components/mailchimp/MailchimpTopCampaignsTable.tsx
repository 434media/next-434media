"use client"

import { useMemo } from "react"
import { ExternalLink, Mail, MousePointer, Eye, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react"
import type { MailchimpCampaignsResponse } from "../../types/mailchimp-analytics"

interface MailchimpTopCampaignsTableProps {
  data: MailchimpCampaignsResponse
}

export function MailchimpTopCampaignsTable({ data }: MailchimpTopCampaignsTableProps) {
  // Sort campaigns by send_time descending (latest first) and take top 15
  const campaigns = useMemo(() => {
    return [...data.data]
      .sort((a, b) => new Date(b.send_time).getTime() - new Date(a.send_time).getTime())
      .slice(0, 15)
  }, [data.data])

  const getPerformanceIndicator = (openRate: number) => {
    if (openRate >= 25) return { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/20", label: "Excellent" }
    if (openRate >= 20) return { icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Good" }
    if (openRate >= 15) return { icon: Minus, color: "text-amber-400", bg: "bg-amber-500/20", label: "Average" }
    return { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/20", label: "Poor" }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toLocaleString()
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden w-full max-w-full">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-yellow-400" />
            <h3 className="text-base font-semibold text-white">Recent Campaigns</h3>
          </div>
          <span className="text-xs text-white/50">{campaigns.length} campaigns</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5">
              <th className="text-left py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide">Campaign</th>
              <th className="text-left py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide whitespace-nowrap">Sent</th>
              <th className="text-right py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide">Sent</th>
              <th className="text-right py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide">Opens</th>
              <th className="text-right py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide">Clicks</th>
              <th className="text-right py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide whitespace-nowrap">Open %</th>
              <th className="text-right py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide whitespace-nowrap">Click %</th>
              <th className="text-center py-2 px-3 font-medium text-white/60 text-xs uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {campaigns.map((campaign, index) => {
              const openRate = campaign.report_summary.open_rate * 100
              const clickRate = campaign.report_summary.click_rate * 100
              const perf = getPerformanceIndicator(openRate)
              const PerfIcon = perf.icon

              return (
                <tr 
                  key={campaign.id} 
                  className="hover:bg-white/5 transition-colors group"
                >
                  {/* Campaign Info */}
                  <td className="py-2.5 px-3 max-w-[280px]">
                    <div className="flex items-start gap-2">
                      <div className={`shrink-0 mt-0.5 p-1 rounded ${perf.bg}`}>
                        <PerfIcon className={`h-3 w-3 ${perf.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate text-[13px] leading-tight">
                          {campaign.settings.title || campaign.settings.subject_line}
                        </p>
                        {campaign.settings.title && campaign.settings.subject_line && (
                          <p className="text-white/50 truncate text-xs mt-0.5">
                            {campaign.settings.subject_line}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-white/60 text-xs tabular-nums">
                      {formatDate(campaign.send_time)}
                    </span>
                  </td>

                  {/* Sent Count */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-white tabular-nums text-xs">
                      {formatNumber(campaign.recipients.recipient_count)}
                    </span>
                  </td>

                  {/* Opens */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-white tabular-nums text-xs">
                      {formatNumber(campaign.report_summary.opens)}
                    </span>
                  </td>

                  {/* Clicks */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-white tabular-nums text-xs">
                      {formatNumber(campaign.report_summary.clicks)}
                    </span>
                  </td>

                  {/* Open Rate */}
                  <td className="py-2.5 px-3 text-right">
                    <span className={`font-medium tabular-nums text-xs ${openRate >= 20 ? 'text-green-400' : openRate >= 15 ? 'text-amber-400' : 'text-white'}`}>
                      {openRate.toFixed(1)}%
                    </span>
                  </td>

                  {/* Click Rate */}
                  <td className="py-2.5 px-3 text-right">
                    <span className={`font-medium tabular-nums text-xs ${clickRate >= 3 ? 'text-green-400' : clickRate >= 2 ? 'text-amber-400' : 'text-white'}`}>
                      {clickRate.toFixed(1)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => window.open(campaign.archive_url, "_blank")}
                      className="p-1.5 rounded-md text-white/40 hover:text-yellow-400 hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="View campaign archive"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {campaigns.length === 0 && (
        <div className="text-center py-12">
          <Mail className="h-8 w-8 text-white/30 mx-auto mb-3" />
          <p className="text-sm text-white/50">No campaigns found for the selected date range.</p>
        </div>
      )}

      {/* Footer */}
      {campaigns.length > 0 && data.totalCampaigns > 15 && (
        <div className="border-t border-white/10 px-4 py-2 bg-white/5">
          <p className="text-xs text-white/50 text-center">
            Showing {campaigns.length} of {data.totalCampaigns} campaigns
          </p>
        </div>
      )}
    </div>
  )
}
