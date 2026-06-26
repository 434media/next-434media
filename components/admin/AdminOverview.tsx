"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Megaphone,
  Inbox,
  Flag,
  Rocket,
  Target,
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  BarChart3,
  Layers,
  ClipboardList,
  FileText,
  CircleGauge,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Lead } from "@/types/crm-types"
import type { FunnelKpis } from "@/lib/kpis/funnel"

// 0–1 fraction → "42%"
function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

interface SessionUser {
  email?: string
  name?: string
  role?: string
}

// Same fallback list as lib/auth.ts / AdminSidebar — keeps the funnel's
// role-aware rendering correct before any session role rehydration runs.
const SUPER_ADMIN_EMAILS = ["marcos@434media.com", "jesse@434media.com"]

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

interface OverviewCounts {
  audiencesTotal: number
  audiences7d: number
  inboxAwaiting: number
  inboxTotal: number
  leadsActive: number
  leadsPriority: number
  prospected7d: number
  clientsTotal: number
  clientsActive: number
}

function countRecent(isoTimestamps: string[], now: number): number {
  let n = 0
  for (const iso of isoTimestamps) {
    const t = Date.parse(iso)
    if (Number.isFinite(t) && now - t <= WEEK_MS) n++
  }
  return n
}

async function jget(url: string, now: number): Promise<unknown> {
  const res = await fetch(`${url}?_t=${now}`, { cache: "no-store" })
  return res.json()
}

export function AdminOverview() {
  // All admin roles can see the overview — it's the shared home. We only read
  // `user` to decide which funnel stages to surface (crm_only can't reach
  // Audiences/Inbox, so we hide those entry points for them).
  // undefined = session not resolved yet; null = resolved, no user.
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)
  const [counts, setCounts] = useState<OverviewCounts | null>(null)
  const [funnelKpis, setFunnelKpis] = useState<FunnelKpis | null>(null)
  const [loading, setLoading] = useState(true)
  // The overview has no in-page mutator (it's just the funnel), so there's no
  // sibling to signal. Instead it self-refreshes when you return to the tab —
  // `refreshKey` is bumped on window focus / visibility so the counts stay live
  // after you've been working elsewhere, without flashing skeletons.
  const [refreshKey, setRefreshKey] = useState(0)

  // Resolve the session, then fetch counts for the stages this role can see.
  // Re-runs when refreshKey changes (focus/visibility). Resolving the session
  // inside this effect — rather than via useAdminAccess with an inline array —
  // avoids the dependency-identity feedback loop that re-fetched on every render.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // 1) Resolve the current admin (role-gating + greeting).
      let resolved: SessionUser | null = null
      try {
        const res = await fetch("/api/auth/session")
        if (res.ok) {
          const data = await res.json()
          if (data?.authenticated && data.user) resolved = data.user as SessionUser
        }
      } catch {
        // Unauthenticated/transient — the layout guards real access; fall through
        // to an empty funnel rather than blocking the page.
      }
      if (cancelled) return
      setUser(resolved)

      const email = (resolved?.email || "").toLowerCase()
      const isFull =
        SUPER_ADMIN_EMAILS.includes(email) ||
        resolved?.role === "full_admin" ||
        resolved?.role === "crm_super_admin"

      // 2) Fetch stage counts. Audience/Inbox are full-admin-only surfaces.
      const now = Date.now()
      const [leadsR, clientsR, nlR, evR, inboxR, plR, kpiR] = await Promise.allSettled([
        jget("/api/admin/leads", now),
        jget("/api/admin/crm/clients", now),
        isFull ? jget("/api/admin/email-lists-firestore", now) : Promise.resolve(null),
        isFull ? jget("/api/admin/event-registrations", now) : Promise.resolve(null),
        isFull ? jget("/api/admin/contact-forms/inbox-stats", now) : Promise.resolve(null),
        isFull ? jget("/api/admin/audiences/partner-list-members", now) : Promise.resolve(null),
        jget("/api/admin/kpis/funnel", now),
      ])
      if (cancelled) return

      const ok = <T,>(r: PromiseSettledResult<unknown>): T | null =>
        r.status === "fulfilled" ? (r.value as T) : null

      const leadsBody = ok<{ success?: boolean; leads?: Lead[] }>(leadsR)
      const leads = leadsBody?.success ? leadsBody.leads ?? [] : []

      const clientsBody = ok<{ success?: boolean; clients?: Array<{ status?: string }> }>(clientsR)
      const clients = clientsBody?.success ? clientsBody.clients ?? [] : []

      const nlBody = ok<{ success?: boolean; signups?: Array<{ created_at: string }> }>(nlR)
      const signups = nlBody?.success ? nlBody.signups ?? [] : []

      const evBody = ok<{ success?: boolean; registrations?: Array<{ registeredAt: string }> }>(evR)
      const registrations = evBody?.success ? evBody.registrations ?? [] : []

      const inboxBody = ok<{ awaitingReply?: number; totalSubmissions?: number }>(inboxR)

      // "Lists" audience source = the partner_list_members cohort (the same
      // collection the Audiences page counts), NOT promoted partner leads — so
      // the overview total matches what /admin/audiences shows.
      const plBody = ok<{ success?: boolean; members?: Array<{ importedAt?: string }> }>(plR)
      const members = plBody?.success ? plBody.members ?? [] : []

      const leadsActive = leads.filter((l) => l.status !== "archived").length
      const leadsPriority = leads.filter(
        (l) => l.priority === "high" && (l.status === "new" || l.status === "ready"),
      ).length
      // Prospecting throughput this week — leads sourced via outbound prospecting.
      // The signal behind the Prospect entry node (an action, not a queue).
      const prospected7d = countRecent(
        leads.filter((l) => l.source === "prospected").map((l) => l.created_at).filter(Boolean),
        now,
      )

      const kpiBody = ok<{ success?: boolean; kpis?: FunnelKpis }>(kpiR)
      setFunnelKpis(kpiBody?.success ? kpiBody.kpis ?? null : null)

      setCounts({
        audiencesTotal: signups.length + registrations.length + members.length,
        audiences7d:
          countRecent(signups.map((s) => s.created_at).filter(Boolean), now) +
          countRecent(registrations.map((r) => r.registeredAt).filter(Boolean), now) +
          countRecent(members.map((m) => m.importedAt ?? "").filter(Boolean), now),
        inboxAwaiting: inboxBody?.awaitingReply ?? 0,
        inboxTotal: inboxBody?.totalSubmissions ?? 0,
        leadsActive,
        leadsPriority,
        prospected7d,
        clientsTotal: clients.length,
        clientsActive: clients.filter((c) => c.status === "active").length,
      })
      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Self-refresh when the user returns to the overview (tab focus / visibility),
  // so the counts reflect work done elsewhere without a manual page refresh.
  useEffect(() => {
    const bump = () => {
      if (document.visibilityState === "visible") setRefreshKey((k) => k + 1)
    }
    window.addEventListener("focus", bump)
    document.addEventListener("visibilitychange", bump)
    return () => {
      window.removeEventListener("focus", bump)
      document.removeEventListener("visibilitychange", bump)
    }
  }, [])

  const roleResolved = user !== undefined
  const isFullAdmin = (() => {
    if (!user) return false
    const email = (user.email || "").toLowerCase()
    if (SUPER_ADMIN_EMAILS.includes(email)) return true
    return user.role === "full_admin" || user.role === "crm_super_admin"
  })()
  const showLoading = !roleResolved || loading
  const firstName = (user?.name || "").trim().split(/\s+/)[0]
  // Cold start: nothing in the funnel yet. Steer to the active starting action
  // (Prospect) instead of showing a row of zeros under a passive caption.
  const funnelEmpty = !!counts && counts.leadsActive === 0 && counts.clientsTotal === 0

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-5 sm:mb-6">
          <p className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            434 Admin · Overview
          </p>
          <h1 className="mt-2 font-ggx88 text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-neutral-500">
            {isFullAdmin
              ? "Start the funnel two ways — go find companies with Prospect, or work the contacts that arrive through Audiences and the Inbox. Both become Leads, then convert into Clients. Track it all in Funnel KPIs."
              : "Start the funnel with Prospect to find companies, then work qualified Leads and convert them into Clients."}
          </p>
        </header>

        {/* ── First-run: empty funnel ────────────────────────────── */}
        {funnelEmpty && <EmptyStartBanner showImport={isFullAdmin} />}

        {/* ── Funnel ─────────────────────────────────────────────── */}
        {/* Until the role resolves (~one fast session call), default to the
            full layout so full admins never flash the shorter crm_only view. */}
        {!roleResolved || isFullAdmin ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
            {/* 01 — Start the funnel: outbound (Prospect) + inbound (Inbox).
                Audiences is a source that feeds inbound — shown subordinately
                below the two doors, not as a funnel stage. */}
            <FunnelZone label="01 · Start the funnel" className="lg:flex-1">
              <StageNode
                href="/admin/leads/prospect"
                icon={Target}
                title="Prospect"
                stat={counts?.prospected7d ?? 0}
                statLabel="this week"
                sub="Find companies → score → approve as leads"
                loading={showLoading}
                cta="Start prospecting"
              />
              <StageNode
                href="/admin/inbox"
                icon={Inbox}
                title="Inbox"
                stat={counts?.inboxAwaiting ?? 0}
                statLabel="awaiting reply"
                sub={
                  counts
                    ? `${counts.inboxTotal} total inquiries · reply within hours`
                    : "Direct contact-form inquiries"
                }
                loading={showLoading}
                accent={!!counts && counts.inboxAwaiting > 0}
              />
              <Link
                href="/admin/audiences"
                className="group mt-0.5 flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white/60 px-3 py-2 text-[12px] text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
              >
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">
                  <span className="font-medium text-neutral-700">
                    {(counts?.audiencesTotal ?? 0).toLocaleString()}
                  </span>{" "}
                  contacts in <span className="font-medium text-neutral-700">Audiences</span> feed your inbound
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </FunnelZone>

            <Connector label="promote" />

            {/* 02 — Qualify */}
            <FunnelZone label="02 · Qualify" className="lg:flex-1">
              <StageNode
                href="/admin/leads"
                icon={Flag}
                title="Leads"
                stat={counts?.leadsActive ?? 0}
                statLabel="active"
                sub={
                  counts && counts.leadsPriority > 0
                    ? `${counts.leadsPriority} priority to work now`
                    : "Sourced, scored, waiting to be worked"
                }
                loading={showLoading}
                accent={!!counts && counts.leadsPriority > 0}
              />
            </FunnelZone>

            <Connector label="convert" />

            {/* 03 — Win */}
            <FunnelZone label="03 · Client" className="lg:flex-1">
              <StageNode
                href="/admin/crm"
                icon={Rocket}
                title="Clients"
                stat={counts?.clientsTotal ?? 0}
                statLabel="in CRM"
                sub={
                  counts
                    ? `${counts.clientsActive} active · opportunities, tasks & calendar`
                    : "Managed relationships, pipeline & tasks"
                }
                loading={showLoading}
              />
            </FunnelZone>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
            <FunnelZone label="01 · Start" className="sm:flex-1">
              <StageNode
                href="/admin/leads/prospect"
                icon={Target}
                title="Prospect"
                stat={counts?.prospected7d ?? 0}
                statLabel="this week"
                sub="Find companies → score → approve as leads"
                loading={showLoading}
                cta="Start prospecting"
              />
            </FunnelZone>
            <Connector label="promote" />
            <FunnelZone label="02 · Qualify" className="sm:flex-1">
              <StageNode
                href="/admin/leads"
                icon={Flag}
                title="Leads"
                stat={counts?.leadsActive ?? 0}
                statLabel="active"
                sub={
                  counts && counts.leadsPriority > 0
                    ? `${counts.leadsPriority} priority to work now`
                    : "Sourced, scored, waiting to be worked"
                }
                loading={showLoading}
                accent={!!counts && counts.leadsPriority > 0}
              />
            </FunnelZone>
            <Connector label="convert" />
            <FunnelZone label="03 · Client" className="sm:flex-1">
              <StageNode
                href="/admin/crm"
                icon={Rocket}
                title="Clients"
                stat={counts?.clientsTotal ?? 0}
                statLabel="in CRM"
                sub={
                  counts
                    ? `${counts.clientsActive} active · opportunities & tasks`
                    : "Managed relationships, pipeline & tasks"
                }
                loading={showLoading}
              />
            </FunnelZone>
          </div>
        )}

        {/* ── Scoreboard: the funnel's measurement, linked to Funnel KPIs ── */}
        {funnelKpis && <FunnelScoreboard kpis={funnelKpis} />}

        {/* ── Secondary launchpad (full admins) ───────────────────── */}
        {isFullAdmin && (
          <section className="mt-5">
            <p className="mb-2.5 font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
              Also in your workspace
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <QuickLink href="/admin/analytics" icon={BarChart3} label="Analytics" />
              <QuickLink href="/admin/feed-form" icon={Layers} label="Content" />
              <QuickLink href="/admin/project-management" icon={ClipboardList} label="Projects" />
              <QuickLink href="/admin/sops" icon={FileText} label="SOPs" />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ─── Pieces ──────────────────────────────────────────────────────

function FunnelZone({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <p className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
        {label}
      </p>
      {children}
    </div>
  )
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 self-center py-1 lg:flex-col lg:py-0 lg:pt-8">
      <ArrowDown className="h-4 w-4 text-neutral-300 lg:hidden" />
      <span className="font-geist-mono text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-400">
        {label}
      </span>
      <ArrowRight className="hidden h-4 w-4 text-neutral-300 lg:block" />
    </div>
  )
}

function StageNode({
  href,
  icon: Icon,
  title,
  stat,
  statLabel,
  sub,
  loading,
  accent,
  cta,
}: {
  href: string
  icon: LucideIcon
  title: string
  stat: number
  statLabel: string
  sub: string
  loading: boolean
  accent?: boolean
  /** Footer call-to-action label. Defaults to "Open {title}". */
  cta?: string
}) {
  return (
    <Link
      href={href}
      className="group flex-1 rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
          <Icon className="h-4 w-4" />
        </span>
        {accent && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
      </div>
      <h3 className="font-ggx88 text-base font-bold tracking-tight text-neutral-900">{title}</h3>
      <div className="mt-1.5 flex items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-14 animate-pulse rounded bg-neutral-100" />
        ) : (
          <span className="font-ggx88 text-2xl font-black tabular-nums leading-none text-neutral-900">
            {stat.toLocaleString()}
          </span>
        )}
        <span className="text-[12px] text-neutral-500">{statLabel}</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">{sub}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-neutral-700 transition-all group-hover:gap-1.5">
        {cta ?? `Open ${title}`}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

// First-run banner — the funnel is empty, so point at the active starting
// action (Prospect) instead of a row of zeros. Optional secondary route for
// full admins who'd rather import an existing audience.
function EmptyStartBanner({ showImport }: { showImport: boolean }) {
  return (
    <div className="mb-5 rounded-xl border border-neutral-900 bg-neutral-900 p-4 text-white sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-ggx88 text-lg font-bold tracking-tight">Your funnel is empty — start here.</h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-neutral-300">
            Find companies that match your ICP, score them, and approve the best as leads. That&apos;s
            the front door of the sales funnel.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/leads/prospect"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            <Target className="h-4 w-4" />
            Start prospecting
          </Link>
          {showImport && (
            <Link
              href="/admin/audiences"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-4 py-2.5 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              or import an audience
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// Slim scoreboard strip — the funnel's measurement, attached beneath the funnel
// and linking to the full Funnel KPIs surface. Reads as "the score for
// everything above," not a stage leads move into.
function FunnelScoreboard({ kpis }: { kpis: FunnelKpis }) {
  const leadReached = kpis.stages.find((s) => s.stage === "lead")?.reached ?? 0
  const wonReached = kpis.stages.find((s) => s.stage === "closed_won")?.reached ?? 0
  const leadToWon = leadReached > 0 ? wonReached / leadReached : 0
  const ttw = kpis.velocity.find((v) => v.step === "Time to Closed-Won")
  const ttwLabel = ttw && ttw.sampleSize > 0 ? `${ttw.medianDays}d` : "—"

  return (
    <Link
      href="/admin/kpis"
      className="group mt-4 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3 transition-colors hover:border-neutral-300 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-500">
        <CircleGauge className="h-4 w-4 text-neutral-400" />
        Funnel health
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ScoreStat label="ICP match" value={pct(kpis.icpMatchRate)} />
        <ScoreStat label="Lead → Won" value={pct(leadToWon)} />
        <ScoreStat label="Time to Won" value={ttwLabel} />
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-neutral-700 transition-all group-hover:gap-1.5">
          Funnel KPIs
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  )
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-ggx88 text-lg font-black tabular-nums leading-none text-neutral-900">{value}</span>
      <span className="text-[11px] text-neutral-500">{label}</span>
    </span>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
    >
      <Icon className="h-4 w-4 text-neutral-500 group-hover:text-neutral-700" />
      <span className="flex-1 truncate">{label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 text-neutral-300" />
    </Link>
  )
}
