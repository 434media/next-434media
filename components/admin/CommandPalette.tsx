"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  Search,
  Rocket,
  Inbox,
  BarChart3,
  Rss,
  PencilLine,
  ClipboardList,
  FileText,
  Settings,
  Plus,
  Building2,
  Sparkles,
  CheckCircle2,
  Calendar,
  ArrowRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface CommandItem {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  /** Section grouping in the rendered list. */
  section: "Quick actions" | "Navigate" | "Clients" | "Opportunities" | "Tasks"
  /** Lower-cased haystack used for fuzzy matching. */
  search: string
  /** Action to run on Enter. Receives router so callers don't need to capture it. */
  run: (router: ReturnType<typeof useRouter>) => void
}

const STATIC_ITEMS: CommandItem[] = [
  // Quick actions — common create flows. The CRM page reads these query params
  // on mount and opens the matching create modal.
  {
    id: "create-client",
    label: "Create client",
    hint: "Open the new-client form",
    icon: Plus,
    section: "Quick actions",
    search: "create new client add company",
    run: (router) => router.push("/admin/crm?tab=clients&new=client"),
  },
  {
    id: "create-opportunity",
    label: "Create opportunity",
    hint: "Open the new-opportunity form",
    icon: Sparkles,
    section: "Quick actions",
    search: "create new opportunity deal pitch",
    run: (router) => router.push("/admin/crm?tab=pipeline&new=opportunity"),
  },
  {
    id: "create-task",
    label: "Create task",
    hint: "Open the new-task form",
    icon: CheckCircle2,
    section: "Quick actions",
    search: "create new task todo",
    run: (router) => router.push("/admin/crm?tab=tasks&new=task"),
  },
  {
    id: "create-content-post",
    label: "Create content post",
    hint: "Schedule a new social post",
    icon: Calendar,
    section: "Quick actions",
    search: "create new content post social",
    run: (router) => router.push("/admin/crm?tab=social-calendar&new=content"),
  },

  // Navigate — primary admin sections
  {
    id: "nav-crm",
    label: "CRM",
    hint: "Dashboard, pipeline, clients, tasks",
    icon: Rocket,
    section: "Navigate",
    search: "crm dashboard pipeline clients tasks",
    run: (router) => router.push("/admin/crm"),
  },
  {
    id: "nav-leads",
    label: "Leads & Registrations",
    hint: "Contact forms, event registrations, signups",
    icon: Inbox,
    section: "Navigate",
    search: "leads contact forms registrations signups",
    run: (router) => router.push("/admin/leads"),
  },
  {
    id: "nav-analytics-ga4",
    label: "Analytics — Google Analytics",
    hint: "Web traffic, sessions, top pages",
    icon: BarChart3,
    section: "Navigate",
    search: "analytics google ga4 web traffic",
    run: (router) => router.push("/admin/analytics?tab=ga4"),
  },
  {
    id: "nav-analytics-instagram",
    label: "Analytics — Instagram",
    hint: "Account insights, top posts, reach",
    icon: BarChart3,
    section: "Navigate",
    search: "analytics instagram social ig",
    run: (router) => router.push("/admin/analytics?tab=instagram"),
  },
  {
    id: "nav-analytics-mailchimp",
    label: "Analytics — Mailchimp",
    hint: "Campaigns, subscribers, engagement",
    icon: BarChart3,
    section: "Navigate",
    search: "analytics mailchimp email campaigns subscribers",
    run: (router) => router.push("/admin/analytics?tab=mailchimp"),
  },
  {
    id: "nav-analytics-linkedin",
    label: "Analytics — LinkedIn",
    hint: "Company page, posts, followers",
    icon: BarChart3,
    section: "Navigate",
    search: "analytics linkedin social",
    run: (router) => router.push("/admin/analytics?tab=linkedin"),
  },
  {
    id: "nav-feed",
    label: "Content — The Feed",
    hint: "Digital Canvas content management",
    icon: Rss,
    section: "Navigate",
    search: "content feed digital canvas",
    run: (router) => router.push("/admin/feed-form"),
  },
  {
    id: "nav-blog",
    label: "Content — Blog",
    hint: "Blog post management",
    icon: PencilLine,
    section: "Navigate",
    search: "content blog posts",
    run: (router) => router.push("/admin/blog"),
  },
  {
    id: "nav-projects",
    label: "Project Management",
    hint: "Events, vendors, speakers",
    icon: ClipboardList,
    section: "Navigate",
    search: "projects project management events vendors speakers",
    run: (router) => router.push("/admin/project-management"),
  },
  {
    id: "nav-sops",
    label: "SOPs",
    hint: "Standard operating procedures",
    icon: FileText,
    section: "Navigate",
    search: "sops standard operating procedures docs documentation",
    run: (router) => router.push("/admin/sops"),
  },
  {
    id: "nav-settings",
    label: "Settings",
    hint: "Team members, configuration (super admin)",
    icon: Settings,
    section: "Navigate",
    search: "settings team members config admin",
    run: (router) => router.push("/admin/crm/settings"),
  },
]

interface EntityCache {
  clients: Array<{ id: string; name: string; company_name?: string; brand?: string }>
  opportunities: Array<{ id: string; name: string; client_name?: string; stage?: string; value?: number }>
  tasks: Array<{ id: string; title: string; assigned_to?: string; status?: string; due_date?: string }>
  fetchedAt: number
}

const CACHE_TTL_MS = 30_000
let entityCache: EntityCache | null = null

async function loadEntities(): Promise<EntityCache> {
  if (entityCache && Date.now() - entityCache.fetchedAt < CACHE_TTL_MS) {
    return entityCache
  }
  const [clientsRes, opportunitiesRes, tasksRes] = await Promise.all([
    fetch("/api/admin/crm/clients").then((r) => r.json()).catch(() => ({})),
    fetch("/api/admin/crm/opportunities").then((r) => r.json()).catch(() => ({})),
    fetch("/api/admin/crm/tasks").then((r) => r.json()).catch(() => ({})),
  ])
  entityCache = {
    clients: clientsRes.clients ?? [],
    opportunities: opportunitiesRes.opportunities ?? [],
    tasks: tasksRes.tasks ?? [],
    fetchedAt: Date.now(),
  }
  return entityCache
}

interface CommandPaletteProps {
  /** Set true to disable the global Cmd+K binding (e.g., when another modal owns it). */
  disabled?: boolean
}

export function CommandPalette({ disabled }: CommandPaletteProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [entities, setEntities] = useState<EntityCache | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global Cmd+K / Ctrl+K binding
  useEffect(() => {
    if (disabled) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [disabled])

  // Lazy-load entity data on first open
  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    setQuery("")
    inputRef.current?.focus()
    let cancelled = false
    loadEntities().then((data) => {
      if (!cancelled) setEntities(data)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Close on route change (router.push from a command should auto-close).
  // Achieved indirectly: parent rerenders on nav and pathname-based state cleanup.
  // We also explicitly close in `runItem`.
  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  const runItem = useCallback(
    (item: CommandItem) => {
      close()
      // setTimeout so the close animation runs first; nav happens just after.
      setTimeout(() => item.run(router), 50)
    },
    [router, close],
  )

  // Build entity items lazily — they require the loaded data.
  const entityItems = useMemo<CommandItem[]>(() => {
    if (!entities) return []
    const items: CommandItem[] = []

    for (const c of entities.clients.slice(0, 30)) {
      const label = c.company_name || c.name || "Unnamed client"
      items.push({
        id: `client-${c.id}`,
        label,
        hint: c.brand,
        icon: Building2,
        section: "Clients",
        search: `${label} ${c.brand ?? ""}`.toLowerCase(),
        run: (router) => router.push(`/admin/crm?tab=clients&open=${c.id}`),
      })
    }

    for (const o of entities.opportunities.slice(0, 30)) {
      const label = o.name || o.client_name || "Unnamed opportunity"
      const valueHint = o.value ? `$${o.value.toLocaleString()}` : ""
      const stageHint = o.stage ? `${o.stage}` : ""
      items.push({
        id: `opportunity-${o.id}`,
        label,
        hint: [stageHint, valueHint].filter(Boolean).join(" · "),
        icon: Sparkles,
        section: "Opportunities",
        search: `${label} ${o.client_name ?? ""} ${o.stage ?? ""}`.toLowerCase(),
        run: (router) => router.push(`/admin/crm?tab=pipeline&openOpportunity=${o.id}`),
      })
    }

    for (const t of entities.tasks.slice(0, 30)) {
      const label = t.title || "Untitled task"
      items.push({
        id: `task-${t.id}`,
        label,
        hint: [t.assigned_to, t.status].filter(Boolean).join(" · "),
        icon: CheckCircle2,
        section: "Tasks",
        search: `${label} ${t.assigned_to ?? ""} ${t.status ?? ""}`.toLowerCase(),
        run: (router) => router.push(`/admin/crm?tab=tasks&openTask=${t.id}`),
      })
    }

    return items
  }, [entities])

  const allItems = useMemo(() => [...STATIC_ITEMS, ...entityItems], [entityItems])

  // Filter + group
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const tokens = q.split(/\s+/).filter(Boolean)
    const matches = q
      ? allItems.filter((item) =>
          tokens.every(
            (t) => item.label.toLowerCase().includes(t) || item.search.includes(t),
          ),
        )
      : allItems

    // Group by section, preserving STATIC_ITEMS first, then entities
    const grouped = new Map<CommandItem["section"], CommandItem[]>()
    for (const item of matches) {
      if (!grouped.has(item.section)) grouped.set(item.section, [])
      grouped.get(item.section)!.push(item)
    }
    return grouped
  }, [allItems, query])

  // Flat list for arrow-key navigation
  const flat = useMemo(() => {
    const out: CommandItem[] = []
    for (const items of filtered.values()) out.push(...items)
    return out
  }, [filtered])

  // Reset active index when the filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Arrow / Enter / Esc handling
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = flat[activeIndex]
        if (item) runItem(item)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, flat, activeIndex, runItem, close])

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/30"
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients, tasks, opportunities, or commands…"
                className="flex-1 bg-transparent text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 bg-neutral-100 border border-neutral-200 rounded">
                Esc
              </kbd>
            </div>

            {/* Result list */}
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {flat.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-neutral-400">
                  No matches.{!entities && " Loading data…"}
                </div>
              ) : (
                Array.from(filtered.entries()).map(([section, items]) => (
                  <div key={section} className="pb-1">
                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      {section}
                    </div>
                    {items.map((item) => {
                      const flatIndex = flat.indexOf(item)
                      const active = flatIndex === activeIndex
                      const Icon = item.icon
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => runItem(item)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors ${
                            active
                              ? "bg-neutral-100 text-neutral-900"
                              : "text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-neutral-700" : "text-neutral-400"}`} />
                          <span className="flex-1 truncate font-medium">{item.label}</span>
                          {item.hint && (
                            <span className="text-[11px] text-neutral-400 truncate max-w-[40%]">{item.hint}</span>
                          )}
                          {active && <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 bg-neutral-50 text-[11px] text-neutral-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded font-mono">↵</kbd>
                  select
                </span>
              </div>
              <span>{flat.length} {flat.length === 1 ? "result" : "results"}</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
