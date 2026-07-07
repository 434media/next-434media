"use client"

import { useEffect, useState } from "react"
import { BarChart3, CircleGauge, Mail, Flag, Filter, Timer, AlertCircle, RefreshCw } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { HowItWorks } from "@/components/admin/HowItWorks"
import type { LeadQualityKpis } from "@/lib/kpis/lead-quality"
import type { FunnelKpis } from "@/lib/kpis/funnel"
import type { ResendBenchmark } from "@/lib/kpis/email-benchmarks"

interface EmailBenchmarksResponse {
  range: { start: string; end: string } | null
  resend: ResendBenchmark
  generatedAt: string
}

type EmailWindow = "30" | "90" | "365" | "all"
const EMAIL_WINDOWS: { value: EmailWindow; label: string }[] = [
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "365", label: "12mo" },
  { value: "all", label: "All" },
]

// 0–1 fraction → "42.0%"
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function HeroMetric({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="p-4 md:p-5 rounded-lg bg-white ring-1 ring-neutral-200/70">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-2">{label}</div>
      <div className="text-2xl font-semibold text-neutral-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  )
}

// Horizontal proportion bar — count relative to a max, with an optional second
// (converted) segment overlaid for the score-distribution view.
function Bar({
  label,
  count,
  max,
  highlight,
  note,
}: {
  label: string
  count: number
  max: number
  highlight?: number
  note?: string
}) {
  const width = max > 0 ? (count / max) * 100 : 0
  const hi = highlight && count > 0 ? (highlight / count) * width : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-xs text-neutral-600 tabular-nums">{label}</div>
      <div className="flex-1 h-5 rounded bg-neutral-100 overflow-hidden relative">
        <div className="h-full bg-neutral-300" style={{ width: `${width}%` }} />
        {hi > 0 && (
          <div className="h-full bg-emerald-500 absolute top-0 left-0" style={{ width: `${hi}%` }} title="converted" />
        )}
      </div>
      <div className="w-24 shrink-0 text-xs text-neutral-700 tabular-nums text-right">
        {count}
        {note && <span className="text-neutral-400"> {note}</span>}
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof BarChart3
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-neutral-600" />
        <h2 className="text-sm font-semibold text-neutral-800 tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-5 rounded-lg bg-white ring-1 ring-neutral-200/70">{children}</div>
}

function FunnelKpisInner() {
  const [funnel, setFunnel] = useState<FunnelKpis | null>(null)
  const [quality, setQuality] = useState<LeadQualityKpis | null>(null)
  const [email, setEmail] = useState<EmailBenchmarksResponse | null>(null)
  const [emailWindow, setEmailWindow] = useState<EmailWindow>("90")
  const [emailLoading, setEmailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Funnel + lead-quality are all-time; loaded once (and on Refresh).
  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [fRes, qRes] = await Promise.all([
        fetch("/api/admin/kpis/funnel", { cache: "no-store" }),
        fetch("/api/admin/kpis/lead-quality", { cache: "no-store" }),
      ])
      if (!fRes.ok) throw new Error("Failed to load funnel KPIs")
      if (!qRes.ok) throw new Error("Failed to load lead-quality KPIs")
      setFunnel((await fRes.json()).kpis)
      setQuality((await qRes.json()).kpis)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load KPIs")
    } finally {
      setLoading(false)
    }
  }

  // Email benchmarks refetch on their own when the time window changes, so
  // changing it doesn't blank the funnel/quality sections.
  const loadEmail = async (win: EmailWindow) => {
    setEmailLoading(true)
    try {
      const eRes = await fetch(`/api/admin/kpis/email-benchmarks?days=${win}`, { cache: "no-store" })
      if (eRes.ok) setEmail(await eRes.json())
    } catch {
      // Keep the prior email data on a transient failure.
    } finally {
      setEmailLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadEmail(emailWindow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailWindow])

  const maxBand = quality ? Math.max(1, ...quality.scoreDistribution.map((b) => b.count)) : 1
  const maxReason = quality ? Math.max(1, ...quality.removedReasons.map((r) => r.count)) : 1

  const leadReached = funnel && funnel.stages.length > 0 ? funnel.stages[0].reached : 0
  const stageReached = (stage: string) => funnel?.stages.find((s) => s.stage === stage)?.reached ?? 0
  const oppRate = leadReached > 0 ? stageReached("discovery") / leadReached : 0
  const wonRate = leadReached > 0 ? stageReached("closed_won") / leadReached : 0

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-neutral-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleGauge className="w-4 h-4 text-neutral-600" />
            <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">Funnel KPIs</h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-1 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full">
              funnel · lead quality · email
            </span>
          </div>
          <button
            onClick={() => {
              load()
              loadEmail(emailWindow)
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-md disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
        <HowItWorks
          storageKey="funnelKpisIntroDismissed"
          steps={[
            { title: "Funnel", detail: "Where leads drop off (Lead→MQL→SQL→Discovery→Proposal→Closed-Won), ICP match rate, and how fast they move." },
            { title: "Lead quality", detail: "Score distribution, kept vs removed (and why), and which sources convert." },
            { title: "Email benchmarks", detail: "Resend 1:1 outreach engagement — sent, opens, clicks, rates." },
            { title: "Your scoreboard", detail: "Numbers come from Leads + the email tools; read here, act in Leads." },
          ]}
        />

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {loading && !quality && (
          <div className="text-neutral-500 py-16 text-center">Loading KPIs…</div>
        )}

        {/* ===== Funnel conversion & velocity ===== */}
        {funnel && (
          <Section title="Funnel conversion & velocity" icon={Filter}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <HeroMetric
                label="ICP match rate"
                value={pct(funnel.icpMatchRate)}
                sub={`score ≥ ${funnel.threshold}`}
              />
              <HeroMetric label="Total leads" value={String(funnel.total)} />
              <HeroMetric label="Reach opportunity" value={pct(oppRate)} sub="lead → discovery" />
              <HeroMetric label="Closed-won" value={pct(wonRate)} sub="lead → closed-won" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Stage conversion */}
              <Card>
                <div className="text-xs font-medium text-neutral-600 mb-3">
                  Stage conversion
                  <span className="text-neutral-400"> — % converts into each stage</span>
                </div>
                <div className="space-y-2">
                  {funnel.stages.map((s, i) => {
                    const conv = i > 0 ? funnel.conversions[i - 1] : null
                    const width = leadReached > 0 ? (s.reached / leadReached) * 100 : 0
                    return (
                      <div key={s.stage} className="flex items-center gap-3">
                        <div className="w-20 shrink-0 text-xs text-neutral-600">{s.label}</div>
                        <div className="flex-1 h-5 rounded bg-neutral-100 overflow-hidden">
                          <div className="h-full bg-neutral-300" style={{ width: `${width}%` }} />
                        </div>
                        <div
                          className="w-28 shrink-0 text-xs text-neutral-700 tabular-nums text-right"
                          title={s.exited > 0 ? `${s.exited} exited here` : undefined}
                        >
                          {s.reached}
                          {conv && <span className="text-neutral-400"> · {pct(conv.rate)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Velocity */}
              <Card>
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 mb-3">
                  <Timer className="w-3.5 h-3.5" /> Velocity
                  <span className="text-neutral-400"> — median days, p90 in parens</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-100">
                      <th className="py-2 pr-4 font-medium">Step</th>
                      <th className="py-2 px-3 font-medium text-right">Median</th>
                      <th className="py-2 px-3 font-medium text-right">p90</th>
                      <th className="py-2 pl-3 font-medium text-right">n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.velocity.map((v) => (
                      <tr key={v.step} className="border-b border-neutral-50 last:border-0">
                        <td className="py-2 pr-4 text-neutral-700">{v.step}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-900 font-medium">
                          {v.sampleSize > 0 ? `${v.medianDays}d` : "—"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-500">
                          {v.sampleSize > 0 ? `${v.p90Days}d` : "—"}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums text-neutral-400">{v.sampleSize}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            {/* ICP match by source */}
            <Card>
              <div className="text-xs font-medium text-neutral-600 mb-3">
                ICP match by source
                <span className="text-neutral-400"> — share of leads scoring ≥ {funnel.threshold}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-100">
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 px-3 font-medium text-right">Leads</th>
                      <th className="py-2 px-3 font-medium text-right">Matched</th>
                      <th className="py-2 pl-3 font-medium text-right">Match rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.icpMatchBySource.map((s) => (
                      <tr key={s.source} className="border-b border-neutral-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-neutral-700 capitalize">{s.source}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-600">{s.total}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-600">{s.matched}</td>
                        <td className="py-2 pl-3 text-right tabular-nums text-neutral-900 font-medium">
                          {pct(s.matchRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>
        )}

        {/* ===== Lead Quality ===== */}
        {quality && (
          <Section title="Lead quality" icon={Flag}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <HeroMetric label="Total leads" value={String(quality.total)} />
              <HeroMetric
                label="Kept"
                value={pct(quality.keptRate)}
                sub={`${quality.kept} kept · ${quality.removed} removed`}
              />
              <HeroMetric label="Avg score" value={String(quality.avgScore)} sub="0–100" />
              <HeroMetric
                label="Conversion"
                value={pct(quality.conversionRate)}
                sub={`${quality.converted} converted`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Score distribution */}
              <Card>
                <div className="text-xs font-medium text-neutral-600 mb-3">
                  Score distribution
                  <span className="text-neutral-400"> — green = converted</span>
                </div>
                <div className="space-y-2">
                  {quality.scoreDistribution.map((b) => (
                    <Bar
                      key={b.label}
                      label={b.label}
                      count={b.count}
                      max={maxBand}
                      highlight={b.converted}
                      note={b.converted > 0 ? `(${b.converted}✓)` : undefined}
                    />
                  ))}
                </div>
              </Card>

              {/* Removed reasons */}
              <Card>
                <div className="text-xs font-medium text-neutral-600 mb-3">
                  Why leads were removed
                  <span className="text-neutral-400"> — {quality.removed} archived</span>
                </div>
                {quality.removedReasons.length === 0 ? (
                  <div className="text-sm text-neutral-400 py-6 text-center">No removed leads yet.</div>
                ) : (
                  <div className="space-y-2.5">
                    {quality.removedReasons.map((r) => (
                      <div key={r.reason}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-neutral-700">{r.label}</span>
                          <span className="text-neutral-500 tabular-nums">{r.count}</span>
                        </div>
                        <div className="h-2 rounded bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full bg-neutral-400"
                            style={{ width: `${maxReason > 0 ? (r.count / maxReason) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* By source */}
            <Card>
              <div className="text-xs font-medium text-neutral-600 mb-3">Performance by source</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-100">
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                      <th className="py-2 px-3 font-medium text-right">Kept</th>
                      <th className="py-2 px-3 font-medium text-right">Removed</th>
                      <th className="py-2 px-3 font-medium text-right">Converted</th>
                      <th className="py-2 pl-3 font-medium text-right">Avg score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quality.bySource.map((s) => (
                      <tr key={s.source} className="border-b border-neutral-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-neutral-700 capitalize">{s.source}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-600">{s.total}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-600">{s.kept}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-neutral-600">{s.removed}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-600">{s.converted}</td>
                        <td className="py-2 pl-3 text-right tabular-nums text-neutral-900 font-medium">{s.avgScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>
        )}

        {/* ===== Email Benchmarks ===== */}
        {email && (
          <Section title="Email benchmarks" icon={Mail}>
            {/* Resend 1:1 outreach — our email source of truth (API + webhooks). */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-medium text-neutral-600">
                <Mail className="w-3.5 h-3.5" /> Resend — 1:1 outreach
                <span className="inline-flex items-center rounded-md border border-neutral-200 overflow-hidden">
                  {EMAIL_WINDOWS.map((w) => (
                    <button
                      key={w.value}
                      onClick={() => setEmailWindow(w.value)}
                      className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        emailWindow === w.value
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </span>
                <span className="text-neutral-400 inline-flex items-center gap-1">
                  {email.range ? `(${email.range.start} → ${email.range.end})` : "(all time)"}
                  {emailLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
                <HeroMetric label="Sent" value={email.resend.sent.toLocaleString()} />
                <HeroMetric label="Opens" value={email.resend.opens.toLocaleString()} />
                <HeroMetric label="Clicks" value={email.resend.clicks.toLocaleString()} />
                <HeroMetric label="Replies" value={email.resend.replies.toLocaleString()} />
                <HeroMetric label="Open rate" value={pct(email.resend.openRate)} />
                <HeroMetric label="Click rate" value={pct(email.resend.clickRate)} />
                <HeroMetric label="Reply rate" value={pct(email.resend.replyRate)} />
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// Visible to operators AND interns — this is the Analytics squad's home, the
// deliberate counterpart to the full_admin-only web/social Analytics page.
export default function FunnelKpisPage() {
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <FunnelKpisInner />
    </AdminRoleGuard>
  )
}
