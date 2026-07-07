import type { Lead } from "@/types/crm-types"
import type { MailchimpCampaignPerformanceData } from "@/types/mailchimp-analytics"

// Email-benchmark KPIs for the Funnel KPI surface. Two channels:
//  - Mailchimp bulk ("drop campaign") — performance per campaign, fetched live.
//  - Resend 1:1 outreach — engagement aggregated from the leads collection
//    (resend_email_id marks a lead that was sent; counters are bumped by the
//    Resend webhook). See app/api/webhooks/resend.

export interface MailchimpBenchmark {
  campaigns: MailchimpCampaignPerformanceData[]
  totalSent: number
  totalOpens: number
  totalClicks: number
  totalBounces: number
  totalUnsubscribes: number
  /** Sent-weighted average of per-campaign open rate, 0–1. */
  avgOpenRate: number
  /** Sent-weighted average of per-campaign click rate, 0–1. */
  avgClickRate: number
  /** totalBounces / totalSent, 0–1. */
  bounceRate: number
  /** totalUnsubscribes / totalSent, 0–1. */
  unsubscribeRate: number
}

export interface ResendBenchmark {
  /** Leads that received a 1:1 outreach (have a resend_email_id). */
  sent: number
  opens: number
  clicks: number
  /** Sent leads with at least one captured reply (reply_received activity). */
  replies: number
  /** opens / sent, 0–1 (raw open events, can exceed 1 in theory). */
  openRate: number
  /** clicks / sent, 0–1. */
  clickRate: number
  /** replies / sent, 0–1 — distinct recipients who replied. */
  replyRate: number
}

function round(n: number, places = 3): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function summarizeMailchimpCampaigns(
  campaigns: MailchimpCampaignPerformanceData[],
): MailchimpBenchmark {
  const totalSent = campaigns.reduce((s, c) => s + c.emailsSent, 0)
  const totalOpens = campaigns.reduce((s, c) => s + c.opens, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const totalBounces = campaigns.reduce((s, c) => s + c.bounces, 0)
  const totalUnsubscribes = campaigns.reduce((s, c) => s + c.unsubscribes, 0)

  // Sent-weighted rate averages so a tiny test send doesn't swing the benchmark.
  const weightedOpen = campaigns.reduce((s, c) => s + c.openRate * c.emailsSent, 0)
  const weightedClick = campaigns.reduce((s, c) => s + c.clickRate * c.emailsSent, 0)

  return {
    campaigns,
    totalSent,
    totalOpens,
    totalClicks,
    totalBounces,
    totalUnsubscribes,
    avgOpenRate: totalSent > 0 ? round(weightedOpen / totalSent) : 0,
    avgClickRate: totalSent > 0 ? round(weightedClick / totalSent) : 0,
    bounceRate: totalSent > 0 ? round(totalBounces / totalSent) : 0,
    unsubscribeRate: totalSent > 0 ? round(totalUnsubscribes / totalSent) : 0,
  }
}

export function summarizeResendOutreach(
  leads: Lead[],
  range?: { start: string; end: string },
): ResendBenchmark {
  // A lead's 1:1 outreach send time is last_contacted_at (set alongside
  // resend_email_id at send). When a range is given, window by that; otherwise
  // count all-time. A sent lead missing the timestamp can't be placed in a
  // window, so it's excluded from a windowed count (but included all-time).
  const startMs = range ? new Date(`${range.start}T00:00:00.000Z`).getTime() : 0
  const endMs = range ? new Date(`${range.end}T23:59:59.999Z`).getTime() : 0
  const inWindow = (l: Lead): boolean => {
    if (!range) return true
    if (!l.last_contacted_at) return false
    const t = new Date(l.last_contacted_at).getTime()
    return t >= startMs && t <= endMs
  }

  const sentLeads = leads.filter((l) => !!l.resend_email_id && inWindow(l))
  const sent = sentLeads.length
  const opens = sentLeads.reduce((s, l) => s + (l.email_opens || 0), 0)
  const clicks = sentLeads.reduce((s, l) => s + (l.email_clicks || 0), 0)
  // Replies are captured as reply_received activity events (inbound webhook),
  // not a counter — count distinct sent leads that got at least one.
  const replies = sentLeads.filter((l) =>
    (l.activity ?? []).some((e) => e.type === "reply_received"),
  ).length
  return {
    sent,
    opens,
    clicks,
    replies,
    openRate: sent > 0 ? round(opens / sent) : 0,
    clickRate: sent > 0 ? round(clicks / sent) : 0,
    replyRate: sent > 0 ? round(replies / sent) : 0,
  }
}
