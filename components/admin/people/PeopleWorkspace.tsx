"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Building2, CheckCircle2, AlertCircle, Inbox, Search, UserPlus, Users, Flag, Bookmark, X, Lock, Briefcase, RefreshCw, Contact, Pencil, Plus, Power, FileText, Reply } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { DraftDrawer, dismissOutcome, type DraftItem } from "@/components/admin/review/DraftDrawer"
import { InboxReplyModal } from "@/components/admin/people/InboxReplyModal"
import { WaitingOnYou, type HeldArrival, type PoliRow } from "@/components/admin/people/WaitingOnYou"
import { TodayCard } from "@/components/admin/people/TodayCard"
import { waitingRows } from "@/lib/core-model/waiting"
import type { Activity, Affiliation, AffiliationRole, AddressBook, CoreRole, InboxItem, LifecycleStage, Organization, Person, Relationship } from "@/types/core-model"
import { AFFILIATION_ROLES, CORE_ROLES } from "@/types/core-model"

type Tab = "waiting" | "inbox" | "people" | "organizations"
/** The People page's tabs. "waiting" is the To do page (/admin/todo), the same workspace shown as one list. */
const TABS: Tab[] = ["inbox", "people", "organizations"]
/** `undo`, when present, puts an Undo button on the toast and keeps it up a little longer. */
type Toast = { type: "success" | "error"; message: string; undo?: () => void }
/** How long the triage toast offers Undo. The server allows a little more (lib/core-model/service.ts). */
const UNDO_MS = 6000
interface AgentsLine { stopped: boolean; mode: string; sends: boolean }
type Decision = "promote" | "save" | "dismiss"
type Triage = (i: InboxItem, d: Decision, relationship?: Relationship) => void

interface SyncStatus {
  configured: boolean
  missing: string[]
  connected: boolean
  connected_at?: string
  phase: "import" | "sync" | "resync"
  write_back: boolean
  last_run_at?: string
  last_result?: { imported: number; linked: number; updated: number; arrivals: number; written: number; errors: string[] }
  linked: number
  waiting_for_write_back: number
}

const GOOGLE_RETURN: Record<string, Toast> = {
  connected: { type: "success", message: "Google Contacts connected. The import starts on the next sync." },
  declined: { type: "error", message: "Google Contacts was not connected: consent was declined." },
  expired: { type: "error", message: "That connect link expired. Connect again." },
  scope: { type: "error", message: "Google granted more than the contacts scope, so the connection was refused. Connect again." },
  failed: { type: "error", message: "Google Contacts could not be connected. Try again." },
  not_configured: { type: "error", message: "Google Contacts is not configured on this deployment yet." },
}
type PersonRow = Person & { organizations: string[] }
type OrgRow = Organization & { people_count: number }

const SOURCE_LABEL: Record<string, string> = {
  web: "Website form",
  event: "Event",
  manual: "By hand",
  newsletter: "Newsletter",
  referral: "Referral",
  partner: "Partner list",
  social: "Social",
  prospected: "Prospected",
  google_contacts: "Google Contacts",
}

const STAGE_LABEL: Record<string, string> = { contact: "Contact", lead: "Lead", customer: "Customer" }

/** A website inquiry's Activity id is its contact-form id under this prefix (lib/agent/review.ts, arrivalActivityId). */
const CONTACT_FORM_PREFIX = "contact_forms:"
const isPhoneArrival = (a: Activity) => a.source === "google_contacts" && Boolean(a.read_only)

function when(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "dark" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        tone === "dark" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {children}
    </span>
  )
}

function Fit({ org }: { org?: Organization }) {
  if (!org || typeof org.icp_fit_score !== "number") return <span className="text-xs text-neutral-400">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-700" title={org.icp_review ?? "Fit from the ICP rubric"}>
      <span className="font-mono font-semibold">{org.icp_grade}</span>
      <span className="text-neutral-400">{org.icp_fit_score}</span>
    </span>
  )
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`)
  return json as T
}

/**
 * `todo`: the To do page, everything waiting on the viewer (founder, 2026-11-17: its own page, first in the sidebar).
 * `records`: the People page, the Inbox, People and Organizations. One workspace, so a draft or an arrival opens and is
 * decided the same way on both.
 */
export function PeopleWorkspace({ view = "records" }: { view?: "todo" | "records" }) {
  const [tab, setTab] = useState<Tab>(view === "todo" ? "waiting" : "inbox")
  const [toast, setToast] = useState<Toast | null>(null)
  const [inbox, setInbox] = useState<InboxItem[] | null>(null)
  const [people, setPeople] = useState<PersonRow[] | null>(null)
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [openPerson, setOpenPerson] = useState<string | null>(null)
  const [openOrg, setOpenOrg] = useState<string | null>(null)
  const [openActivity, setOpenActivity] = useState<InboxItem | null>(null)
  const [adding, setAdding] = useState(false)
  // "Waiting on you": the approval records, founder only on the server. null until read; [] when not the founder.
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null)
  const [openDraft, setOpenDraft] = useState<DraftItem | null>(null)
  // The solicitation pre-check's holds (founder only), and Dismiss: spam or solicitation on an arrival row.
  const [holds, setHolds] = useState<Map<string, HeldArrival>>(new Map())
  // Polí's open tasks (founder only; V1 item 4, Polí slice 1): To do rows that open on the Tasks page.
  const [poliRows, setPoliRows] = useState<PoliRow[]>([])
  const [confirmingDismiss, setConfirmingDismiss] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentsLine | null>(null)
  // A phone arrival's dismissal is held for the undo window: once sent, nothing about it is left to restore.
  const pendingOpen = useRef<string | null>(null)
  const heldDismiss = useRef<{ timer: ReturnType<typeof setTimeout>; send: () => void } | null>(null)
  // The founder is whoever the Google Contacts status answers for (founder only on the server); everyone else gets
  // 401/403 and sees no personal controls. The server enforces the rule either way.
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const founder = sync !== null

  const loadSync = useCallback(async () => {
    try {
      setSync((await api<{ data: SyncStatus }>("/api/admin/core/google-contacts")).data)
    } catch {
      setSync(null)
    }
  }, [])
  useEffect(() => {
    void loadSync()
    const code = new URLSearchParams(window.location.search).get("google")
    if (code && GOOGLE_RETURN[code]) {
      setToast(GOOGLE_RETURN[code])
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [loadSync])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.undo ? UNDO_MS : 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get("tab") as Tab | null
    if (view === "records" && q === "waiting") return void window.location.replace("/admin/todo")
    if (view === "records" && q && TABS.includes(q)) setTab(q)
    // Links from elsewhere (the new-inquiry email, a person's history, the old /admin/inbox address):
    // ?search= fills the search box, ?open= opens that arrival once the inbox has loaded.
    const search = params.get("search")
    if (search) setQuery(search)
    const open = params.get("open")
    if (open) pendingOpen.current = open
    // Leaving the page sends a held dismissal at once, so the decision is not lost.
    return () => {
      const held = heldDismiss.current
      if (held) {
        clearTimeout(held.timer)
        held.send()
      }
    }
  }, [view])

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/review/waiting", { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        // Not the founder: no drafts, and Waiting on you holds their inbox arrivals only.
        setDrafts([])
        return
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "To do could not be read")
      setDrafts(body.items ?? [])
      setHolds(new Map(((body.holds ?? []) as HeldArrival[]).map((h) => [h.activityId, h])))
      setPoliRows((body.poli ?? []) as PoliRow[])
    } catch (e) {
      setDrafts([])
      setToast({ type: "error", message: (e as Error).message })
    }
  }, [])
  useEffect(() => {
    void loadDrafts()
    void (async () => {
      try {
        const c = (await api<{ controls: { stopped: boolean; skills: Record<string, string>; sends: Record<string, boolean> } }>("/api/admin/agent/controls")).controls
        setAgents({ stopped: c.stopped, mode: c.skills["434-intake-qualification"] ?? "off", sends: c.sends.intake_reply === true })
      } catch {
        setAgents(null)
      }
    })()
  }, [loadDrafts])

  /** The pending draft for each inbox arrival, by its Activity id. */
  const draftFor = useMemo(() => {
    const m = new Map<string, DraftItem>()
    for (const d of drafts ?? []) if (d.status === "pending" && d.activityId && !m.has(d.activityId)) m.set(d.activityId, d)
    return m
  }, [drafts])

  useEffect(() => {
    const id = pendingOpen.current
    if (!id || inbox === null || drafts === null) return
    pendingOpen.current = null
    const d = draftFor.get(id)
    if (d) return setOpenDraft(d)
    const item = inbox.find((i) => i.activity.id === id)
    if (item) setOpenActivity(item)
    else setToast({ type: "success", message: "That inquiry has already been handled. Search finds the person." })
  }, [inbox, drafts, draftFor])

  const loadInbox = useCallback(async () => {
    try {
      const r = await api<{ data: InboxItem[]; warnings: string[] }>("/api/admin/core/inbox")
      setInbox(r.data)
      setWarnings(r.warnings ?? [])
    } catch (e) {
      setInbox([])
      setToast({ type: "error", message: (e as Error).message })
    }
  }, [])
  const loadPeople = useCallback(async () => {
    try {
      setPeople((await api<{ data: PersonRow[] }>("/api/admin/core/people")).data)
    } catch (e) {
      setPeople([])
      setToast({ type: "error", message: (e as Error).message })
    }
  }, [])
  const loadOrgs = useCallback(async () => {
    try {
      setOrgs((await api<{ data: OrgRow[] }>("/api/admin/core/organizations")).data)
    } catch (e) {
      setOrgs([])
      setToast({ type: "error", message: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if ((tab === "inbox" || tab === "waiting") && inbox === null) void loadInbox()
    if (tab === "people" && people === null) void loadPeople()
    if (tab === "organizations" && orgs === null) void loadOrgs()
  }, [tab, inbox, people, orgs, loadInbox, loadPeople, loadOrgs])

  const whoOf = (item: InboxItem) => item.person?.name || item.activity.contact.name || item.activity.contact.email || "Item"
  const doneMessage = (item: InboxItem, decision: Decision, relationship?: Relationship) =>
    decision === "promote"
      ? `${whoOf(item)} is now a lead.`
      : decision === "save"
        ? `${whoOf(item)} saved as ${relationship === "personal" ? "a personal contact" : "a contact"}.`
        : isPhoneArrival(item.activity)
          ? "Dismissed. Nothing was kept; the contact stays on the phone."
          : "Dismissed."
  const putBack = (item: InboxItem) =>
    setInbox((cur) => (cur && !cur.some((i) => i.activity.id === item.activity.id) ? [item, ...cur].sort((a, b) => b.activity.occurred_at.localeCompare(a.activity.occurred_at)) : cur))

  const undoTriage = async (activityId: string, item: InboxItem) => {
    try {
      await api(`/api/admin/core/inbox/${encodeURIComponent(activityId)}/triage/undo`, { method: "POST" })
      putBack(item)
      setInbox(null)
      setPeople(null)
      setToast({ type: "success", message: `Undone. ${whoOf(item)} is back in the inbox.` })
    } catch (e) {
      setToast({ type: "error", message: (e as Error).message })
    }
  }

  /** Dismiss: spam or solicitation, on an arrival with no draft: asks once, then sends nothing and closes it. */
  const dismissSolicitation = async (item: InboxItem) => {
    const id = item.activity.id
    if (confirmingDismiss !== id) return setConfirmingDismiss(id)
    setConfirmingDismiss(null)
    setBusy(id)
    try {
      const res = await fetch("/api/admin/review/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId: id }) })
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) throw new Error(String(body.error ?? "The dismissal was not recorded"))
      setInbox((cur) => (cur ?? []).filter((i) => i.activity.id !== id))
      setOpenActivity(null)
      const o = dismissOutcome(body)
      setToast({ type: o.type, message: o.message })
      void loadDrafts()
    } catch (e) {
      setToast({ type: "error", message: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const triage: Triage = async (item, decision, relationship) => {
    const remove = () => setInbox((cur) => (cur ?? []).filter((i) => i.activity.id !== item.activity.id))
    // A phone arrival's dismissal stores nothing, so there would be nothing to restore: it is held for the undo
    // window and sent when the window closes (or at once if the page is left).
    if (decision === "dismiss" && isPhoneArrival(item.activity)) {
      const prior = heldDismiss.current
      if (prior) {
        clearTimeout(prior.timer)
        prior.send()
      }
      const send = () => {
        heldDismiss.current = null
        void api(`/api/admin/core/inbox/${encodeURIComponent(item.activity.id)}/triage`, { method: "POST", keepalive: true, body: JSON.stringify({ decision }) }).catch((e) => {
          putBack(item)
          setToast({ type: "error", message: (e as Error).message })
        })
      }
      heldDismiss.current = { timer: setTimeout(send, UNDO_MS), send }
      remove()
      setOpenActivity(null)
      setToast({
        type: "success",
        message: doneMessage(item, decision),
        undo: () => {
          const held = heldDismiss.current
          if (held) clearTimeout(held.timer)
          heldDismiss.current = null
          putBack(item)
          setToast({ type: "success", message: `Undone. ${whoOf(item)} is back in the inbox.` })
        },
      })
      return
    }
    setBusy(item.activity.id)
    try {
      const r = await api<{ data?: { activityId?: string } }>(`/api/admin/core/inbox/${encodeURIComponent(item.activity.id)}/triage`, {
        method: "POST",
        body: JSON.stringify({ decision, relationship }),
      })
      remove()
      setPeople(null)
      setOpenActivity(null)
      const decidedOn = r.data?.activityId
      setToast({
        type: "success",
        message: doneMessage(item, decision, relationship),
        ...(decidedOn ? { undo: () => void undoTriage(decidedOn, item) } : {}),
      })
    } catch (e) {
      setToast({ type: "error", message: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const q = query.trim().toLowerCase()
  const shownInbox = useMemo(
    () =>
      (inbox ?? []).filter((i) =>
        !q ||
        [i.activity.contact.name, i.activity.contact.email, i.activity.contact.company, i.activity.summary]
          .join(" ")
          .toLowerCase()
          .includes(q),
      ),
    [inbox, q],
  )
  const shownPeople = useMemo(
    () => (people ?? []).filter((p) => !q || [p.name, ...p.emails, ...p.organizations].join(" ").toLowerCase().includes(q)),
    [people, q],
  )
  const shownOrgs = useMemo(
    () => (orgs ?? []).filter((o) => !q || `${o.name} ${o.domain ?? ""}`.toLowerCase().includes(q)),
    [orgs, q],
  )

  // The combined count: one per arrival, an arrival with a draft counted once (lib/core-model/waiting.ts).
  const waitingCount = drafts && inbox ? waitingRows(drafts, inbox).length : undefined
  const tabs: Array<{ id: Tab; label: string; icon: typeof Inbox; count?: number }> = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: inbox?.length },
    { id: "people", label: "People", icon: Users, count: people?.length },
    { id: "organizations", label: "Organizations", icon: Building2, count: orgs?.length },
  ]

  return (
    <div className="min-dvh bg-neutral-50 text-neutral-900">
      {toast && (
        <div className="fixed top-[max(env(safe-area-inset-top),0.75rem)] inset-x-3 sm:inset-x-auto sm:top-20 sm:right-4 z-50 flex justify-center sm:block">
          <div
            role="status"
            className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium w-full sm:w-auto sm:max-w-sm ${
              toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  const u = toast.undo
                  setToast(null)
                  u?.()
                }}
                className="shrink-0 rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
              >
                Undo
              </button>
            )}
            <button onClick={() => setToast(null)} aria-label="Dismiss notification" className="shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-neutral-900">{view === "todo" ? "To do" : "People"}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {view === "todo"
              ? `Everything waiting on you: drafts to approve and arrivals to decide${typeof waitingCount === "number" ? ` (${waitingCount})` : ""}.`
              : "One record per person and per company. Every way in lands in the Inbox until someone decides what it is."}
          </p>
          {agents && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <Power className={`w-3.5 h-3.5 ${agents.stopped ? "text-red-600" : "text-green-600"}`} />
              <span className="text-neutral-700">{agents.stopped ? "Agents stopped" : "Agents running"}</span>
              <span>· Intake <span className="capitalize">{agents.mode}</span> · Sends {agents.sends ? "on" : "off"} ·</span>
              <Link href="/admin/agents" className="font-medium text-neutral-800 underline underline-offset-2">Agents page</Link>
            </p>
          )}
        </div>

        {/* The front door's Today card: founder only (the agents line above is read from a founder-only route). */}
        {view === "todo" && agents && <TodayCard />}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          {view === "records" && <div role="tablist" className="flex gap-1 rounded-lg bg-white border border-neutral-200 p-1 w-full sm:w-auto overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  tab === t.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {typeof t.count === "number" && <span className={tab === t.id ? "text-neutral-300" : "text-neutral-400"}>{t.count}</span>}
              </button>
            ))}
          </div>}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or company"
              className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
          {tab === "people" && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
            >
              <UserPlus className="w-4 h-4" /> Add person
            </button>
          )}
        </div>

        {founder && sync && <GoogleContactsBar status={sync} onChange={loadSync} onToast={setToast} />}

        {warnings.length > 0 && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Partial view: {warnings.join("; ")}.
          </p>
        )}

        {tab === "waiting" && (
          <WaitingOnYou
            drafts={drafts ?? []}
            inbox={shownInbox}
            loading={drafts === null || inbox === null}
            onOpen={setOpenDraft}
            onOpenArrival={setOpenActivity}
            actions={(item) => <TriageButtons item={item} busy={busy === item.activity.id} founder={founder} onTriage={triage} />}
            sourceLabel={(item) => `${SOURCE_LABEL[item.activity.source] ?? item.activity.source}${item.activity.channel ? ` · ${item.activity.channel}` : ""}`}
            holds={holds}
            poli={poliRows}
            {...(founder ? { onDismissSolicitation: (item: InboxItem) => void dismissSolicitation(item) } : {})}
            dismissing={busy}
            confirmingDismiss={confirmingDismiss}
          />
        )}
        {tab === "inbox" && (
          <InboxList
            items={shownInbox}
            loading={inbox === null}
            busy={busy}
            founder={founder}
            drafts={draftFor}
            onTriage={triage}
            onOpen={(i) => {
              const d = draftFor.get(i.activity.id)
              if (d) setOpenDraft(d)
              else setOpenActivity(i)
            }}
          />
        )}
        {tab === "people" && <PeopleList rows={shownPeople} loading={people === null} onOpen={setOpenPerson} />}
        {tab === "organizations" && <OrgList rows={shownOrgs} loading={orgs === null} onOpen={setOpenOrg} />}
      </main>

      <ActivityDrawer
        item={openActivity}
        busy={busy}
        founder={founder}
        onClose={() => setOpenActivity(null)}
        onTriage={triage}
        onReplied={(closed) => {
          setOpenActivity(null)
          setToast(
            closed
              ? { type: "success", message: "Reply sent. The inquiry is saved as a contact and has left the inbox." }
              : { type: "error", message: "Reply sent, but the inquiry is still in the inbox. Save or Dismiss it." },
          )
          void loadInbox()
        }}
        onError={(message) => setToast({ type: "error", message })}
      />
      <DraftDrawer
        item={openDraft}
        onClose={() => setOpenDraft(null)}
        onEdited={(next) => {
          setOpenDraft(next)
          setDrafts((cur) => (cur ?? []).map((d) => (d.id === next.id ? next : d)))
        }}
        onDone={(o) => {
          setOpenDraft(null)
          setToast({ type: o.type, message: o.message })
          if (o.changed) {
            void loadDrafts()
            setInbox(null)
            setPeople(null)
          }
        }}
      />
      <PersonDrawer
        id={openPerson}
        founder={founder}
        onClose={() => setOpenPerson(null)}
        onOpenOrg={(id) => { setOpenPerson(null); setOpenOrg(id) }}
        onChanged={(message, newId) => {
          setPeople(null)
          setOrgs(null)
          if (newId) setOpenPerson(newId)
          setToast({ type: "success", message })
        }}
        onError={(message) => setToast({ type: "error", message })}
      />
      <OrgDrawer
        id={openOrg}
        onClose={() => setOpenOrg(null)}
        onOpenPerson={(id) => { setOpenOrg(null); setOpenPerson(id) }}
        onChanged={(message, newId) => {
          setOrgs(null)
          setPeople(null)
          if (newId) setOpenOrg(newId)
          setToast({ type: "success", message })
        }}
        onError={(message) => setToast({ type: "error", message })}
      />
      <AddPersonDrawer
        open={adding}
        founder={founder}
        onClose={() => setAdding(false)}
        onAdded={(name) => {
          setAdding(false)
          setPeople(null)
          setToast({ type: "success", message: `${name} added.` })
        }}
        onError={(message) => setToast({ type: "error", message })}
      />
    </div>
  )
}

// ── Lists ───────────────────────────────────────────────────────────────────────────────────────────────────────

function Empty({ loading, text }: { loading: boolean; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-500">
      {loading ? "Loading…" : text}
    </div>
  )
}

function InboxList({
  items,
  loading,
  busy,
  founder,
  drafts,
  onTriage,
  onOpen,
}: {
  items: InboxItem[]
  loading: boolean
  busy: string | null
  founder: boolean
  drafts: Map<string, DraftItem>
  onTriage: Triage
  onOpen: (i: InboxItem) => void
}) {
  if (loading || items.length === 0) return <Empty loading={loading} text="Nothing waiting. Every arrival has been triaged." />
  return (
    <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {items.map((item) => {
        const a = item.activity
        const name = item.person?.name || a.contact.name || a.contact.email || "Unknown"
        return (
          <li key={a.id} className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
            <button onClick={() => onOpen(item)} className="flex-1 min-w-0 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-900">{name}</span>
                {a.contact.company && <span className="text-xs text-neutral-500">{a.contact.company}</span>}
                <Pill>{SOURCE_LABEL[a.source] ?? a.source}{a.channel ? ` · ${a.channel}` : ""}</Pill>
                {a.relationship === "personal" && <PersonalPill />}
                {drafts.has(a.id) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white" title="An agent drafted a reply. Open to read, edit, approve or reject it.">
                    <FileText className="w-2.5 h-2.5" /> Draft ready
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{a.summary}</p>
            </button>
            <div className="flex items-center gap-3 md:w-28 text-xs text-neutral-500">
              <Fit org={item.organization} />
              <span className="ml-auto md:ml-0">{when(a.occurred_at)}</span>
            </div>
            <TriageButtons item={item} busy={busy === a.id} founder={founder} onTriage={onTriage} />
          </li>
        )
      })}
    </ul>
  )
}

function PersonalPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600" title="Personal: seen by the founder only">
      <Lock className="w-2.5 h-2.5" /> Personal
    </span>
  )
}

function TriageButtons({
  item,
  busy,
  founder,
  onTriage,
}: {
  item: InboxItem
  busy: boolean
  founder: boolean
  onTriage: Triage
}) {
  const hasEmail = Boolean(item.activity.contact.email)
  // A phone arrival: one tap decides personal, business or lead (spec, "How a person gets in"). Personal is the
  // founder's alone.
  if (isPhoneArrival(item.activity) && founder) {
    const btn = "inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          disabled={busy || !hasEmail}
          title={hasEmail ? "Make this person a business lead" : "A lead needs an email address"}
          onClick={() => onTriage(item, "promote")}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          <Flag className="w-3.5 h-3.5" /> Lead
        </button>
        <button disabled={busy} onClick={() => onTriage(item, "save", "personal")} className={btn}>
          <Lock className="w-3.5 h-3.5" /> Personal
        </button>
        <button disabled={busy} onClick={() => onTriage(item, "save", "business")} className={btn}>
          <Briefcase className="w-3.5 h-3.5" /> Business
        </button>
        <button
          disabled={busy}
          onClick={() => onTriage(item, "dismiss")}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        >
          Dismiss
        </button>
      </div>
    )
  }
  return (
    <div className="flex gap-1.5">
      <button
        disabled={busy || !hasEmail}
        title={hasEmail ? "Make this person a lead" : "A lead needs an email address"}
        onClick={() => onTriage(item, "promote")}
        className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
      >
        <Flag className="w-3.5 h-3.5" /> Lead
      </button>
      <button
        disabled={busy}
        onClick={() => onTriage(item, "save")}
        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
      >
        <Bookmark className="w-3.5 h-3.5" /> Save
      </button>
      <button
        disabled={busy}
        onClick={() => onTriage(item, "dismiss")}
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
      >
        Dismiss
      </button>
    </div>
  )
}

function PeopleList({ rows, loading, onOpen }: { rows: PersonRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading || rows.length === 0) return <Empty loading={loading} text="No people match." />
  return (
    <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {rows.slice(0, 500).map((p) => (
        <li key={p.id}>
          <button onClick={() => onOpen(p.id)} className="w-full flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3 text-left hover:bg-neutral-50">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-neutral-900">{p.name}</span>
              <span className="ml-2 text-xs text-neutral-500">{p.emails[0]}</span>
            </div>
            <span className="text-xs text-neutral-500 truncate sm:w-48">{p.organizations.join(", ")}</span>
            <div className="flex gap-1.5">
              <Pill tone={p.lifecycle_stage === "contact" ? "neutral" : "dark"}>{STAGE_LABEL[p.lifecycle_stage]}</Pill>
              {p.relationship === "personal" && <PersonalPill />}
              {p.visibility === "restricted" && <Pill>Restricted</Pill>}
            </div>
          </button>
        </li>
      ))}
      {rows.length > 500 && <li className="px-4 py-3 text-xs text-neutral-500">Showing 500 of {rows.length}. Search to narrow.</li>}
    </ul>
  )
}

function OrgList({ rows, loading, onOpen }: { rows: OrgRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading || rows.length === 0) return <Empty loading={loading} text="No organizations match." />
  return (
    <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {rows.slice(0, 500).map((o) => (
        <li key={o.id}>
          <button onClick={() => onOpen(o.id)} className="w-full flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3 text-left hover:bg-neutral-50">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-neutral-900">{o.name}</span>
              {o.domain && <span className="ml-2 text-xs text-neutral-500">{o.domain}</span>}
            </div>
            <div className="flex items-center gap-3">
              {o.own && <Pill>434</Pill>}
              {o.roles.map((r) => <Pill key={r}>{r}</Pill>)}
              <span className="text-xs text-neutral-500">{o.people_count} {o.people_count === 1 ? "person" : "people"}</span>
              <Fit org={o} />
            </div>
          </button>
        </li>
      ))}
      {rows.length > 500 && <li className="px-4 py-3 text-xs text-neutral-500">Showing 500 of {rows.length}. Search to narrow.</li>}
    </ul>
  )
}

// ── Drawers ─────────────────────────────────────────────────────────────────────────────────────────────────────

function Timeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return <p className="text-sm text-neutral-500">No activity yet.</p>
  return (
    <ol className="space-y-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-lg border border-neutral-200 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="font-medium text-neutral-800">{a.summary}</span>
            <Pill>{SOURCE_LABEL[a.source] ?? a.source}</Pill>
            <span className="ml-auto">{when(a.occurred_at)}</span>
          </div>
          {a.email && (
            <p className="mt-1 text-xs text-neutral-500">
              {a.email.direction === "sent" ? "To" : "From"} {a.email.direction === "sent" ? a.email.to.join(", ") : a.email.from}
            </p>
          )}
          {a.body && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{a.body}</p>}
          {a.change && a.change.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-neutral-600">
              {a.change.map((c, i) => (
                <li key={i}>
                  <span className="font-medium text-neutral-800">{c.field}</span>: kept {c.winner === "google" ? "the phone's" : "the CRM's"} edit; replaced{" "}
                  <span className="font-mono">{short(c.before)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

function short(v: unknown): string {
  const t = typeof v === "string" ? v : JSON.stringify(v ?? null)
  return t.length > 120 ? `${t.slice(0, 119)}…` : t
}

const dateText = (d?: { year?: number; month?: number; day?: number; text?: string }) =>
  !d ? "" : d.text || [d.month, d.day, d.year].filter((x) => typeof x === "number").join("/")

/** The whole Google record, under Google's meanings. Read only here; edits go through the Person's fields. */
function AddressBookFields({ book }: { book: AddressBook }) {
  const rows: Array<[string, string]> = [
    ["Emails", book.emails.map((e) => (e.type ? `${e.value} (${e.type})` : e.value)).join(", ")],
    ["Phones", book.phones.map((e) => (e.type ? `${e.value} (${e.type})` : e.value)).join(", ")],
    ["Company", book.organizations.map((o) => [o.title, o.name].filter(Boolean).join(", ")).join("; ")],
    ["Addresses", book.addresses.map((a) => a.formatted || [a.street, a.city, a.region, a.postal_code, a.country].filter(Boolean).join(", ")).join("; ")],
    ["Birthday", dateText(book.birthday)],
    ["Dates", book.events.map((e) => `${e.type ?? "Date"} ${dateText(e.date)}`).join(", ")],
    ["Websites", book.urls.map((u) => u.value).join(", ")],
    ["Related", book.relations.map((r) => (r.type ? `${r.person} (${r.type})` : r.person)).join(", ")],
    ["Custom", book.custom_fields.map((c) => `${c.key}: ${c.value}`).join(", ")],
    ["Labels", book.labels.join(", ")],
    ["Notes", book.notes ?? ""],
  ]
  const shown = rows.filter(([, v]) => v)
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Address book</h3>
      {shown.length === 0 ? (
        <p className="text-sm text-neutral-500">None linked.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map(([label, value]) => (
            <Field key={label} label={label}>
              <span className="whitespace-pre-wrap">{value}</span>
            </Field>
          ))}
        </dl>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{children || "—"}</dd>
    </div>
  )
}

function ActivityDrawer({
  item,
  busy,
  founder,
  onClose,
  onTriage,
  onReplied,
  onError,
}: {
  item: InboxItem | null
  busy: string | null
  founder: boolean
  onClose: () => void
  onTriage: Triage
  /** After a hand-written reply is sent; `closed` says whether the arrival left the inbox. */
  onReplied: (closed: boolean) => void
  onError: (message: string) => void
}) {
  const a = item?.activity
  const [replying, setReplying] = useState(false)
  useEffect(() => setReplying(false), [a?.id])
  // A website inquiry with no agent draft (the agent is off or stopped, or the founder answers himself) is answered
  // here, through the same reply route the old /admin/inbox used.
  const formId = a?.id.startsWith(CONTACT_FORM_PREFIX) && a.contact.email ? a.id.slice(CONTACT_FORM_PREFIX.length) : null
  const [first, ...rest] = (a?.contact.name ?? "").trim().split(/\s+/)
  return (
    <DetailDrawer
      open={Boolean(item)}
      onClose={onClose}
      title={item?.person?.name || a?.contact.name || a?.contact.email || ""}
      subtitle={a ? `${SOURCE_LABEL[a.source] ?? a.source}${a.channel ? ` · ${a.channel}` : ""} · ${when(a.occurred_at)}` : undefined}
      footer={
        item ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {formId ? (
              <button
                onClick={() => setReplying(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
              >
                <Reply className="w-3.5 h-3.5" /> Write reply
              </button>
            ) : (
              <span />
            )}
            <TriageButtons item={item} busy={busy === item.activity.id} founder={founder} onTriage={onTriage} />
          </div>
        ) : undefined
      }
    >
      {formId && a && (
        <InboxReplyModal
          open={replying}
          submission={{ id: formId, firstName: first ?? "", lastName: rest.join(" "), email: a.contact.email!, message: a.body || a.summary, source: a.source }}
          onClose={() => setReplying(false)}
          onSent={(_, closed) => {
            setReplying(false)
            onReplied(closed)
          }}
          onError={onError}
        />
      )}
      {a && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Email">{a.contact.email}</Field>
            <Field label="Phone">{a.contact.phone}</Field>
            <Field label="Company">{a.contact.company}</Field>
            <Field label="Fit">{item?.organization ? <Fit org={item.organization} /> : null}</Field>
            <Field label="Stage">{item?.person ? STAGE_LABEL[item.person.lifecycle_stage] : "New"}</Field>
            {a.relationship && <Field label="Arrives as">{a.relationship === "personal" ? "Personal" : "Business"}</Field>}
          </dl>
          {a.address_book ? (
            <AddressBookFields book={a.address_book} />
          ) : (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Message</h3>
              <p className="whitespace-pre-wrap text-sm text-neutral-800">{a.body || a.summary}</p>
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}

interface PersonDetail {
  person: Person
  affiliations: Array<Affiliation & { organization?: Organization }>
  activities: Activity[]
  cold_gate: { allowed: boolean; cold: boolean; reason: string }
  email_allowed: { allowed: boolean; reason: string }
}

function PersonDrawer({
  id,
  founder,
  onClose,
  onOpenOrg,
  onChanged,
  onError,
}: {
  id: string | null
  founder: boolean
  onClose: () => void
  onOpenOrg: (id: string) => void
  /** `newId` when the edit saved a record read from an old collection: the drawer reopens on the saved one. */
  onChanged: (message: string, newId?: string) => void
  onError: (message: string) => void
}) {
  const [detail, setDetail] = useState<PersonDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [id])
  const load = useCallback(() => {
    setDetail(null)
    setError(null)
    if (!id) return
    api<{ data: PersonDetail }>(`/api/admin/core/people/${encodeURIComponent(id)}`)
      .then((r) => setDetail(r.data))
      .catch((e) => setError((e as Error).message))
  }, [id])
  useEffect(load, [load])
  const p = detail?.person
  const makeBusiness = async () => {
    if (!p) return
    setSaving(true)
    try {
      await api(`/api/admin/core/people/${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify({ relationship: "business" }) })
      onChanged(`${p.name} is now a business contact.`)
      load()
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <DetailDrawer
      open={Boolean(id)}
      onClose={onClose}
      title={p?.name ?? (error ? "Not available" : "Loading…")}
      subtitle={p?.emails.join(", ")}
      footer={
        p && !editing ? (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            {founder && p.relationship === "personal" && (
              <button
                onClick={makeBusiness}
                disabled={saving}
                title="Staff will see this person once it is business"
                className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                <Briefcase className="w-3.5 h-3.5" /> Make business
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {p && detail && editing && (
        <PersonEditForm
          detail={detail}
          founder={founder}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false)
            const replaced = saved.id !== p.id
            onChanged(replaced ? `${saved.name} saved. It now replaces the record read from the old list.` : `${saved.name} updated.`, replaced ? saved.id : undefined)
            if (!replaced) load()
          }}
          onError={onError}
        />
      )}
      {p && detail && !editing && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Stage">{STAGE_LABEL[p.lifecycle_stage]}</Field>
            <Field label="First touch">{SOURCE_LABEL[p.source] ?? p.source}</Field>
            <Field label="Email consent">{detail.email_allowed.reason}</Field>
            <Field label="Cold outreach">{detail.cold_gate.cold ? `${detail.cold_gate.allowed ? "Allowed" : "Blocked"}: ${detail.cold_gate.reason}` : "Not cold"}</Field>
            <Field label="Phone">{p.phones.join(", ")}</Field>
            <Field label="Relationship">{p.relationship === "personal" ? "Personal (founder only)" : "Business"}</Field>
            <Field label="Visibility">{p.visibility === "private" ? "Private" : p.visibility === "restricted" ? "Restricted" : "Business"}</Field>
            <Field label="Roles">{p.roles.join(", ")}</Field>
            <Field label="Read from">{p.legacy_refs.map((r) => r.collection).filter((c, i, all) => all.indexOf(c) === i).join(", ") || "Stored"}</Field>
            {p.google && (
              <Field label="Google Contacts">
                {p.google.deleted_at ? "Deleted in Google; kept here" : p.google.in_434_group ? "Synced, in the 434 group" : "Synced"}
              </Field>
            )}
          </dl>
          {p.address_book && <AddressBookFields book={p.address_book} />}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Organizations</h3>
            {detail.affiliations.length === 0 ? (
              <p className="text-sm text-neutral-500">None linked.</p>
            ) : (
              <ul className="space-y-1">
                {detail.affiliations.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => onOpenOrg(a.organization_id)} className="text-sm text-neutral-800 underline-offset-2 hover:underline">
                      {a.organization?.name ?? a.organization_id}
                    </button>
                    <span className="ml-2 text-xs text-neutral-500">{a.role}{a.title ? ` · ${a.title}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Activity</h3>
            <Timeline activities={detail.activities} />
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}

interface OrgDetail {
  organization: Organization
  affiliations: Array<Affiliation & { person?: Person }>
  activities: Activity[]
}

/** Where an Organization's record comes from, in words: the stored record and each old collection it was read from. */
const RECORD_SOURCE_LABEL: Record<string, string> = {
  leads: "Lead",
  crm_clients: "Client",
  contact_forms: "Website form",
  "aimsatx/contact_submissions": "AIM form",
}
function sourcesOf(o: Organization): string {
  const parts = o.read_only ? [] : ["Saved here"]
  for (const r of o.legacy_refs) parts.push(RECORD_SOURCE_LABEL[r.collection] ?? r.collection)
  return Array.from(new Set(parts)).join(", ")
}

const LOOKUP_LABEL: Record<string, string> = {
  pending: "In progress",
  matched: "Found",
  no_match: "Not found",
  mismatch: "Found at another company; nothing filled",
  error: "Failed; will retry",
}

function OrgDrawer({
  id,
  onClose,
  onOpenPerson,
  onChanged,
  onError,
}: {
  id: string | null
  onClose: () => void
  onOpenPerson: (id: string) => void
  onChanged: (message: string, newId?: string) => void
  onError: (message: string) => void
}) {
  const [detail, setDetail] = useState<OrgDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [id])
  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!id) return
    api<{ data: OrgDetail }>(`/api/admin/core/organizations/${encodeURIComponent(id)}`)
      .then((r) => setDetail(r.data))
      .catch((e) => setError((e as Error).message))
  }, [id, reload])
  const o = detail?.organization
  return (
    <DetailDrawer
      open={Boolean(id)}
      onClose={onClose}
      title={o?.name ?? (error ? "Not available" : "Loading…")}
      subtitle={o?.domain}
      footer={
        o && !editing ? (
          <div className="flex justify-end">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        ) : undefined
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {o && detail && editing && (
        <OrgEditForm
          org={o}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false)
            const replaced = saved.id !== o.id
            onChanged(replaced ? `${saved.name} saved. It now replaces the record read from the old list.` : `${saved.name} updated.`, replaced ? saved.id : undefined)
            if (!replaced) setReload((n) => n + 1)
          }}
          onError={onError}
        />
      )}
      {o && detail && !editing && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Fit">{o.own ? "434" : <Fit org={o} />}</Field>
            <Field label="Roles">{o.roles.join(", ")}</Field>
            <Field label="Domain">{o.domain}</Field>
            <Field label="Comes from">{sourcesOf(o)}</Field>
            <Field label="Industry">{o.industry}</Field>
            <Field label="Location">{o.location}</Field>
            {o.company_lookup && (
              <Field label="Company lookup">
                {LOOKUP_LABEL[o.company_lookup.status] ?? o.company_lookup.status}
                {o.company_lookup.at ? `, ${o.company_lookup.at.slice(0, 10)}` : ""}
              </Field>
            )}
            {o.icp_review && <Field label="Needs review">{o.icp_review}</Field>}
          </dl>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">People</h3>
            {detail.affiliations.length === 0 ? (
              <p className="text-sm text-neutral-500">None linked.</p>
            ) : (
              <ul className="space-y-1">
                {detail.affiliations.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => onOpenPerson(a.person_id)} className="text-sm text-neutral-800 underline-offset-2 hover:underline">
                      {a.person?.name ?? a.person_id}
                    </button>
                    <span className="ml-2 text-xs text-neutral-500">{a.role}{a.title ? ` · ${a.title}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Activity</h3>
            <Timeline activities={detail.activities} />
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}

// ── Edit forms ───────────────────────────────────────────────────────────────────────────────────────────────
// One edit for every record. A record read from an old list (a lead, a client, a form) is saved as a new record that
// replaces it; the old list is never changed. The server holds every rule (lib/core-model/edit.ts); these forms only
// offer what may change.

const inputClass = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
const listText = (v: string[]) => v.join(", ")
const textList = (v: string) => v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)

function FormRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  )
}

function RolePicker<R extends string>({ all, value, onChange }: { all: readonly R[]; value: R[]; onChange: (v: R[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((r) => {
        const on = value.includes(r)
        return (
          <button
            key={r}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${on ? "bg-neutral-900 text-white ring-neutral-900" : "text-neutral-600 ring-neutral-200 hover:bg-neutral-100"}`}
          >
            {r}
          </button>
        )
      })}
    </div>
  )
}

function FormButtons({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
      <button type="button" onClick={onSave} disabled={saving} className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  )
}

/** "" is the "New organization…" choice. */
type LinkRow = { organization_id: string; new_name: string; new_domain: string; role: AffiliationRole; title: string }

function PersonEditForm({
  detail,
  founder,
  onCancel,
  onSaved,
  onError,
}: {
  detail: PersonDetail
  founder: boolean
  onCancel: () => void
  onSaved: (person: Person) => void
  onError: (message: string) => void
}) {
  const p = detail.person
  const [name, setName] = useState(p.name)
  const [emails, setEmails] = useState(listText(p.emails))
  const [phones, setPhones] = useState(listText(p.phones))
  const [title, setTitle] = useState(p.title ?? "")
  const [stage, setStage] = useState<LifecycleStage>(p.lifecycle_stage)
  const [roles, setRoles] = useState<CoreRole[]>(p.roles)
  const [relationship, setRelationship] = useState<Relationship>(p.relationship)
  const [links, setLinks] = useState<LinkRow[]>(
    detail.affiliations.map((a) => ({ organization_id: a.organization_id, new_name: "", new_domain: "", role: a.role, title: a.title ?? "" })),
  )
  const [orgs, setOrgs] = useState<Organization[] | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api<{ data: Organization[] }>("/api/admin/core/organizations")
      .then((r) => setOrgs(r.data))
      .catch(() => setOrgs([]))
  }, [])
  // A client never reverts: once a customer, the stage stays.
  const stages: LifecycleStage[] = p.lifecycle_stage === "customer" ? ["customer"] : ["contact", "lead", "customer"]
  const setLink = (i: number, patch: Partial<LinkRow>) => setLinks(links.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const orgOptions = useMemo(() => {
    const known = new Map((orgs ?? []).map((o) => [o.id, o]))
    for (const a of detail.affiliations) if (a.organization && !known.has(a.organization_id)) known.set(a.organization_id, a.organization)
    return [...known.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [orgs, detail.affiliations])

  const save = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name,
        emails: textList(emails),
        phones: textList(phones),
        title,
        lifecycle_stage: stage,
        roles,
        links: links.map((l) =>
          l.organization_id
            ? { organization_id: l.organization_id, role: l.role, title: l.title }
            : { create: { name: l.new_name, domain: l.new_domain }, role: l.role, title: l.title },
        ),
      }
      if (founder) body.relationship = relationship
      const r = await api<{ data: Person }>(`/api/admin/core/people/${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify(body) })
      onSaved(r.data)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {p.read_only && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Read from {p.legacy_refs.map((r) => RECORD_SOURCE_LABEL[r.collection] ?? r.collection).filter((c, i, all) => all.indexOf(c) === i).join(", ")}. Saving keeps a new record that replaces it here; the old list is not changed.
        </p>
      )}
      {p.google && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Synced with Google Contacts. Changes to the name, emails, phones and title go to the phone when write-back is on; until then they wait here.
        </p>
      )}
      <FormRow label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></FormRow>
      <FormRow label="Emails" hint="Separate with commas. The first is the primary."><input value={emails} onChange={(e) => setEmails(e.target.value)} className={inputClass} /></FormRow>
      <FormRow label="Phones" hint="Separate with commas."><input value={phones} onChange={(e) => setPhones(e.target.value)} className={inputClass} /></FormRow>
      <FormRow label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></FormRow>
      <FormRow label="Stage" hint={p.lifecycle_stage === "customer" ? "A client never goes back to lead or contact." : undefined}>
        <select value={stage} onChange={(e) => setStage(e.target.value as LifecycleStage)} className={inputClass}>
          {stages.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </FormRow>
      <div>
        <span className="mb-1 block text-xs font-medium text-neutral-600">Roles</span>
        <RolePicker all={CORE_ROLES} value={roles} onChange={setRoles} />
      </div>
      {founder && (
        <fieldset>
          <legend className="mb-1 block text-xs font-medium text-neutral-600">Personal or business</legend>
          <div role="radiogroup" className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1">
            {(["personal", "business"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={relationship === r}
                onClick={() => setRelationship(r)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${relationship === r ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
              >
                {r === "personal" ? "Personal (only you)" : "Business"}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <span className="mb-1 block text-xs font-medium text-neutral-600">Organizations</span>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-neutral-200 p-2">
              <div className="flex gap-2">
                <select
                  aria-label="Organization"
                  value={l.organization_id}
                  onChange={(e) => setLink(i, { organization_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">New organization…</option>
                  {orgOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}{o.domain ? ` (${o.domain})` : ""}</option>
                  ))}
                </select>
                <button type="button" aria-label="Remove" onClick={() => setLinks(links.filter((_, j) => j !== i))} className="rounded-md px-2 text-neutral-500 hover:bg-neutral-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {!l.organization_id && (
                <div className="flex gap-2">
                  <input placeholder="Name" aria-label="New organization name" value={l.new_name} onChange={(e) => setLink(i, { new_name: e.target.value })} className={inputClass} />
                  <input placeholder="Domain (example.com)" aria-label="New organization domain" value={l.new_domain} onChange={(e) => setLink(i, { new_domain: e.target.value })} className={inputClass} />
                </div>
              )}
              <div className="flex gap-2">
                <select aria-label="Role" value={l.role} onChange={(e) => setLink(i, { role: e.target.value as AffiliationRole })} className={inputClass}>
                  {AFFILIATION_ROLES.map((r) => <option key={r} value={r}>{r === "works_at" ? "works at" : r}</option>)}
                </select>
                <input placeholder="Title" aria-label="Title at this organization" value={l.title} onChange={(e) => setLink(i, { title: e.target.value })} className={inputClass} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLinks([...links, { organization_id: "", new_name: "", new_domain: "", role: "works_at", title: "" }])}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <Plus className="w-3.5 h-3.5" /> Add organization
          </button>
        </div>
      </div>
      <FormButtons saving={saving} onCancel={onCancel} onSave={save} />
    </div>
  )
}

function OrgEditForm({
  org,
  onCancel,
  onSaved,
  onError,
}: {
  org: Organization
  onCancel: () => void
  onSaved: (org: Organization) => void
  onError: (message: string) => void
}) {
  const [name, setName] = useState(org.name)
  const [domain, setDomain] = useState(org.domain ?? "")
  const [roles, setRoles] = useState<CoreRole[]>(org.roles)
  const [industry, setIndustry] = useState(org.industry ?? "")
  const [location, setLocation] = useState(org.location ?? "")
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      const r = await api<{ data: Organization }>(`/api/admin/core/organizations/${encodeURIComponent(org.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name, domain, roles, industry, location }),
      })
      onSaved(r.data)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-3">
      {org.read_only && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Read from {sourcesOf(org)}. Saving keeps a new record that replaces it here; the old list is not changed.
        </p>
      )}
      <FormRow label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></FormRow>
      <FormRow label="Domain" hint="One organization per domain. Leave empty to clear."><input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className={inputClass} /></FormRow>
      <div>
        <span className="mb-1 block text-xs font-medium text-neutral-600">Roles</span>
        <RolePicker all={CORE_ROLES} value={roles} onChange={setRoles} />
        {org.own && <span className="mt-1 block text-xs text-neutral-500">434 is never a prospect or client of itself.</span>}
      </div>
      <FormRow label="Industry"><input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass} /></FormRow>
      <FormRow label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San Antonio, TX" className={inputClass} /></FormRow>
      <FormButtons saving={saving} onCancel={onCancel} onSave={save} />
    </div>
  )
}

function AddPersonDrawer({
  open,
  founder,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean
  founder: boolean
  onClose: () => void
  onAdded: (name: string) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", website: "", title: "", notes: "" })
  // The founder's adds default to personal; staff adds are always business (the server enforces both).
  const [relationship, setRelationship] = useState<Relationship>("personal")
  const [stage, setStage] = useState<"contact" | "lead" | "customer">("contact")
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = async () => {
    setSaving(true)
    try {
      await api("/api/admin/core/people", {
        method: "POST",
        // A lead or customer is always business.
        body: JSON.stringify({ ...form, source: "manual", lifecycle_stage: stage, relationship: founder && stage === "contact" ? relationship : "business" }),
      })
      onAdded(form.name || form.email)
      setForm({ name: "", email: "", phone: "", company: "", website: "", title: "", notes: "" })
      setStage("contact")
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const input = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Add person"
      subtitle="One person per email. An address already on file opens nothing new."
      width="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || (!form.name.trim() && !form.email.trim())}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {founder && stage === "contact" && (
          <fieldset>
            <legend className="mb-1 block text-xs font-medium text-neutral-600">Personal or business</legend>
            <div role="radiogroup" className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1">
              {(["personal", "business"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={relationship === r}
                  onClick={() => setRelationship(r)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${relationship === r ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
                >
                  {r === "personal" ? "Personal (only you)" : "Business"}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={input}>
            <option value="contact">Contact</option>
            <option value="lead">Lead</option>
            <option value="customer">Customer</option>
          </select>
        </label>
        {(
          [
            ["name", "Name"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["title", "Title"],
            ["company", "Company"],
            ["website", "Company website"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
            <input value={form[k]} onChange={set(k)} className={input} />
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Notes</span>
          <textarea value={form.notes} onChange={set("notes")} rows={4} className={input} />
        </label>
      </div>
    </DetailDrawer>
  )
}

// ── Google Contacts (the founder only) ──────────────────────────────────────────────────────────────────────────

function GoogleContactsBar({ status, onChange, onToast }: { status: SyncStatus; onChange: () => void; onToast: (t: Toast) => void }) {
  const [busy, setBusy] = useState(false)
  const call = async (url: string, init: RequestInit, done: string) => {
    setBusy(true)
    try {
      await api(url, init)
      onToast({ type: "success", message: done })
      onChange()
    } catch (e) {
      onToast({ type: "error", message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const last = status.last_result
  const line = !status.configured
    ? "Not configured on this deployment."
    : !status.connected
      ? "Not connected. Connect your personal Google account to bring your contacts in."
      : status.phase === "import"
        ? `Importing your contacts: ${status.linked} so far.`
        : `${status.linked} contacts synced.${status.last_run_at ? ` Last run ${when(status.last_run_at)}` : ""}${last ? `, ${last.arrivals} new in the inbox` : ""}.`
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Contact className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">Google Contacts</p>
          <p className="text-xs text-neutral-500">
            {line}
            {status.connected && (
              <>
                {" "}Write-back is {status.write_back ? "on" : "off"}
                {status.waiting_for_write_back > 0 ? `; ${status.waiting_for_write_back} edit${status.waiting_for_write_back === 1 ? "" : "s"} waiting` : ""}.
              </>
            )}
          </p>
        </div>
      </div>
      {status.configured && (
        <div className="flex flex-wrap gap-1.5">
          {!status.connected ? (
            <a
              href="/api/admin/core/google-contacts/connect"
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Connect
            </a>
          ) : (
            <>
              <button
                disabled={busy}
                onClick={() => call("/api/admin/core/google-contacts/sync", { method: "POST" }, "Sync finished.")}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Sync now
              </button>
              <button
                disabled={busy}
                role="switch"
                aria-checked={status.write_back}
                title="Write your CRM edits back to Google (and your phone). Writes only to contacts in the 434 group; never deletes."
                onClick={() =>
                  call(
                    "/api/admin/core/google-contacts",
                    { method: "PATCH", body: JSON.stringify({ write_back: !status.write_back }) },
                    status.write_back ? "Write-back is off." : "Write-back is on.",
                  )
                }
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${
                  status.write_back ? "bg-neutral-900 text-white hover:bg-neutral-800" : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Write-back {status.write_back ? "on" : "off"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Disconnect Google Contacts? Saved people stay; nothing in Google changes.")) {
                    void call("/api/admin/core/google-contacts/disconnect", { method: "POST" }, "Google Contacts disconnected.")
                  }
                }}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
