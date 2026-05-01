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
  Wand2,
  Send,
  ArrowRight,
  Trash2,
  Loader2,
  X,
} from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { Lead, LeadStatus, LeadPlatform, LeadSource } from "@/types/crm-types"

interface LeadDetailDrawerProps {
  open: boolean
  lead: Lead | null
  isSaving: boolean
  onClose: () => void
  onSave: (patch: Partial<Lead>) => Promise<Lead | null>
  onArchive?: (id: string) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
  /** Stubs for PR #7 — wire when handlers ship. */
  onGenerateDraft?: (id: string) => Promise<void> | void
  onSendOutreach?: (id: string, subject: string, body?: string) => Promise<boolean> | boolean
  onConvertToClient?: (id: string) => Promise<void> | void
}

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "ready", label: "Ready", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "contacted", label: "Contacted", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "engaged", label: "Engaged", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "converted", label: "Converted", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "archived", label: "Archived", color: "bg-neutral-100 text-neutral-500 border-neutral-200" },
]

const SOURCE_OPTIONS: LeadSource[] = ["event", "web", "manual", "newsletter", "referral"]
const PLATFORM_OPTIONS: LeadPlatform[] = ["434 Media", "TXMX", "VemosVamos", "DevSA", "MilCity"]

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
}: LeadDetailDrawerProps) {
  const [form, setForm] = useState<FormState>(fromLead(lead))
  const [tagInput, setTagInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  // Subject is per-send, not persisted on the lead. Reset when drawer reopens.
  const [subject, setSubject] = useState("")

  useEffect(() => {
    if (open) {
      setForm(fromLead(lead))
      setSubject("")
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
    if (!confirm(`Send outreach to ${lead.email}? This cannot be undone.`)) return
    setIsSending(true)
    try {
      const ok = await onSendOutreach(lead.id, subject.trim(), form.outreach_draft)
      if (ok) setSubject("")
    } finally {
      setIsSending(false)
    }
  }

  const isEditing = !!lead?.id
  const score = lead?.score ?? 0
  const priority = lead?.priority ?? "low"
  const breakdown = lead?.score_breakdown ?? {}
  const breakdownEntries = Object.entries(breakdown).filter(([, v]) => typeof v === "number" && v > 0)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (form.tags.includes(t)) {
      setTagInput("")
      return
    }
    update("tags", [...form.tags, t])
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
      next_followup_date: form.next_followup_date || undefined,
      outreach_draft: form.outreach_draft || undefined,
      notes: form.notes.trim() || undefined,
      tags: form.tags,
    }
    await onSave(patch)
  }

  const handleArchive = async () => {
    if (!lead?.id || !onArchive) return
    if (!confirm(`Archive ${lead.name || lead.email}?`)) return
    await onArchive(lead.id)
    onClose()
  }

  const handleDelete = async () => {
    if (!lead?.id || !onDelete) return
    if (!confirm(`Permanently delete ${lead.name || lead.email}? This cannot be undone.`)) return
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
        {isEditing && onArchive && (
          <button
            onClick={handleArchive}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md disabled:opacity-50"
          >
            Archive
          </button>
        )}
        {isEditing && onDelete && (
          <button
            onClick={handleDelete}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
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
      <div className="p-6 space-y-6">
        {/* Score panel — only when editing */}
        {isEditing && (
          <div className="flex items-stretch gap-4 p-4 bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 rounded-xl">
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
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 border border-neutral-200 rounded-md bg-white min-h-[38px]">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] text-neutral-700"
                >
                  <TagIcon className="w-3 h-3 text-neutral-400" />
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="ml-0.5 text-neutral-400 hover:text-neutral-700"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
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
                placeholder={form.tags.length === 0 ? "Add tag…" : ""}
                className="flex-1 min-w-[80px] text-[12px] bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </Section>

        {/* Workflow section */}
        <Section title="Workflow" icon={CheckCircle2}>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update("status", s.value)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                    form.status === s.value
                      ? s.color
                      : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Assigned to"
            value={form.assigned_to}
            onChange={(v) => update("assigned_to", v)}
            placeholder="Sales rep name"
          />
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Next follow-up</label>
            <input
              type="date"
              value={form.next_followup_date}
              onChange={(e) => update("next_followup_date", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </Section>

        {/* Outreach section */}
        <Section title="Outreach" icon={Wand2}>
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
                        <Wand2 className="w-3 h-3" />
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
              className="w-full px-3 py-2 text-[13px] border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono leading-relaxed disabled:bg-neutral-50 disabled:text-neutral-400"
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
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:bg-neutral-100"
              />
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

        {/* Notes */}
        <Section title="Notes" icon={AlertCircle}>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            placeholder="Internal notes, context from past conversations, etc."
            className="w-full px-3 py-2 text-[13px] border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </Section>

        {/* Activity (read-only) */}
        {isEditing && (
          <Section title="Activity" icon={CheckCircle2}>
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
    </DetailDrawer>
  )
}

// ─────────── small layout helpers ───────────

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
          className={`w-full ${iconLeft ? "pl-8" : "pl-3"} pr-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900`}
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
        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
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

function ActivityRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className={`text-neutral-800 ${mono ? "font-mono text-[11px]" : "font-medium"}`}>{value}</span>
    </div>
  )
}
