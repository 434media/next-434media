"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Building2,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"

// =============================================================================
// /admin/leads/import-partner-list
//
// One-shot upload flow for partner-shared rosters (Alamo Angels members,
// purchased contact lists, conference attendee handoffs). The page parses CSV
// client-side, auto-maps columns by header heuristics, expands multi-contact
// rows ("Contact #1 …", "Contact #2 …"), and POSTs the normalized rows to
// /api/admin/leads/import-partner-list.
//
// The final write goes through captureLeadFromPartnerList → createLead, so
// dedup-by-email and tag-merging are handled at the lib layer. This page is
// just the UI between "user has a CSV" and "leads exist in Firestore."
// =============================================================================

// ── CSV parser (RFC-4180-ish) ──

function detectDelimiter(text: string): "," | "\t" {
  for (const line of text.split(/\r?\n/, 5)) {
    const tabs = (line.match(/\t/g) ?? []).length
    const commas = (line.match(/,/g) ?? []).length
    if (tabs === 0 && commas === 0) continue
    return tabs > commas ? "\t" : ","
  }
  return ","
}

function parseDelimited(text: string): string[][] {
  const delim = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delim) {
      row.push(field)
      field = ""
      i++
      continue
    }
    if (ch === "\r") {
      i++
      continue
    }
    if (ch === "\n") {
      row.push(field)
      if (row.some((c) => c.length > 0)) rows.push(row)
      row = []
      field = ""
      i++
      continue
    }
    field += ch
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.length > 0)) rows.push(row)
  }
  return rows
}

// ── Column heuristics ──

interface FieldMap {
  email: string
  firstName: string
  lastName: string
  preferredName: string
  company: string
  phone: string
  linkedin: string
  joinedAt: string
  // Source column whose value becomes a `member-tier:<value>` tag
  tierColumn: string
}

const HEURISTICS: Record<keyof FieldMap, RegExp[]> = {
  email: [/^email$/i, /e[-\s]?mail/i],
  firstName: [/^first[_\s-]?name$/i, /^contact\s*#?\s*1\s*name$/i, /^name$/i],
  lastName: [/^last[_\s-]?name$/i],
  preferredName: [/^preferred[_\s-]?name$/i, /^nickname$/i, /^goes\s*by$/i],
  company: [/^company$/i, /^org(anization)?$/i, /^corp(\/family)?$/i],
  phone: [/^phone$/i, /^contact\s*#?\s*1\s*phone/i, /phone\s*number/i, /^mobile$/i, /^cell$/i],
  linkedin: [/linkedin/i, /^contact\s*#?\s*1\s*linkedin/i],
  joinedAt: [/(start|joined|membership|signed[\s-]?up)\s*date/i, /^date\s*joined$/i, /^member\s*since$/i],
  tierColumn: [/^paymen?t?$/i, /^tier$/i, /^membership\s*type$/i, /^plan$/i],
}

function autoMap(headers: string[]): FieldMap {
  const out: FieldMap = {
    email: "",
    firstName: "",
    lastName: "",
    preferredName: "",
    company: "",
    phone: "",
    linkedin: "",
    joinedAt: "",
    tierColumn: "",
  }
  for (const key of Object.keys(out) as (keyof FieldMap)[]) {
    const regs = HEURISTICS[key]
    const hit = headers.find((h) => regs.some((r) => r.test(h.trim())))
    if (hit) out[key] = hit
  }
  return out
}

// Detect which column names form a "Contact #N <field>" group so we can
// expand a single CSV row into N lead rows. Returns groups indexed by the
// suffix field (email, name, phone, linkedin) for contact #2 and #3.
interface MultiContactGroup {
  number: number // 2, 3, ...
  email?: string
  name?: string
  phone?: string
  linkedin?: string
}

function detectMultiContact(headers: string[]): MultiContactGroup[] {
  const found = new Map<number, MultiContactGroup>()
  for (const h of headers) {
    const m = h.trim().match(/^contact\s*#?\s*(\d+)\s+(.+)$/i)
    if (!m) continue
    const num = Number(m[1])
    if (num <= 1) continue
    const tail = m[2].trim().toLowerCase()
    const g = found.get(num) ?? { number: num }
    if (/email/.test(tail)) g.email = h
    else if (/linkedin/.test(tail)) g.linkedin = h
    else if (/phone|mobile|cell/.test(tail)) g.phone = h
    else if (/name/.test(tail)) g.name = h
    found.set(num, g)
  }
  return Array.from(found.values()).sort((a, b) => a.number - b.number)
}

// ── Tag derivation ──

function tierToTag(raw: string | undefined): string | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (!v) return null
  // Normalize: "Annual ", " Annual  ", "In Kind ", "Lifetime", "Corporate"
  // → "member-tier:annual" / "member-tier:lifetime" / "member-tier:in-kind"
  const slug = v.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  if (!slug) return null
  return `member-tier:${slug}`
}

// Drop placeholder names like "Member 2", "Name", "member 2" — these are
// blanks the partner left in the CSV when the second contact slot was unused.
function isPlaceholderName(value: string | undefined): boolean {
  if (!value) return true
  const v = value.trim().toLowerCase()
  return !v || /^member\s*\d+$/.test(v) || v === "name"
}

function splitFullName(value: string | undefined): { firstName: string; lastName: string } {
  if (!value) return { firstName: "", lastName: "" }
  const trimmed = value.trim()
  const idx = trimmed.indexOf(" ")
  if (idx < 0) return { firstName: trimmed, lastName: "" }
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1).trim() }
}

// ── Row normalization ──

interface NormalizedRow {
  email: string
  firstName?: string
  lastName?: string
  preferredName?: string
  company?: string
  phone?: string
  linkedin?: string
  joinedAt?: string
  extraTags?: string[]
  noteSuffix?: string
  // UI-only — for the preview table.
  _origin: string
}

interface PreviewState {
  headers: string[]
  totalRowsParsed: number
  normalized: NormalizedRow[]
  skippedNoEmail: number
  multiContactExpansions: number
}

function normalizeRows(
  records: Record<string, string>[],
  fieldMap: FieldMap,
  multiContact: MultiContactGroup[],
  expandMultiContact: boolean,
  staticTags: string[],
): PreviewState {
  const out: NormalizedRow[] = []
  let skippedNoEmail = 0
  let expansions = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const tierTag = tierToTag(fieldMap.tierColumn ? rec[fieldMap.tierColumn] : "")
    const baseTags = [...staticTags]
    if (tierTag) baseTags.push(tierTag)

    // ── Primary contact (#1) ──
    const primaryEmail = (rec[fieldMap.email] || "").trim().toLowerCase()
    const primaryNameRaw = (rec[fieldMap.firstName] || "").trim()
    const splitPrimary = fieldMap.lastName
      ? { firstName: primaryNameRaw, lastName: (rec[fieldMap.lastName] || "").trim() }
      : splitFullName(primaryNameRaw)

    const cohorts: string[] = []
    if (expandMultiContact && multiContact.length > 0) {
      // Collect names for the noteSuffix so co-contacts know about each other.
      for (const g of multiContact) {
        if (!g.name) continue
        const nm = (rec[g.name] || "").trim()
        if (!isPlaceholderName(nm)) cohorts.push(nm)
      }
      if (!isPlaceholderName(primaryNameRaw)) cohorts.unshift(primaryNameRaw)
    }

    const noteSuffix =
      cohorts.length > 1 ? `Co-contacts: ${cohorts.filter((c) => c).join(", ")}` : undefined

    if (primaryEmail.includes("@") && !isPlaceholderName(primaryNameRaw)) {
      out.push({
        email: primaryEmail,
        firstName: splitPrimary.firstName || undefined,
        lastName: splitPrimary.lastName || undefined,
        preferredName: fieldMap.preferredName
          ? (rec[fieldMap.preferredName] || "").trim() || undefined
          : undefined,
        company: fieldMap.company ? (rec[fieldMap.company] || "").trim() || undefined : undefined,
        phone: fieldMap.phone ? (rec[fieldMap.phone] || "").trim() || undefined : undefined,
        linkedin: fieldMap.linkedin ? (rec[fieldMap.linkedin] || "").trim() || undefined : undefined,
        joinedAt: fieldMap.joinedAt ? (rec[fieldMap.joinedAt] || "").trim() || undefined : undefined,
        extraTags: baseTags.length > 0 ? baseTags : undefined,
        noteSuffix,
        _origin: `row ${i + 1} · primary`,
      })
    } else if (primaryEmail) {
      // Has email but placeholder name → still import; placeholder handling is
      // about the NAME, not the email validity.
      out.push({
        email: primaryEmail,
        firstName: splitPrimary.firstName || undefined,
        lastName: splitPrimary.lastName || undefined,
        company: fieldMap.company ? (rec[fieldMap.company] || "").trim() || undefined : undefined,
        phone: fieldMap.phone ? (rec[fieldMap.phone] || "").trim() || undefined : undefined,
        linkedin: fieldMap.linkedin ? (rec[fieldMap.linkedin] || "").trim() || undefined : undefined,
        joinedAt: fieldMap.joinedAt ? (rec[fieldMap.joinedAt] || "").trim() || undefined : undefined,
        extraTags: baseTags.length > 0 ? baseTags : undefined,
        noteSuffix,
        _origin: `row ${i + 1} · primary`,
      })
    } else {
      skippedNoEmail++
    }

    // ── Secondary contacts (#2, #3, …) ──
    if (expandMultiContact) {
      for (const g of multiContact) {
        const cEmail = g.email ? (rec[g.email] || "").trim().toLowerCase() : ""
        if (!cEmail.includes("@")) continue
        const cNameRaw = g.name ? (rec[g.name] || "").trim() : ""
        if (isPlaceholderName(cNameRaw) && !cEmail) continue
        const splitC = splitFullName(cNameRaw)
        out.push({
          email: cEmail,
          firstName: splitC.firstName || undefined,
          lastName: splitC.lastName || undefined,
          company: fieldMap.company ? (rec[fieldMap.company] || "").trim() || undefined : undefined,
          phone: g.phone ? (rec[g.phone] || "").trim() || undefined : undefined,
          linkedin: g.linkedin ? (rec[g.linkedin] || "").trim() || undefined : undefined,
          joinedAt: fieldMap.joinedAt ? (rec[fieldMap.joinedAt] || "").trim() || undefined : undefined,
          extraTags: baseTags.length > 0 ? baseTags : undefined,
          noteSuffix,
          _origin: `row ${i + 1} · contact #${g.number}`,
        })
        expansions++
      }
    }
  }
  return {
    headers: [],
    totalRowsParsed: records.length,
    normalized: out,
    skippedNoEmail,
    multiContactExpansions: expansions,
  }
}

// ── Page ──

interface ImportResultShape {
  attempted: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: Array<{ email: string; error: string }>
}

export default function ImportPartnerListPage() {
  return (
    <AdminRoleGuard>
      <ImportFlow />
    </AdminRoleGuard>
  )
}

function ImportFlow() {
  const [partnerName, setPartnerName] = useState("")
  const [partnerSlug, setPartnerSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [staticTagsRaw, setStaticTagsRaw] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [records, setRecords] = useState<Record<string, string>[]>([])
  const [fieldMap, setFieldMap] = useState<FieldMap | null>(null)
  const [multiContact, setMultiContact] = useState<MultiContactGroup[]>([])
  const [expandMultiContact, setExpandMultiContact] = useState(true)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResultShape | null>(null)
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Keep the slug in sync with the name until the user manually edits it.
  function onPartnerNameChange(value: string) {
    setPartnerName(value)
    if (!slugTouched) {
      setPartnerSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40),
      )
    }
  }

  function onSlugChange(value: string) {
    setSlugTouched(true)
    setPartnerSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
  }

  function handleFile(file: File) {
    setParseError(null)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "")
        const matrix = parseDelimited(text)
        if (matrix.length < 2) {
          setParseError("CSV must have a header row plus at least one data row.")
          return
        }
        // Pick the row with the most NON-EMPTY cells out of the first few.
        // Title rows like ", Alamo Angels Members,,,,,…" have the same total
        // column count as the real header row but only one populated cell;
        // counting non-empty cells reliably skips them.
        let headerIdx = 0
        let bestNonEmpty = -1
        const scanLimit = Math.min(matrix.length, 5)
        for (let i = 0; i < scanLimit; i++) {
          const nonEmpty = matrix[i].reduce(
            (n, c) => n + (c.trim() ? 1 : 0),
            0,
          )
          if (nonEmpty > bestNonEmpty) {
            bestNonEmpty = nonEmpty
            headerIdx = i
          }
        }
        // Headers can be blank (leading "," columns are common in spreadsheet
        // exports) or duplicated. De-dupe + drop blanks so the mapping
        // dropdown gets stable React keys and the user never sees an
        // empty option to choose. The position index is preserved so we
        // can still read the corresponding cell from each data row.
        const rawHeaders = matrix[headerIdx].map((h) => h.trim())
        const seen = new Map<string, number>()
        const headerByIdx: (string | null)[] = rawHeaders.map((h) => {
          if (!h) return null
          const count = seen.get(h) ?? 0
          seen.set(h, count + 1)
          // First occurrence keeps the natural name; later duplicates get
          // a positional suffix so option keys stay unique.
          return count === 0 ? h : `${h} (${count + 1})`
        })
        const hdrs = headerByIdx.filter((h): h is string => h !== null)
        const recs: Record<string, string>[] = []
        for (let i = headerIdx + 1; i < matrix.length; i++) {
          const r = matrix[i]
          const obj: Record<string, string> = {}
          for (let j = 0; j < headerByIdx.length; j++) {
            const key = headerByIdx[j]
            if (key === null) continue
            obj[key] = (r[j] ?? "").trim()
          }
          recs.push(obj)
        }
        setHeaders(hdrs)
        setRecords(recs)
        setFieldMap(autoMap(hdrs))
        setMultiContact(detectMultiContact(hdrs))
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse file")
      }
    }
    reader.onerror = () => setParseError("Failed to read file")
    reader.readAsText(file)
  }

  const staticTags = useMemo(
    () =>
      staticTagsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [staticTagsRaw],
  )

  const preview = useMemo(() => {
    if (!fieldMap || records.length === 0) return null
    return normalizeRows(records, fieldMap, multiContact, expandMultiContact, staticTags)
  }, [fieldMap, records, multiContact, expandMultiContact, staticTags])

  async function runImport(dryRun: boolean) {
    if (!preview || !partnerSlug || !partnerName) return
    setIsImporting(true)
    setImportResult(null)
    try {
      const res = await fetch("/api/admin/leads/import-partner-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerSlug,
          partnerName,
          dryRun,
          rows: preview.normalized.map(({ _origin: _, ...row }) => {
            void _
            return row
          }),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setToast({ type: "error", text: data?.error || "Import failed" })
        return
      }
      setImportResult(data.result as ImportResultShape)
      setToast({
        type: "success",
        text: dryRun
          ? `Dry run OK — ${data.result.attempted} rows would be processed`
          : `Imported: ${data.result.created} new · ${data.result.updated} updated${
              data.result.failed > 0 ? ` · ${data.result.failed} failed` : ""
            }`,
      })
    } catch {
      setToast({ type: "error", text: "Import request failed" })
    } finally {
      setIsImporting(false)
    }
  }

  const canImport =
    !!preview &&
    preview.normalized.length > 0 &&
    /^[a-z0-9][a-z0-9-]{1,40}$/.test(partnerSlug) &&
    partnerName.trim().length > 0

  return (
    <div className="min-h-screen bg-neutral-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] mb-3">
          <Link
            href="/admin/leads"
            className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leads
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-700 font-medium" aria-current="page">
            Import partner list
          </span>
        </nav>

        <header className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Import partner list
          </h1>
          <p className="text-[13px] text-neutral-500 font-normal leading-relaxed mt-1">
            Upload a partner-shared roster (Alamo Angels, conference attendee
            list, purchased contacts). Rows become CRM leads tagged{" "}
            <code className="px-1 py-0.5 bg-neutral-100 rounded text-[11px]">source:partner</code>{" "}
            +{" "}
            <code className="px-1 py-0.5 bg-neutral-100 rounded text-[11px]">partner:&lt;slug&gt;</code>.
            Existing leads with the same email get updated, not duplicated.
          </p>
        </header>

        {/* Step 1 — Partner identity */}
        <Section title="1. Partner" icon={Building2}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                Partner name
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => onPartnerNameChange(e.target.value)}
                placeholder="Alamo Angels"
                className="mt-1 w-full px-3 py-2 text-[13px] text-neutral-800 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                Slug
              </label>
              <input
                type="text"
                value={partnerSlug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="alamo-angels"
                className="mt-1 w-full px-3 py-2 text-[13px] tabular-nums text-neutral-800 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Becomes the{" "}
                <code className="px-1 py-0.5 bg-neutral-100 rounded">partner:&lt;slug&gt;</code> tag.
              </p>
            </div>
          </div>
        </Section>

        {/* Step 2 — Upload */}
        <Section title="2. Upload CSV" icon={Upload}>
          <label
            className="flex flex-col items-center justify-center gap-2 px-4 py-10 border-2 border-dashed border-neutral-200 rounded-md bg-white hover:border-neutral-300 hover:bg-neutral-50/50 transition-colors cursor-pointer"
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <FileText className="w-6 h-6 text-neutral-300" />
            <span className="text-[13px] text-neutral-600">
              {records.length > 0
                ? `Loaded ${records.length} rows · ${headers.length} columns`
                : "Drop a CSV here or click to choose a file"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv,text/tab-separated-values"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
          {parseError && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-rose-600">
              <AlertCircle className="w-3.5 h-3.5" />
              {parseError}
            </div>
          )}
        </Section>

        {/* Step 3 — Mapping */}
        {fieldMap && headers.length > 0 && (
          <Section title="3. Column mapping" icon={Layers}>
            <p className="text-[12px] text-neutral-500 mb-3">
              Auto-detected from headers. Adjust if the importer guessed wrong.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <FieldDropdown
                label="Email *"
                headers={headers}
                value={fieldMap.email}
                onChange={(v) => setFieldMap({ ...fieldMap, email: v })}
              />
              <FieldDropdown
                label="First / full name"
                headers={headers}
                value={fieldMap.firstName}
                onChange={(v) => setFieldMap({ ...fieldMap, firstName: v })}
              />
              <FieldDropdown
                label="Last name (optional)"
                headers={headers}
                value={fieldMap.lastName}
                onChange={(v) => setFieldMap({ ...fieldMap, lastName: v })}
              />
              <FieldDropdown
                label="Preferred name"
                headers={headers}
                value={fieldMap.preferredName}
                onChange={(v) => setFieldMap({ ...fieldMap, preferredName: v })}
              />
              <FieldDropdown
                label="Company"
                headers={headers}
                value={fieldMap.company}
                onChange={(v) => setFieldMap({ ...fieldMap, company: v })}
              />
              <FieldDropdown
                label="Phone"
                headers={headers}
                value={fieldMap.phone}
                onChange={(v) => setFieldMap({ ...fieldMap, phone: v })}
              />
              <FieldDropdown
                label="LinkedIn"
                headers={headers}
                value={fieldMap.linkedin}
                onChange={(v) => setFieldMap({ ...fieldMap, linkedin: v })}
              />
              <FieldDropdown
                label="Joined date"
                headers={headers}
                value={fieldMap.joinedAt}
                onChange={(v) => setFieldMap({ ...fieldMap, joinedAt: v })}
              />
              <FieldDropdown
                label="Tier column → member-tier:&lt;value&gt;"
                headers={headers}
                value={fieldMap.tierColumn}
                onChange={(v) => setFieldMap({ ...fieldMap, tierColumn: v })}
              />
            </div>

            {multiContact.length > 0 && (
              <label className="mt-4 flex items-center gap-2 text-[12px] text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expandMultiContact}
                  onChange={(e) => setExpandMultiContact(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Expand multi-contact rows ({multiContact.length} extra contact
                column groups detected: contact #
                {multiContact.map((g) => g.number).join(", #")}). Each becomes
                a separate lead with shared partner / tier tags.
              </label>
            )}

            <div className="mt-4">
              <label className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                Static tags (comma-separated)
              </label>
              <input
                type="text"
                value={staticTagsRaw}
                onChange={(e) => setStaticTagsRaw(e.target.value)}
                placeholder="role:investor, region:san-antonio"
                className="mt-1 w-full px-3 py-2 text-[13px] text-neutral-800 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 font-mono"
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Applied to every imported lead. Use namespaced tags like{" "}
                <code className="px-1 py-0.5 bg-neutral-100 rounded">role:investor</code>{" "}
                or{" "}
                <code className="px-1 py-0.5 bg-neutral-100 rounded">demographic:woman-investor</code>.
              </p>
            </div>
          </Section>
        )}

        {/* Step 4 — Preview */}
        {preview && (
          <Section title="4. Preview" icon={CheckCircle2}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
              <Stat label="Source rows" value={preview.totalRowsParsed.toLocaleString()} />
              <Stat
                label="Will import"
                value={preview.normalized.length.toLocaleString()}
                emphasis="emerald"
              />
              <Stat
                label="Multi-contact expansions"
                value={preview.multiContactExpansions.toLocaleString()}
              />
              <Stat
                label="Skipped (no email)"
                value={preview.skippedNoEmail.toLocaleString()}
                emphasis={preview.skippedNoEmail > 0 ? "amber" : undefined}
              />
            </div>

            {preview.normalized.length > 0 && (
              <div className="border border-neutral-200/70 rounded-md overflow-x-auto bg-white">
                <table className="w-full text-[12px]">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                    <tr>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Company</th>
                      <th className="text-left px-3 py-2">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {preview.normalized.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-neutral-800">{r.email}</td>
                        <td className="px-3 py-1.5 text-neutral-700">
                          {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-neutral-500">{r.company || "—"}</td>
                        <td className="px-3 py-1.5 text-neutral-500 font-mono text-[10px]">
                          {(r.extraTags ?? []).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.normalized.length > 10 && (
                  <div className="px-3 py-1.5 text-[11px] text-neutral-400 border-t border-neutral-100 bg-neutral-50">
                    + {(preview.normalized.length - 10).toLocaleString()} more rows…
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Step 5 — Run */}
        {preview && preview.normalized.length > 0 && (
          <Section title="5. Import" icon={Upload}>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => runImport(true)}
                disabled={!canImport || isImporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Dry run
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Import ${preview.normalized.length} rows as leads tagged partner:${partnerSlug}? Existing leads with the same email will be updated, not duplicated.`)) return
                  runImport(false)
                }}
                disabled={!canImport || isImporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Import to CRM
              </button>
              {!canImport && (
                <span className="text-[11px] text-neutral-400">
                  Fill in partner name + slug to enable.
                </span>
              )}
            </div>

            {importResult && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Stat label="Attempted" value={importResult.attempted.toLocaleString()} />
                <Stat label="Created" value={importResult.created.toLocaleString()} emphasis="emerald" />
                <Stat label="Updated" value={importResult.updated.toLocaleString()} />
                <Stat
                  label="Failed"
                  value={importResult.failed.toLocaleString()}
                  emphasis={importResult.failed > 0 ? "rose" : undefined}
                />
              </div>
            )}
            {importResult && importResult.errors.length > 0 && (
              <details className="mt-3 text-[12px]">
                <summary className="cursor-pointer text-neutral-500 hover:text-neutral-900">
                  {importResult.errors.length} row{importResult.errors.length === 1 ? "" : "s"} failed — view detail
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-rose-700">
                  {importResult.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      <span className="text-neutral-400">{e.email}</span> — {e.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {importResult && importResult.created + importResult.updated > 0 && !isImporting && (
              <div className="mt-3 text-[12px]">
                <Link
                  href={`/admin/audiences?tab=lists&search=${encodeURIComponent(partnerSlug)}`}
                  className="text-neutral-700 hover:text-black underline"
                >
                  View imported list in Audiences →
                </Link>
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Toast — bottom-right */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-3 py-2 rounded-md text-[12px] font-medium shadow-md ${
            toast.type === "success"
              ? "bg-neutral-900 text-white"
              : "bg-rose-600 text-white"
          }`}
          onAnimationEnd={() => setTimeout(() => setToast(null), 3000)}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

// ── Small subcomponents ──

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Upload
  children: React.ReactNode
}) {
  return (
    <section className="mb-5">
      <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h2>
      <div className="bg-white rounded-md border border-neutral-200/70 p-4">
        {children}
      </div>
    </section>
  )
}

function FieldDropdown({
  label,
  headers,
  value,
  onChange,
}: {
  label: string
  headers: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2.5 py-2 text-[13px] text-neutral-800 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
      >
        <option value="">— not mapped —</option>
        {headers.map((h, i) => (
          // Fallback positional key when a header collides — defense in depth
          // against partner CSVs we haven't seen yet.
          <option key={h ? `${h}-${i}` : `__blank-${i}`} value={h}>
            {h || "(blank header)"}
          </option>
        ))}
      </select>
    </div>
  )
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: "emerald" | "amber" | "rose"
}) {
  const valueClass =
    emphasis === "emerald"
      ? "text-emerald-700"
      : emphasis === "amber"
        ? "text-amber-700"
        : emphasis === "rose"
          ? "text-rose-700"
          : "text-neutral-900"
  return (
    <div className="p-3 rounded-md border border-neutral-200/70 bg-white">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums leading-tight mt-0.5 ${valueClass}`}>
        {value}
      </div>
    </div>
  )
}
