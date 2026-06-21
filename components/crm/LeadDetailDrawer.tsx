"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Briefcase,
  Tag as TagIcon,
  CheckCircle2,
  AlertCircle,
  PenLine,
  Send,
  ArrowRight,
  Trash2,
  Loader2,
  CircleDot,
  CalendarClock,
  MousePointerClick,
  MailOpen,
  Globe,
  ExternalLink,
  Undo2,
} from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { Tag } from "@/components/admin/Tag"
import { MailchimpRecordPanel, type LeadConsent } from "@/components/crm/MailchimpRecordPanel"
import { makeTag, parseTag } from "@/lib/tag-taxonomy"
import type { Lead, LeadStatus, LeadPlatform, LeadSource, LeadActivityType, LeadResearch, LeadDisqualifiedReason } from "@/types/crm-types"
import { LEAD_DISQUALIFIED_REASON_LABELS } from "@/types/crm-types"
import { useTeamMembers } from "@/hooks/useTeamMembers"

interface LeadDetailDrawerProps {
  open: boolean
  lead: Lead | null
  isSaving: boolean
  onClose: () => void
  onSave: (patch: Partial<Lead>) => Promise<Lead | null>
  onArchive?: (id: string, reason?: LeadDisqualifiedReason) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
  /** Stubs for PR #7 — wire when handlers ship. */
  onGenerateDraft?: (id: string) => Promise<void> | void
  onSendOutreach?: (
    id: string,
    subject: string,
    body?: string,
    overrideOptOut?: boolean,
  ) => Promise<boolean> | boolean
  onConvertToClient?: (id: string) => Promise<void> | void
  /** Web-grounded "Research & qualify" — writes a review-only research record. */
  onResearch?: (id: string) => Promise<boolean> | boolean
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; dot: string }[] = [
  { value: "new", label: "New", dot: "bg-blue-500" },
  { value: "ready", label: "Ready", dot: "bg-sky-500" },
  { value: "contacted", label: "Contacted", dot: "bg-amber-500" },
  { value: "engaged", label: "Engaged", dot: "bg-green-500" },
  { value: "converted", label: "Converted", dot: "bg-emerald-500" },
  { value: "archived", label: "Archived", dot: "bg-neutral-400" },
]

const SOURCE_OPTIONS: LeadSource[] = ["event", "web", "social", "manual", "newsletter", "referral", "partner", "prospected"]
const PLATFORM_OPTIONS: LeadPlatform[] = ["434 Media", "TXMX", "VemosVamos", "DevSA", "MilCity"]

// Where a promoted lead came from — drives the provenance block + the
// "Return to audience" affordance. `href` deep-links back to the source
// record (Apollo-sourced leads have no audience record, so no link).
type OriginCollection = NonNullable<Lead["origin_ref"]>["collection"]
const ORIGIN_META: Record<OriginCollection, { label: string; href: (email: string) => string | null }> = {
  partner_list_members: { label: "Lists", href: (e) => `/admin/audiences?sub=lists&search=${encodeURIComponent(e)}` },
  event_registrations: { label: "Events", href: (e) => `/admin/audiences?sub=events&search=${encodeURIComponent(e)}` },
  email_signups: { label: "the Newsletter", href: (e) => `/admin/audiences?sub=newsletter&search=${encodeURIComponent(e)}` },
  contact_forms: { label: "the Inbox", href: (e) => `/admin/inbox?search=${encodeURIComponent(e)}` },
  apollo: { label: "Apollo prospecting", href: () => null },
}

const PRIORITY_BADGE: Record<string, { bg: string; label: string }> = {
  high: { bg: "bg-red-500 text-white", label: "High" },
  medium: { bg: "bg-amber-500 text-white", label: "Medium" },
  low: { bg: "bg-neutral-300 text-neutral-700", label: "Low" },
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function formatDateOnly(iso?: string) {
  if (!iso) return ""
  return iso.split("T")[0]
}

// Today as YYYY-MM-DD in local time (matches the date input's value format).
function todayLocalIso(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

// N days from today as YYYY-MM-DD (local) — for the quick-reschedule chips.
function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

interface FormState {
  name: string
  company: string
  title: string
  email: string
  phone: string
  linkedin: string
  source: LeadSource
  industry: string
  location: string
  platform: LeadPlatform | ""
  status: LeadStatus
  assigned_to: string
  disqualified_reason: LeadDisqualifiedReason | ""
  next_followup_date: string
  outreach_draft: string
  notes: string
  tags: string[]
}

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  title: "",
  email: "",
  phone: "",
  linkedin: "",
  source: "manual",
  industry: "",
  location: "",
  platform: "",
  status: "new",
  assigned_to: "",
  disqualified_reason: "",
  next_followup_date: "",
  outreach_draft: "",
  notes: "",
  tags: [],
}

function fromLead(lead: Lead | null): FormState {
  if (!lead) return EMPTY_FORM
  return {
    name: lead.name || "",
    company: lead.company || "",
    title: lead.title || "",
    email: lead.email || "",
    phone: lead.phone || "",
    linkedin: lead.linkedin || "",
    source: lead.source || "manual",
    industry: lead.industry || "",
    location: lead.location || "",
    platform: lead.platform || "",
    status: lead.status || "new",
    assigned_to: lead.assigned_to || "",
    disqualified_reason: lead.disqualified_reason || "",
    next_followup_date: formatDateOnly(lead.next_followup_date),
    outreach_draft: lead.outreach_draft || "",
    notes: lead.notes || "",
    tags: lead.tags ?? [],
  }
}

export function LeadDetailDrawer({
  open,
  lead,
  isSaving,
  onClose,
  onSave,
  onArchive,
  onDelete,
  onGenerateDraft,
  onSendOutreach,
  onConvertToClient,
  onResearch,
}: LeadDetailDrawerProps) {
  const [form, setForm] = useState<FormState>(fromLead(lead))
  // Live roster (active Firestore members) for the assignee picker — no seeds.
  const { members: teamMembers } = useTeamMembers(open)
  const [tagInput, setTagInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  // Subject is per-send, not persisted on the lead. Reset when drawer reopens.
  const [subject, setSubject] = useState("")
  // Consent verdict from the lead's Mailchimp record (reported by the panel
  // below). Surfaced at the Send block so a marketing opt-out is visible — and
  // gated — before a 1:1 outreach goes out.
  const [consent, setConsent] = useState<LeadConsent | null>(null)
  // Tabbed body (edit mode) — keeps the record from becoming one long scroll.
  const [activeTab, setActiveTab] = useState<"details" | "outreach" | "activity">("details")
  // Two-step archive: first click reveals a removal-reason picker, second confirms.
  // The reason feeds the kept-vs-removed KPI (see LeadDisqualifiedReason).
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(fromLead(lead))
      setActiveTab("details")
      setArchiving(false)
      setSubject("")
      setConsent(null) // re-resolved by the panel for the newly-opened lead
    }
  }, [open, lead])

  // Reset the generating spinner whenever a new draft lands on the lead
  // (server returns the updated lead, parent re-renders us with new draft).
  useEffect(() => {
    if (lead?.outreach_draft && isGenerating) setIsGenerating(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.draft_generated_at])

  const handleGenerate = async () => {
    if (!lead?.id || !onGenerateDraft) return
    setIsGenerating(true)
    try {
      await onGenerateDraft(lead.id)
    } finally {
      // Belt-and-suspenders — also clear here in case the lead prop doesn't
      // change reference (e.g., draft regen with same content).
      setIsGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!lead?.id || !onSendOutreach) return
    if (!subject.trim() || !form.outreach_draft.trim()) return
    // Opt-out awareness: this is a 1:1 sales message (not a campaign), but a
    // marketing opt-out should never be sent through without an explicit nod.
    if (consent === "opted_out") {
      if (
        !confirm(
          `${lead.email} opted out of marketing emails in Mailchimp.\n\nThis is a 1:1 sales message, not a campaign — send anyway?`,
        )
      )
        return
    } else if (!confirm(`Send outreach to ${lead.email}? This cannot be undone.`)) {
      return
    }
    setIsSending(true)
    try {
      // When the rep just confirmed an opt-out, authorize the server-side
      // override so it doesn't bounce back with a 409 (the handler also
      // backstops the suppression-only case the panel can't see).
      const ok = await onSendOutreach(
        lead.id,
        subject.trim(),
        form.outreach_draft,
        consent === "opted_out",
      )
      if (ok) setSubject("")
    } finally {
      setIsSending(false)
    }
  }

  const handleResearch = async () => {
    if (!lead?.id || !onResearch) return
    setIsResearching(true)
    try {
      await onResearch(lead.id)
    } finally {
      setIsResearching(false)
    }
  }

  const isEditing = !!lead?.id
  const score = lead?.score ?? 0
  const priority = lead?.priority ?? "low"
  const breakdown = lead?.score_breakdown ?? {}
  const breakdownEntries = Object.entries(breakdown).filter(([, v]) => typeof v === "number" && v > 0)

  // Tab visibility. Tabs only exist in edit mode; the create form shows the
  // Details group only. Hidden tabs stay mounted (display:none) so the
  // Mailchimp panel keeps resolving consent for the Outreach send block.
  const tabClass = (key: "details" | "outreach" | "activity") =>
    !isEditing
      ? key === "details" ? "space-y-6" : "hidden"
      : activeTab === key ? "space-y-6" : "hidden"

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addTag = () => {
    const raw = tagInput.trim()
    if (!raw) return
    // Auto-namespace if the user just typed a value without a prefix.
    // "sponsor" → "intent:sponsor"; un-mapped values fall back to a neutral
    // chip so the user can still capture ad-hoc data.
    const next = parseTag(raw).namespace ? raw : makeTag("intent", raw)
    if (form.tags.includes(next)) {
      setTagInput("")
      return
    }
    update("tags", [...form.tags, next])
    setTagInput("")
  }

  const removeTag = (t: string) => update("tags", form.tags.filter((x) => x !== t))

  const handleSave = async () => {
    const patch: Partial<Lead> = {
      name: form.name.trim(),
      company: form.company.trim(),
      title: form.title.trim() || undefined,
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      linkedin: form.linkedin.trim() || undefined,
      source: form.source,
      industry: form.industry.trim() || undefined,
      location: form.location.trim() || undefined,
      platform: form.platform || undefined,
      status: form.status,
      assigned_to: form.assigned_to.trim() || undefined,
      // Only an archived lead carries a removal reason; clear it otherwise.
      disqualified_reason:
        form.status === "archived" ? (form.disqualified_reason || undefined) : undefined,
      next_followup_date: form.next_followup_date || undefined,
      outreach_draft: form.outreach_draft || undefined,
      notes: form.notes.trim() || undefined,
      tags: form.tags,
    }
    await onSave(patch)
  }

  // First click arms the reason picker; second click archives with the chosen
  // reason (defaulting to "poor fit, unspecified" if the rep skips it).
  const handleArchive = async () => {
    if (!lead?.id || !onArchive) return
    if (!archiving) {
      setArchiving(true)
      return
    }
    await onArchive(lead.id, (form.disqualified_reason || "no_fit_unspecified") as LeadDisqualifiedReason)
    setArchiving(false)
    onClose()
  }

  // A promoted lead (origin_ref pointing at an audience record) is "returned to
  // audience" rather than hard-deleted: deleting the lead clears the source
  // record's backlink server-side, restoring it as re-promotable.
  const promotedFrom =
    lead?.origin_ref && lead.origin_ref.collection !== "apollo" ? lead.origin_ref : null

  const handleDelete = async () => {
    if (!lead?.id || !onDelete) return
    const msg = promotedFrom
      ? `Remove this lead and return ${lead.email} to ${ORIGIN_META[promotedFrom.collection].label}?\n\nThe source record is restored and can be re-promoted later.`
      : `Permanently delete ${lead.name || lead.email}? This cannot be undone.`
    if (!confirm(msg)) return
    await onDelete(lead.id)
    onClose()
  }

  const priorityStyle = PRIORITY_BADGE[priority]

  const drawerTitle = isEditing ? lead.name || lead.email : "New lead"
  const drawerSubtitle = isEditing ? lead.company : "Capture a lead manually"

  const drawerBadge = isEditing ? (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${priorityStyle.bg}`}>
        {priorityStyle.label}
      </span>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900 text-white tabular-nums">
        {score}
      </span>
    </div>
  ) : undefined

  const footer = (
    <div className="flex items-center justify-between gap-2 px-5 py-3 bg-white">
      <div className="flex items-center gap-1">
        {isEditing && onArchive && !archiving && (
          <button
            onClick={handleArchive}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md disabled:opacity-50"
          >
            Archive
          </button>
        )}
        {isEditing && onArchive && archiving && (
          <div className="flex items-center gap-1.5">
            <select
              value={form.disqualified_reason}
              onChange={(e) => update("disqualified_reason", e.target.value as LeadDisqualifiedReason | "")}
              aria-label="Removal reason"
              className="px-2 py-1.5 text-[12px] border border-neutral-200 rounded-md bg-white focus:outline-none focus:border-neutral-400"
            >
              <option value="">Reason…</option>
              {Object.entries(LEAD_DISQUALIFIED_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={handleArchive}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md disabled:opacity-50"
            >
              Confirm archive
            </button>
            <button
              onClick={() => setArchiving(false)}
              disabled={isSaving}
              className="px-2 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800 rounded-md disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
        {isEditing && onDelete && !archiving && (
          <button
            onClick={handleDelete}
            disabled={isSaving}
            title={promotedFrom ? "Remove the lead and restore the audience record" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 ${
              promotedFrom
                ? "text-neutral-700 hover:bg-neutral-100"
                : "text-red-600 hover:bg-red-50"
            }`}
          >
            {promotedFrom ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
            {promotedFrom ? "Return to audience" : "Delete"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isEditing && onConvertToClient && (
          <button
            onClick={() => onConvertToClient(lead.id)}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-50"
          >
            Convert to Client
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onClose}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !form.email || !form.name || !form.company}
          className="flex items-center gap-2 px-4 py-1.5 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : isEditing ? (
            "Save changes"
          ) : (
            "Create lead"
          )}
        </button>
      </div>
    </div>
  )

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle={drawerSubtitle}
      badge={drawerBadge}
      width="xl"
      footer={footer}
    >
      <div className="p-6">
        {/* Score panel — only when editing */}
        {isEditing && (
          <div className="flex items-stretch gap-4 p-4 mb-4 bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 rounded-xl">
            <div className="flex flex-col items-center justify-center px-4 border-r border-neutral-200">
              <div className="text-3xl font-bold text-neutral-900 tabular-nums">{score}</div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 mt-0.5">Lead score</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Score breakdown
              </div>
              {breakdownEntries.length === 0 ? (
                <p className="text-xs text-neutral-500">No scoring signals yet — add industry, title, or location.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {breakdownEntries.map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[11px] text-neutral-700"
                    >
                      <span className="capitalize">{key}</span>
                      <span className="font-semibold tabular-nums text-neutral-900">+{value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs — split the record into focused views so it doesn't become one
            long scroll. Edit mode only; the create form shows Details alone. */}
        {isEditing && (
          <div className="flex items-center gap-1 p-0.5 mb-4 bg-neutral-100 rounded-lg w-fit">
            {(["details", "outreach", "activity"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 text-[12px] font-medium rounded-md capitalize transition-colors ${
                  activeTab === t
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* ── Details tab — the editable core (Contact / Qualification /
            Workflow / Notes) plus research + provenance. ── */}
        <div className={tabClass("details")}>
        {/* AI research & qualify — web-grounded company context. Review-only:
            nothing here is written to the lead's canonical fields. */}
        {isEditing && onResearch && (
          <ResearchCard
            research={lead.research}
            busy={isResearching}
            onRun={handleResearch}
            currentLocation={form.location}
            onApplyLocation={(country) => update("location", country)}
          />
        )}

        {/* Provenance — where this lead came from in the pipeline, with a link
            back to the source audience record. */}
        {isEditing && lead.origin_ref && (
          <OriginBlock originRef={lead.origin_ref} email={lead.email} />
        )}

        {/* Contact section */}
        <Section title="Contact" icon={Building2}>
          <Field label="Full name *" value={form.name} onChange={(v) => update("name", v)} />
          <Field label="Title" value={form.title} onChange={(v) => update("title", v)} />
          <Field label="Company *" value={form.company} onChange={(v) => update("company", v)} />
          <Field
            label="Email *"
            value={form.email}
            onChange={(v) => update("email", v)}
            type="email"
            iconLeft={<Mail className="w-3.5 h-3.5 text-neutral-400" />}
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            iconLeft={<Phone className="w-3.5 h-3.5 text-neutral-400" />}
          />
          <Field
            label="LinkedIn"
            value={form.linkedin}
            onChange={(v) => update("linkedin", v)}
            placeholder="https://linkedin.com/in/…"
            iconLeft={<Linkedin className="w-3.5 h-3.5 text-neutral-400" />}
          />
        </Section>

        {/* Qualification section */}
        <Section title="Qualification" icon={Briefcase}>
          <Select
            label="Source"
            value={form.source}
            onChange={(v) => update("source", v as LeadSource)}
            options={SOURCE_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <Field
            label="Industry"
            value={form.industry}
            onChange={(v) => update("industry", v)}
            placeholder="e.g. Healthcare, CPG, Real Estate"
          />
          <Field
            label="Location"
            value={form.location}
            onChange={(v) => update("location", v)}
            placeholder="e.g. San Antonio, TX"
            iconLeft={<MapPin className="w-3.5 h-3.5 text-neutral-400" />}
          />
          <Select
            label="Platform fit"
            value={form.platform}
            onChange={(v) => update("platform", v as LeadPlatform | "")}
            options={[{ value: "", label: "(none)" }, ...PLATFORM_OPTIONS.map((p) => ({ value: p, label: p }))]}
          />
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 mb-1.5">
              <TagIcon className="w-3 h-3 text-neutral-400" />
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1 p-2 border border-neutral-200 rounded-md bg-white min-h-[38px]">
              {form.tags.map((t) => (
                <Tag key={t} raw={t} onRemove={() => removeTag(t)} />
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addTag()
                  }
                }}
                onBlur={addTag}
                placeholder={form.tags.length === 0 ? "intent:sponsor, role:speaker, …" : ""}
                className="flex-1 min-w-[120px] text-[12px] bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </Section>

        {/* Workflow section */}
        <Section title="Workflow" icon={CheckCircle2}>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                // "Converted" and "archived" are terminal states reached only
                // through their real actions (Convert to Client / Archive),
                // which create the client record + bidirectional link. Setting
                // them by hand would leave a converted lead with no client, so
                // the chips show current state but aren't directly settable.
                const terminal = s.value === "converted" || s.value === "archived"
                const isActive = form.status === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={terminal}
                    onClick={() => {
                      if (!terminal) update("status", s.value)
                    }}
                    title={
                      terminal
                        ? `Set via the ${s.value === "converted" ? "Convert to Client" : "Archive"} action`
                        : undefined
                    }
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-[12px] font-medium transition-colors ${
                      isActive
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:bg-neutral-100"
                    } ${terminal ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Removal reason — only meaningful for an archived lead. Editable here
              so a rep can correct it after the fact; feeds the kept-vs-removed KPI. */}
          {form.status === "archived" && (
            <Select
              label="Removal reason"
              value={form.disqualified_reason}
              onChange={(v) => update("disqualified_reason", v as LeadDisqualifiedReason | "")}
              options={[
                { value: "", label: "—" },
                ...Object.entries(LEAD_DISQUALIFIED_REASON_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
          )}
          <Select
            label="Assigned to"
            value={form.assigned_to}
            onChange={(v) => update("assigned_to", v)}
            options={[
              { value: "", label: "Unassigned" },
              ...teamMembers.map((m) => ({ value: m.name, label: m.name })),
              // Preserve a legacy/free-text owner not in the current roster.
              ...(form.assigned_to && !teamMembers.some((m) => m.name === form.assigned_to)
                ? [{ value: form.assigned_to, label: `${form.assigned_to} (legacy)` }]
                : []),
            ]}
          />
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Next follow-up</label>
            <input
              type="date"
              value={form.next_followup_date}
              onChange={(e) => update("next_followup_date", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400"
            />
            {/* Quick reschedule + done — adjusts the date in the form; persists
                on Save. "Followed up" clears the date so it leaves the due queue. */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {[
                { label: "+3d", days: 3 },
                { label: "+1w", days: 7 },
                { label: "+2w", days: 14 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => update("next_followup_date", addDaysIso(opt.days))}
                  className="px-2 py-1 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200 rounded-md hover:bg-neutral-50"
                >
                  {opt.label}
                </button>
              ))}
              {form.next_followup_date && (
                <button
                  type="button"
                  onClick={() => update("next_followup_date", "")}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200 rounded-md hover:bg-neutral-50"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Followed up
                </button>
              )}
            </div>
            {isEditing && form.next_followup_date && form.next_followup_date < todayLocalIso() && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">Overdue</p>
            )}
          </div>
        </Section>

        {/* Notes — kept with the editable record. */}
        <Section title="Notes" icon={AlertCircle}>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            placeholder="Internal notes, context from past conversations, etc."
            className="w-full px-3 py-2 text-[13px] border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400"
          />
        </Section>
        </div>

        {/* ── Outreach tab — draft, generate, send + consent cue ── */}
        <div className={tabClass("outreach")}>
        {/* Outreach section */}
        <Section title="Outreach" icon={PenLine}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-neutral-600">Draft email</label>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!onGenerateDraft || isSaving || isGenerating}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
                    title={onGenerateDraft ? "Generate draft via Claude" : "Available in next release"}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Drafting…
                      </>
                    ) : (
                      <>
                        <PenLine className="w-3 h-3" />
                        {form.outreach_draft ? "Regenerate" : "Generate"}
                      </>
                    )}
                  </button>
                  {/* Send moved to a dedicated row below — needs subject input. */}
                </div>
              )}
            </div>
            <textarea
              value={form.outreach_draft}
              onChange={(e) => update("outreach_draft", e.target.value)}
              rows={6}
              placeholder={
                isEditing
                  ? "Click Generate to draft outreach with Claude — or write it yourself."
                  : "(Available after lead is created)"
              }
              disabled={!isEditing}
              className="w-full px-3 py-2 text-[13px] border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 font-mono leading-relaxed disabled:bg-neutral-50 disabled:text-neutral-400"
            />
            {lead?.draft_generated_at && (
              <p className="mt-1 text-[10px] text-neutral-400">
                Last generated {formatDate(lead.draft_generated_at)}
              </p>
            )}
          </div>

          {/* Subject + Send block — only when there's a draft to send */}
          {isEditing && onSendOutreach && form.outreach_draft.trim() && (
            <div className="mt-3 p-3 border border-neutral-200 rounded-md bg-neutral-50">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Subject line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quick thought on TXMX × your CPG audience"
                disabled={isSending}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 disabled:bg-neutral-100"
              />
              {/* Consent cue — reachability from the single source (Mailchimp),
                  shown right where the rep decides to send. */}
              {consent && <ConsentNote consent={consent} />}
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-neutral-500">
                  Sends from <span className="font-mono">hello@send.434media.com</span>; replies route to you.
                </p>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || !subject.trim() || !form.outreach_draft.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-[12px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Send via Resend
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </Section>

        </div>

        {/* ── Activity tab — read-only history + engagement (one home for the
            timeline, Mailchimp campaign activity, and outreach metrics). ── */}
        <div className={tabClass("activity")}>
        {/* Mailchimp profile — subscription state, tags, and recent campaign activity
            for the lead's email. Reps can see open/click history before reaching out. */}
        {isEditing && lead.email && (
          <MailchimpRecordPanel email={lead.email} onConsentResolved={setConsent} />
        )}

        {/* Timeline — chronological log of what's happened on this lead */}
        {isEditing && (
          <Section title="Timeline" icon={CheckCircle2}>
            <ActivityTimeline lead={lead} />
          </Section>
        )}

        {/* Engagement & metadata — outreach opens/clicks (distinct from the
            Mailchimp campaign activity above) + record timestamps. */}
        {isEditing && (
          <Section title="Engagement & metadata" icon={AlertCircle}>
            <ActivityRow label="Email opens" value={String(lead.email_opens ?? 0)} />
            <ActivityRow label="Email clicks" value={String(lead.email_clicks ?? 0)} />
            <ActivityRow label="Last contacted" value={formatDate(lead.last_contacted_at)} />
            <ActivityRow label="Created" value={formatDate(lead.created_at)} />
            <ActivityRow label="Updated" value={formatDate(lead.updated_at)} />
            {lead.resend_email_id && (
              <ActivityRow label="Resend ID" value={lead.resend_email_id} mono />
            )}
          </Section>
        )}
        </div>
      </div>
    </DetailDrawer>
  )
}

// ─────────── small layout helpers ───────────

// Compact consent cue for the Send block — reachability from the single source
// of consent (Mailchimp). Opt-out is the one that changes behavior, so it reads
// loudest; the rest are quiet context.
const CONSENT_NOTE: Record<LeadConsent, { dot: string; text: string; tone: string }> = {
  opted_out: { dot: "bg-rose-500", text: "Opted out of marketing emails in Mailchimp", tone: "text-rose-700" },
  subscribed: { dot: "bg-emerald-500", text: "Subscribed in Mailchimp", tone: "text-neutral-500" },
  pending: { dot: "bg-amber-500", text: "Pending opt-in confirmation", tone: "text-neutral-500" },
  not_in_mailchimp: { dot: "bg-neutral-300", text: "Not in Mailchimp — hasn't opted in", tone: "text-neutral-500" },
}

function OriginBlock({
  originRef,
  email,
}: {
  originRef: NonNullable<Lead["origin_ref"]>
  email: string
}) {
  const meta = ORIGIN_META[originRef.collection]
  const href = email ? meta.href(email) : null
  return (
    <div className="flex items-center justify-between gap-2 rounded-md ring-1 ring-neutral-200/70 bg-neutral-50/70 px-3 py-2 text-[12px]">
      <span className="text-neutral-600 min-w-0 truncate">
        Promoted from <span className="font-medium text-neutral-900">{meta.label}</span>
        {originRef.promoted_at && (
          <span className="text-neutral-400"> · {formatDateOnly(originRef.promoted_at)}</span>
        )}
      </span>
      {href && (
        <a
          href={href}
          className="inline-flex items-center gap-1 shrink-0 text-neutral-600 hover:text-neutral-900 underline decoration-dotted underline-offset-2"
        >
          View source
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}

function ConsentNote({ consent }: { consent: LeadConsent }) {
  const meta = CONSENT_NOTE[consent]
  return (
    <p className={`mt-2 inline-flex items-center gap-1.5 text-[11px] ${meta.tone}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.text}
    </p>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-neutral-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  iconLeft,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  iconLeft?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">{label}</label>
      <div className="relative">
        {iconLeft && <div className="absolute left-2.5 top-1/2 -translate-y-1/2">{iconLeft}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${iconLeft ? "pl-8" : "pl-3"} pr-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400`}
        />
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// AI research card — runs web-grounded research and shows the cited result as a
// review surface. The suggested HQ country can be applied to the lead's location
// field by an explicit click; it is NEVER auto-applied (compliance depends on it).
function ResearchCard({
  research,
  busy,
  onRun,
  currentLocation,
  onApplyLocation,
}: {
  research?: LeadResearch
  busy: boolean
  onRun: () => void
  currentLocation: string
  onApplyLocation: (country: string) => void
}) {
  const suggested = research?.suggestedCountry?.trim()
  const alreadyMatches = !!suggested && currentLocation.toLowerCase().includes(suggested.toLowerCase())

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-neutral-400" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">AI research</h3>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-300 rounded-md hover:bg-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
          {busy ? "Researching…" : research ? "Refresh" : "Research & qualify"}
        </button>
      </div>

      <div className="p-4">
        {busy && !research && (
          <p className="text-xs text-neutral-500">Searching the web and assessing fit — this takes a few seconds.</p>
        )}
        {!busy && !research && (
          <p className="text-xs text-neutral-500">
            Pull a web-grounded company summary + fit rationale. Results are for review — nothing is saved to the lead automatically.
          </p>
        )}
        {research && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Summary</p>
              <p className="text-[13px] text-neutral-700 leading-relaxed">{research.summary}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Fit rationale</p>
              <p className="text-[13px] text-neutral-700 leading-relaxed">{research.fitRationale}</p>
            </div>

            {/* Suggested country — a suggestion, applied only on explicit click. */}
            {suggested && (
              <div className="flex items-center gap-2 flex-wrap text-[12px]">
                <span className="text-neutral-500">Suggested HQ country:</span>
                <span className="font-medium text-neutral-800">{suggested}</span>
                {alreadyMatches ? (
                  <span className="text-[11px] text-emerald-600">✓ matches location</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onApplyLocation(suggested)}
                    className="px-2 py-0.5 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-300 rounded-md hover:bg-neutral-50"
                  >
                    Apply to location
                  </button>
                )}
              </div>
            )}

            {research.sources.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Sources ({research.sources.length})
                </p>
                <ul className="space-y-1">
                  {research.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline break-all"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {s.title || s.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-neutral-400">
              {research.generatedBy ? `${research.generatedBy} · ` : ""}
              {formatDate(research.generatedAt)} · web-grounded, verify before acting
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Per-event icon + label for the timeline. Brand-grounded icons (no Sparkle/Wand).
const ACTIVITY_META: Record<LeadActivityType, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  created: { icon: CircleDot, label: "Created" },
  status_changed: { icon: ArrowRight, label: "Status changed" },
  draft_generated: { icon: PenLine, label: "Draft generated" },
  outreach_sent: { icon: Send, label: "Outreach sent" },
  followup_set: { icon: CalendarClock, label: "Follow-up set" },
  converted: { icon: CheckCircle2, label: "Converted" },
  researched: { icon: Globe, label: "AI research" },
  email_opened: { icon: MailOpen, label: "Email opened" },
  email_clicked: { icon: MousePointerClick, label: "Email clicked" },
  note: { icon: AlertCircle, label: "Note" },
}

function ActivityTimeline({ lead }: { lead: Lead }) {
  // Newest first. Events accrue from feature rollout forward, so older leads
  // may have none — show a clear empty state rather than implying nothing happened.
  const events = [...(lead.activity ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  if (events.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No activity recorded yet. New events (drafts, sends, status changes) will appear here.
      </p>
    )
  }
  return (
    <ol className="relative space-y-3">
      {events.map((e) => {
        const meta = ACTIVITY_META[e.type] ?? { icon: CircleDot, label: e.type }
        const Icon = meta.icon
        return (
          <li key={e.id} className="flex items-start gap-2.5">
            <span className="grid place-items-center h-5 w-5 shrink-0 rounded-full bg-neutral-100 text-neutral-500 mt-0.5">
              <Icon className="w-3 h-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-neutral-800">{meta.label}</span>
                <span className="text-[10px] text-neutral-400 shrink-0 tabular-nums">{formatDate(e.at)}</span>
              </div>
              {e.detail && <p className="text-[11px] text-neutral-500 leading-snug">{e.detail}</p>}
              {e.actor && <p className="text-[10px] text-neutral-400 mt-0.5">{e.actor}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ActivityRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className={`text-neutral-800 ${mono ? "font-mono text-[11px]" : "font-medium"}`}>{value}</span>
    </div>
  )
}
