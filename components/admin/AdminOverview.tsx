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
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Lead } from "@/types/crm-types"

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
  const [loading, setLoading] = useState(true)

  // Single self-contained load that runs exactly once (empty deps): resolve the
  // session, then fetch counts for the stages this role can see. Resolving the
  // session inside this effect — rather than via useAdminAccess with an inline
  // array — avoids the dependency-identity feedback loop that re-fetched on
  // every render.
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
      const [leadsR, clientsR, nlR, evR, inboxR] = await Promise.allSettled([
        jget("/api/admin/leads", now),
        jget("/api/admin/crm/clients", now),
        isFull ? jget("/api/admin/email-lists-firestore", now) : Promise.resolve(null),
        isFull ? jget("/api/admin/event-registrations", now) : Promise.resolve(null),
        isFull ? jget("/api/admin/contact-forms/inbox-stats", now) : Promise.resolve(null),
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

      // "Lists" audience source = partner-shared leads (mirrors AudiencesHeaderStrip).
      const partnerLeads = leads.filter((l) => l.source === "partner")

      const leadsActive = leads.filter((l) => l.status !== "archived").length
      const leadsPriority = leads.filter(
        (l) => l.priority === "high" && (l.status === "new" || l.status === "ready"),
      ).length

      setCounts({
        audiencesTotal: signups.length + registrations.length + partnerLeads.length,
        audiences7d:
          countRecent(signups.map((s) => s.created_at).filter(Boolean), now) +
          countRecent(registrations.map((r) => r.registeredAt).filter(Boolean), now) +
          countRecent(partnerLeads.map((l) => l.created_at).filter(Boolean), now),
        inboxAwaiting: inboxBody?.awaitingReply ?? 0,
        inboxTotal: inboxBody?.totalSubmissions ?? 0,
        leadsActive,
        leadsPriority,
        clientsTotal: clients.length,
        clientsActive: clients.filter((c) => c.status === "active").length,
      })
      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
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

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="mb-8 sm:mb-10">
          <p className="font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            434 Admin · Overview
          </p>
          <h1 className="mt-2 font-ggx88 text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-neutral-500">
            {isFullAdmin
              ? "Everything flows one direction. Contacts arrive through Audiences and the Inbox, get qualified as Leads, then convert into Clients in the CRM. Here's the whole pipeline at a glance."
              : "Your queue runs one direction: work qualified Leads, then convert them into Clients in the CRM."}
          </p>
        </header>

        {/* ── Funnel ─────────────────────────────────────────────── */}
        {/* Until the role resolves (~one fast session call), default to the
            full layout so full admins never flash the shorter crm_only view. */}
        {!roleResolved || isFullAdmin ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2">
            {/* 01 — Entry points (two sources feed Leads) */}
            <FunnelZone label="01 · Entry points" className="lg:flex-1">
              <StageNode
                href="/admin/audiences"
                icon={Megaphone}
                title="Audiences"
                stat={counts?.audiencesTotal ?? 0}
                statLabel="contacts"
                sub={
                  counts && counts.audiences7d > 0
                    ? `+${counts.audiences7d} new this week · push to Mailchimp`
                    : "Newsletter · Events · Lists → Mailchimp"
                }
                loading={showLoading}
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
              <Link
                href="/admin/leads/prospect"
                className="group mt-0.5 flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white/60 px-3 py-2 text-[12px] text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
              >
                <Target className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">
                  Also fed by <span className="font-medium text-neutral-700">outbound Prospecting</span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
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
            <FunnelZone label="01 · Qualify" className="sm:flex-1">
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
            <FunnelZone label="02 · Client" className="sm:flex-1">
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

        {/* ── Secondary launchpad (full admins) ───────────────────── */}
        {isFullAdmin && (
          <section className="mt-10">
            <p className="mb-3 font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
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
}: {
  href: string
  icon: LucideIcon
  title: string
  stat: number
  statLabel: string
  sub: string
  loading: boolean
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex-1 rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
          <Icon className="h-4 w-4" />
        </span>
        {accent && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
      </div>
      <h3 className="font-ggx88 text-base font-bold tracking-tight text-neutral-900">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-14 animate-pulse rounded bg-neutral-100" />
        ) : (
          <span className="font-ggx88 text-3xl font-black tabular-nums leading-none text-neutral-900">
            {stat.toLocaleString()}
          </span>
        )}
        <span className="text-[12px] text-neutral-500">{statLabel}</span>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-neutral-500">{sub}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-neutral-700 transition-all group-hover:gap-1.5">
        Open {title}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
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
