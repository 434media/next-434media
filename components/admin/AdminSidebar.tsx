"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Rocket,
  Inbox,
  BarChart3,
  CircleGauge,
  Layers,
  ClipboardList,
  FileText,
  GraduationCap,
  Target,
  Flag,
  Megaphone,
  Calendar,
  Clapperboard,
  Newspaper,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Home,
  Settings,
  Globe,
  LayoutDashboard,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { SquadKey } from "@/components/crm/types"

type AdminRole = "crm_super_admin" | "full_admin" | "crm_only" | "intern"

// Squad signposting — points a cohort intern at the surfaces their squad works
// in, WITHOUT hiding anything else. Driven by team_member.squad. Labels are
// page names (not squad names) per the program's "signpost, don't relabel" rule.
type SignpostLink = { label: string; href: string; icon: LucideIcon }
const SQUAD_SIGNPOSTS: Record<SquadKey, SignpostLink[]> = {
  domain: [{ label: "Problem Library", href: "/admin/painpoints", icon: Target }],
  // GTM works the funnel: browse/score leads + run prospecting. CRM (operator
  // deal pipeline) is intentionally not here — interns no longer have access.
  gtm: [
    { label: "Leads", href: "/admin/leads", icon: Flag },
    { label: "Prospect", href: "/admin/leads/prospect", icon: Target },
  ],
  story_media: [
    { label: "AI Studio", href: "/admin/content/studio", icon: Clapperboard },
    { label: "Calendar", href: "/admin/content", icon: Calendar },
  ],
  // Analytics squad's KPIs are lead quality + email benchmarks — the dedicated
  // Funnel KPI surface — plus the Leads data those metrics are derived from.
  // NOT the web/social Analytics page (now full_admin-only).
  analytics: [
    { label: "Funnel KPIs", href: "/admin/kpis", icon: CircleGauge },
    { label: "Leads", href: "/admin/leads", icon: Flag },
  ],
  build: [],
}
// Appended for every squad — the cohort board (their task home) and SOPs (where
// every squad documents its work).
const SIGNPOST_COMMON: SignpostLink[] = [
  { label: "Cohort board", href: "/admin/cohorts", icon: GraduationCap },
  { label: "SOPs", href: "/admin/sops", icon: FileText },
]

// Hardcoded super-admin fallback — kept in sync with lib/auth.ts CRM_SUPER_ADMIN_FALLBACK.
// Used so the sidebar can render the Settings entry without an async Firestore lookup.
const SUPER_ADMIN_EMAILS = ["marcos@434media.com", "jesse@434media.com"]

export interface SidebarUser {
  email: string
  name: string
  role?: AdminRole
}

interface SidebarItemBase {
  id: string
  label: string
  icon: LucideIcon
  /** Optional hover tooltip explaining what the item is / how it relates. */
  description?: string
  roles: AdminRole[]
}

interface SidebarLink extends SidebarItemBase {
  href: string
  matchPrefix?: string
  /** Highlight only on an exact path match (not prefix). Used by Overview so
   *  "/admin" doesn't stay active on every "/admin/*" sub-route. */
  exact?: boolean
  children?: never
}

interface SidebarGroup extends SidebarItemBase {
  href?: never
  matchPrefix: string
  children: { id: string; label: string; href: string; matchPrefix?: string }[]
}

type SidebarEntry = SidebarLink | SidebarGroup

interface SidebarSection {
  id: string
  title: string
  items: SidebarEntry[]
}

// Pinned above the sections — the shared home for every role.
const OVERVIEW_ITEM: SidebarLink = {
  id: "overview",
  label: "Overview",
  icon: LayoutDashboard,
  href: "/admin",
  matchPrefix: "/admin",
  exact: true,
  roles: ["crm_super_admin", "full_admin", "crm_only", "intern"],
}

// Sections mirror the lifecycle: "Pipeline" runs in funnel order
// (Audiences → Inbox → Leads → CRM) so the sidebar reads entry-point → outcome
// top-to-bottom. Insights and Workspace hold the supporting surfaces.
const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: "pipeline",
    title: "Pipeline",
    items: [
      {
        id: "audiences",
        label: "Audiences",
        icon: Megaphone,
        href: "/admin/audiences",
        matchPrefix: "/admin/audiences",
        roles: ["full_admin"],
      },
      {
        id: "inbox",
        label: "Inbox",
        icon: Inbox,
        href: "/admin/inbox",
        matchPrefix: "/admin/inbox",
        roles: ["full_admin"],
      },
      {
        id: "leads",
        label: "Leads",
        icon: Flag,
        href: "/admin/leads",
        matchPrefix: "/admin/leads",
        roles: ["full_admin", "crm_only", "intern"],
      },
      {
        id: "crm",
        label: "CRM",
        icon: Rocket,
        href: "/admin/crm",
        matchPrefix: "/admin/crm",
        // Operator deal pipeline (clients, opportunities, revenue) — not intern
        // scope. Interns do funnel research in Leads; CRM stays operator-only.
        roles: ["full_admin", "crm_only"],
      },
    ],
  },
  {
    id: "insights",
    title: "Insights",
    items: [
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/analytics",
        matchPrefix: "/admin/analytics",
        // Web (GA4) + social (Instagram) + portfolio analytics — 434 marketing,
        // not the intern Analytics squad's domain (they work lead-quality &
        // email-campaign KPIs out of Leads). Matches the page guard below.
        roles: ["full_admin"],
      },
      {
        id: "funnel-kpis",
        label: "Funnel KPIs",
        icon: CircleGauge,
        href: "/admin/kpis",
        matchPrefix: "/admin/kpis",
        // The Analytics squad's home: lead quality (score, kept/removed,
        // conversion) + email benchmarks (Mailchimp drop + Resend 1:1).
        // Deliberately visible to interns, unlike web/social Analytics above.
        roles: ["full_admin", "crm_only", "intern"],
      },
    ],
  },
  {
    id: "content",
    title: "Content",
    items: [
      // Ordered as the content lifecycle: create (AI Studio) → plan & schedule
      // (Calendar) → publish (Feed, Blog). AI Studio leads since it's where
      // assets are made and feeds the rest. crm_only can reach Studio + Calendar
      // (same as the page guards); Feed/Blog stay full_admin.
      {
        id: "content-studio",
        label: "AI Studio",
        icon: Clapperboard,
        href: "/admin/content/studio",
        matchPrefix: "/admin/content/studio",
        description: "Generate images & video with AI — saved to your library",
        roles: ["full_admin", "crm_only", "intern"],
      },
      {
        id: "content-calendar",
        label: "Calendar",
        icon: Calendar,
        href: "/admin/content",
        matchPrefix: "/admin/content",
        // Exact so it doesn't stay highlighted on the /admin/content/studio sibling.
        exact: true,
        description: "Plan, review & schedule social posts",
        roles: ["full_admin", "crm_only", "intern"],
      },
      {
        id: "feed",
        label: "Feed",
        icon: Layers,
        href: "/admin/feed-form",
        matchPrefix: "/admin/feed-form",
        description: "Publish to the site feed",
        roles: ["full_admin"],
      },
      {
        id: "blog",
        label: "Blog",
        icon: Newspaper,
        href: "/admin/blog",
        matchPrefix: "/admin/blog",
        description: "Write & publish blog posts",
        roles: ["full_admin"],
      },
    ],
  },
  {
    id: "workspace",
    title: "Workspace",
    items: [
      {
        id: "projects",
        label: "Projects",
        icon: ClipboardList,
        href: "/admin/project-management",
        matchPrefix: "/admin/project-management",
        roles: ["full_admin"],
      },
      {
        id: "sops",
        label: "SOPs",
        icon: FileText,
        href: "/admin/sops",
        matchPrefix: "/admin/sops",
        roles: ["full_admin", "intern"],
      },
    ],
  },
  // Digital Canvas program surfaces — the underwriter intake → cohort pipeline.
  // Painpoints + Cohorts are program-specific (Projects/SOPs stay company-wide
  // in Workspace). Mirrors the squads page and the SOP two-space IA.
  {
    id: "digital-canvas",
    title: "Digital Canvas",
    items: [
      {
        id: "painpoints",
        label: "Problem Library",
        icon: Target,
        href: "/admin/painpoints",
        matchPrefix: "/admin/painpoints",
        description: "Sourced industry problems → activated into a cohort's problem set",
        // Authored by the Underwriter Onboarding squad (interns); operators activate into cohorts.
        roles: ["full_admin", "intern"],
      },
      {
        id: "cohorts",
        label: "Cohorts",
        icon: GraduationCap,
        href: "/admin/cohorts",
        matchPrefix: "/admin/cohorts",
        // Interns reach their cohort board here (read-only list + board access).
        roles: ["full_admin", "crm_only", "intern"],
      },
    ],
  },
]

// Footer-pinned items render below "Back to site" — for configuration surfaces
// that aren't part of daily navigation. Same role-gating rules as primary items.
const FOOTER_ITEMS: SidebarLink[] = [
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/admin/crm/settings",
    matchPrefix: "/admin/crm/settings",
    roles: ["crm_super_admin"],
  },
]

function isActive(pathname: string, matchPrefix: string, exact = false): boolean {
  return matchPrefix
    .split("|")
    .some((p) => (exact ? pathname === p : pathname === p || pathname.startsWith(`${p}/`)))
}

interface AdminSidebarProps {
  user: SidebarUser
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Mobile: full overlay sidebar; otherwise a fixed rail */
  isMobile?: boolean
  onNavigate?: () => void
}

export function AdminSidebar({
  user,
  collapsed,
  onToggleCollapsed,
  isMobile,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname() ?? ""
  // Effective role: session role takes precedence; super-admin fallback ensures
  // Marcos and Jesse always see Settings even before their session role is upgraded.
  const baseRole: AdminRole = user.role ?? "crm_only"
  const effectiveRole: AdminRole =
    SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) ? "crm_super_admin" : baseRole
  const role = effectiveRole
  // Super-admins see everything full_admins see, plus super-admin-only items.
  const grantedRoles: AdminRole[] =
    role === "crm_super_admin" ? ["crm_super_admin", "full_admin", "crm_only"] : [role]
  const canSee = (entry: SidebarItemBase) => entry.roles.some((r) => grantedRoles.includes(r))

  // Resolve the user's cohort squad (if any) to drive the "Your workspace"
  // signpost. Read from the team roster by email — works for any live session.
  const [squad, setSquad] = useState<SquadKey | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/team-members")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.success) return
        const me = (d.data as Array<{ email?: string; squad?: SquadKey | null }>).find(
          (m) => m.email?.toLowerCase() === user.email.toLowerCase(),
        )
        setSquad(me?.squad ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user.email])
  const signpostLinks = squad ? [...(SQUAD_SIGNPOSTS[squad] ?? []), ...SIGNPOST_COMMON] : []

  const overviewVisible = canSee(OVERVIEW_ITEM)
  // Filter each section's items by role, then drop any section left empty.
  const sections = SIDEBAR_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(canSee),
  })).filter((s) => s.items.length > 0)
  const footerItems = FOOTER_ITEMS.filter(canSee)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    for (const section of SIDEBAR_SECTIONS) {
      for (const item of section.items) {
        if ("children" in item && item.children) {
          out[item.id] = isActive(pathname, item.matchPrefix)
        }
      }
    }
    return out
  })

  const showLabels = isMobile || !collapsed

  // Renders a single sidebar entry (link or expandable group). Extracted so the
  // pinned Overview item and every section share identical markup/behavior.
  const renderEntry = (item: SidebarEntry) => {
    const Icon = item.icon
    const matchPrefix =
      "matchPrefix" in item && item.matchPrefix ? item.matchPrefix : item.href ?? ""
    const exact = "exact" in item ? item.exact ?? false : false
    const active = isActive(pathname, matchPrefix, exact)

    if ("children" in item && item.children) {
      const isOpen = openGroups[item.id] ?? active
      return (
        <div key={item.id}>
          <button
            type="button"
            onClick={() => {
              if (collapsed && !isMobile) {
                onToggleCollapsed()
                setOpenGroups((s) => ({ ...s, [item.id]: true }))
                return
              }
              setOpenGroups((s) => ({ ...s, [item.id]: !isOpen }))
            }}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              active
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
            title={!showLabels ? item.label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {showLabels && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                    isOpen ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </>
            )}
          </button>
          {showLabels && isOpen && (
            <div className="ml-6 mt-0.5 space-y-0.5">
              {item.children.map((child) => {
                const childActive = isActive(pathname, child.matchPrefix ?? child.href)
                return (
                  <Link
                    key={child.id}
                    href={child.href}
                    onClick={onNavigate}
                    className={`flex items-center px-2 py-1 rounded-md text-[12px] transition-colors ${
                      childActive
                        ? "bg-neutral-100 text-neutral-900 font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                    }`}
                  >
                    {child.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onNavigate}
        title={!showLabels ? item.label : item.description}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
          active
            ? "bg-neutral-900 text-white"
            : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {showLabels && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  return (
    <aside
      className={`flex flex-col h-full bg-white border-r border-neutral-200 transition-[width] duration-150 ${
        isMobile ? "w-64" : collapsed ? "w-14" : "w-56"
      }`}
    >
      {/* Brand row */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-neutral-200 shrink-0">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-neutral-900 font-ggx88 text-sm tracking-wide"
          onClick={onNavigate}
        >
          <span className="w-7 h-7 rounded-md bg-neutral-900 text-white flex items-center justify-center shrink-0">
            <Globe className="w-3.5 h-3.5" />
          </span>
          {showLabels && <span className="truncate font-menda-black">434 ADMIN</span>}
        </Link>
        {!isMobile && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {overviewVisible && <div className="space-y-0.5">{renderEntry(OVERVIEW_ITEM)}</div>}

        {/* Squad signpost — where this person works. Additive: every section
            below still renders in full. */}
        {showLabels && signpostLinks.length > 0 && (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1.5">
            <p className="px-1.5 pb-1 pt-0.5 font-geist-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              Your workspace
            </p>
            <div className="space-y-0.5">
              {signpostLinks.map((link) => {
                const Icon = link.icon
                const active = isActive(pathname, link.href, link.href === "/admin/content")
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {sections.map((section) => (
          <div key={section.id} className={overviewVisible ? "mt-1" : ""}>
            {showLabels ? (
              <p className="px-2 pt-3 pb-1 font-geist-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                {section.title}
              </p>
            ) : (
              // Collapsed rail: a thin divider stands in for the section header.
              <div className="my-1.5 mx-2 border-t border-neutral-200" aria-hidden />
            )}
            <div className="space-y-0.5">{section.items.map(renderEntry)}</div>
          </div>
        ))}
      </nav>

      {/* Footer-pinned items (configuration surfaces) */}
      {footerItems.length > 0 && (
        <div className="px-2 pt-2 pb-1 border-t border-neutral-200 space-y-0.5">
          {footerItems.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.matchPrefix ?? item.href)
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                title={!showLabels ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {showLabels && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </div>
      )}

      {/* Back to public site */}
      <div className="px-2 pb-2 pt-1">
        <Link
          href="/"
          onClick={onNavigate}
          title={!showLabels ? "Back to site" : undefined}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
        >
          <Home className="w-4 h-4 shrink-0" />
          {showLabels && (
            <>
              <span className="flex-1 truncate">Back to site</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-neutral-300" />
            </>
          )}
        </Link>
      </div>

      {/* User identity footer */}
      {showLabels && (
        <div className="px-3 py-2 border-t border-neutral-200 text-[10px] text-neutral-400">
          <span className="block truncate">{user.email}</span>
          <span className="uppercase tracking-wider">{role.replace("_", " ")}</span>
        </div>
      )}
    </aside>
  )
}

