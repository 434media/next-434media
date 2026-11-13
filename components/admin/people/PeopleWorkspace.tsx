"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, CheckCircle2, AlertCircle, Inbox, Search, UserPlus, Users, Flag, Bookmark, X } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { Activity, Affiliation, InboxItem, Organization, Person } from "@/types/core-model"

type Tab = "inbox" | "people" | "organizations"
type Toast = { type: "success" | "error"; message: string }
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

export function PeopleWorkspace() {
  const [tab, setTab] = useState<Tab>("inbox")
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

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

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
    if (tab === "inbox" && inbox === null) void loadInbox()
    if (tab === "people" && people === null) void loadPeople()
    if (tab === "organizations" && orgs === null) void loadOrgs()
  }, [tab, inbox, people, orgs, loadInbox, loadPeople, loadOrgs])

  const triage = async (item: InboxItem, decision: "promote" | "save" | "dismiss") => {
    setBusy(item.activity.id)
    try {
      await api(`/api/admin/core/inbox/${encodeURIComponent(item.activity.id)}/triage`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      })
      setInbox((cur) => (cur ?? []).filter((i) => i.activity.id !== item.activity.id))
      setPeople(null)
      setOpenActivity(null)
      const who = item.person?.name || item.activity.contact.name || item.activity.contact.email || "Item"
      setToast({
        type: "success",
        message: decision === "promote" ? `${who} is now a lead.` : decision === "save" ? `${who} saved as a contact.` : "Dismissed.",
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
            <button onClick={() => setToast(null)} aria-label="Dismiss notification" className="shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-neutral-900">People</h1>
          <p className="mt-1 text-sm text-neutral-500">
            One record per person and per company. Every way in lands in the Inbox until someone decides what it is.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div role="tablist" className="flex gap-1 rounded-lg bg-white border border-neutral-200 p-1 w-full sm:w-auto overflow-x-auto">
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
          </div>
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

        {warnings.length > 0 && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Partial view: {warnings.join("; ")}.
          </p>
        )}

        {tab === "inbox" && (
          <InboxList items={shownInbox} loading={inbox === null} busy={busy} onTriage={triage} onOpen={setOpenActivity} />
        )}
        {tab === "people" && <PeopleList rows={shownPeople} loading={people === null} onOpen={setOpenPerson} />}
        {tab === "organizations" && <OrgList rows={shownOrgs} loading={orgs === null} onOpen={setOpenOrg} />}
      </main>

      <ActivityDrawer item={openActivity} busy={busy} onClose={() => setOpenActivity(null)} onTriage={triage} />
      <PersonDrawer id={openPerson} onClose={() => setOpenPerson(null)} onOpenOrg={(id) => { setOpenPerson(null); setOpenOrg(id) }} />
      <OrgDrawer id={openOrg} onClose={() => setOpenOrg(null)} onOpenPerson={(id) => { setOpenOrg(null); setOpenPerson(id) }} />
      <AddPersonDrawer
        open={adding}
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
  onTriage,
  onOpen,
}: {
  items: InboxItem[]
  loading: boolean
  busy: string | null
  onTriage: (i: InboxItem, d: "promote" | "save" | "dismiss") => void
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
              </div>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{a.summary}</p>
            </button>
            <div className="flex items-center gap-3 md:w-28 text-xs text-neutral-500">
              <Fit org={item.organization} />
              <span className="ml-auto md:ml-0">{when(a.occurred_at)}</span>
            </div>
            <TriageButtons item={item} busy={busy === a.id} onTriage={onTriage} />
          </li>
        )
      })}
    </ul>
  )
}

function TriageButtons({
  item,
  busy,
  onTriage,
}: {
  item: InboxItem
  busy: boolean
  onTriage: (i: InboxItem, d: "promote" | "save" | "dismiss") => void
}) {
  const hasEmail = Boolean(item.activity.contact.email)
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
        </li>
      ))}
    </ol>
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
  onClose,
  onTriage,
}: {
  item: InboxItem | null
  busy: string | null
  onClose: () => void
  onTriage: (i: InboxItem, d: "promote" | "save" | "dismiss") => void
}) {
  const a = item?.activity
  return (
    <DetailDrawer
      open={Boolean(item)}
      onClose={onClose}
      title={item?.person?.name || a?.contact.name || a?.contact.email || ""}
      subtitle={a ? `${SOURCE_LABEL[a.source] ?? a.source}${a.channel ? ` · ${a.channel}` : ""} · ${when(a.occurred_at)}` : undefined}
      footer={item ? <TriageButtons item={item} busy={busy === item.activity.id} onTriage={onTriage} /> : undefined}
    >
      {a && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Email">{a.contact.email}</Field>
            <Field label="Phone">{a.contact.phone}</Field>
            <Field label="Company">{a.contact.company}</Field>
            <Field label="Fit">{item?.organization ? <Fit org={item.organization} /> : null}</Field>
            <Field label="Stage">{item?.person ? STAGE_LABEL[item.person.lifecycle_stage] : "New"}</Field>
          </dl>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">Message</h3>
            <p className="whitespace-pre-wrap text-sm text-neutral-800">{a.body || a.summary}</p>
          </div>
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

function PersonDrawer({ id, onClose, onOpenOrg }: { id: string | null; onClose: () => void; onOpenOrg: (id: string) => void }) {
  const [detail, setDetail] = useState<PersonDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!id) return
    api<{ data: PersonDetail }>(`/api/admin/core/people/${encodeURIComponent(id)}`)
      .then((r) => setDetail(r.data))
      .catch((e) => setError((e as Error).message))
  }, [id])
  const p = detail?.person
  return (
    <DetailDrawer open={Boolean(id)} onClose={onClose} title={p?.name ?? (error ? "Not available" : "Loading…")} subtitle={p?.emails.join(", ")}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {p && detail && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Stage">{STAGE_LABEL[p.lifecycle_stage]}</Field>
            <Field label="First touch">{SOURCE_LABEL[p.source] ?? p.source}</Field>
            <Field label="Email consent">{detail.email_allowed.reason}</Field>
            <Field label="Cold outreach">{detail.cold_gate.cold ? `${detail.cold_gate.allowed ? "Allowed" : "Blocked"}: ${detail.cold_gate.reason}` : "Not cold"}</Field>
            <Field label="Phone">{p.phones.join(", ")}</Field>
            <Field label="Visibility">{p.visibility === "restricted" ? "Restricted" : "Business"}</Field>
            <Field label="Roles">{p.roles.join(", ")}</Field>
            <Field label="Read from">{p.legacy_refs.map((r) => r.collection).filter((c, i, all) => all.indexOf(c) === i).join(", ") || "Stored"}</Field>
          </dl>
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

function OrgDrawer({ id, onClose, onOpenPerson }: { id: string | null; onClose: () => void; onOpenPerson: (id: string) => void }) {
  const [detail, setDetail] = useState<OrgDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!id) return
    api<{ data: OrgDetail }>(`/api/admin/core/organizations/${encodeURIComponent(id)}`)
      .then((r) => setDetail(r.data))
      .catch((e) => setError((e as Error).message))
  }, [id])
  const o = detail?.organization
  return (
    <DetailDrawer open={Boolean(id)} onClose={onClose} title={o?.name ?? (error ? "Not available" : "Loading…")} subtitle={o?.domain}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {o && detail && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Fit"><Fit org={o} /></Field>
            <Field label="Roles">{o.roles.join(", ")}</Field>
            <Field label="Industry">{o.industry}</Field>
            <Field label="Location">{o.location}</Field>
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

function AddPersonDrawer({
  open,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean
  onClose: () => void
  onAdded: (name: string) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", website: "", title: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = async () => {
    setSaving(true)
    try {
      await api("/api/admin/core/people", { method: "POST", body: JSON.stringify({ ...form, source: "manual" }) })
      onAdded(form.name || form.email)
      setForm({ name: "", email: "", phone: "", company: "", website: "", title: "", notes: "" })
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
