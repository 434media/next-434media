"use client"

// The Skills list on the Agents page (V1 item 4; founder 2026-11-19: "Approve", and the row-and-drawer redesign the
// same day; Display Standard §3.15, Provisional). One row per skill in the generated catalog, read fresh on the server
// through the read-only GitHub App; a row opens the skill's detail in the admin's drawer. Every plain word (name,
// one-liner, steps, when, not for) comes from the catalog, never from this file. Display only: it starts, pins and
// changes nothing; starting a skill from the admin is connector slice 2.

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { SkillCard } from "@/lib/skills/catalog-view"

const DATA_CLASS: Record<string, string> = {
  public: "Public",
  personal: "Personal data",
  internal: "Internal",
  brand: "Brand",
  "client-sealed": "Client, sealed",
}

type Tone = "dark" | "neutral" | "green" | "amber"
const TONES: Record<Tone, string> = {
  dark: "border border-neutral-900 text-neutral-900 bg-white",
  neutral: "bg-neutral-100 text-neutral-700",
  green: "bg-green-50 text-green-700 border border-green-200",
  amber: "bg-amber-50 text-amber-800 border border-amber-200",
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
}

/** The autonomy pill: the ceiling, in the founder's words. */
function autonomy(s: SkillCard): { label: string; tone: Tone } | null {
  if (s.autonomyCeiling === "approval") return { label: "Waits for you", tone: "dark" }
  if (s.autonomyCeiling === "draft" || !s.autonomyCeiling) return { label: "Draft only", tone: "neutral" }
  if (s.autonomyCeiling === "autonomous") return { label: "Acts alone", tone: "neutral" }
  return null
}

const tested = (s: SkillCard) => s.exam.status === "suite"

function Pills({ s }: { s: SkillCard }) {
  const a = autonomy(s)
  return (
    <span className="flex flex-wrap gap-1.5">
      {a && <Pill tone={a.tone}>{a.label}</Pill>}
      {tested(s) ? <Pill tone="green">Tested</Pill> : <Pill tone="amber">No test yet</Pill>}
      {s.brands.map((b) => (
        <Pill key={b} tone="neutral">{b}</Pill>
      ))}
      {s.status && s.status !== "active" && <Pill tone="neutral">{s.status}</Pill>}
    </span>
  )
}

const FILTERS = {
  all: { label: "All", match: () => true },
  waits: { label: "Waits for you", match: (s: SkillCard) => s.autonomyCeiling === "approval" },
  draft: { label: "Draft only", match: (s: SkillCard) => s.autonomyCeiling === "draft" || !s.autonomyCeiling },
  untested: { label: "No test yet", match: (s: SkillCard) => !tested(s) },
} as const
type Filter = keyof typeof FILTERS

export function SkillsFrame({ count, children }: { count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-8" aria-labelledby="skills-heading">
      <div className="mb-3">
        <h2 id="skills-heading" className="text-lg font-semibold text-neutral-900">
          Skills{typeof count === "number" ? <span className="ml-1.5 font-normal text-neutral-400 tabular-nums">{count}</span> : null}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">What each helper does. Tap one for details.</p>
      </div>
      {children}
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{children}</h3>
}

export function SkillDetail({ s }: { s: SkillCard }) {
  const a = autonomy(s)
  const rows: [string, string][] = [
    ["Owner", s.owner ?? "—"],
    ["Version", s.version ?? "—"],
    ["Can act alone", s.autonomyCeiling === "autonomous" ? "Yes, within its tools" : s.autonomyCeiling === "approval" ? "No, needs your approval" : "No, drafts only"],
    ["Data it touches", s.dataClass ? DATA_CLASS[s.dataClass] ?? s.dataClass : "—"],
    ["Tested", tested(s) ? (s.exam.suites > 1 ? `Yes, ${s.exam.suites} exams` : "Yes, it has an exam") : "Not yet"],
  ]
  return (
    <div className="space-y-5 px-4 py-4 text-[15px] text-neutral-800 sm:px-5">
      <div>
        <p className="font-mono text-xs text-neutral-500 break-all">{s.name}</p>
        <p className="mt-2 text-neutral-500">{s.summary}</p>
        <div className="mt-3">
          <Pills s={s} />
        </div>
      </div>
      <div>
        <Label>When it runs</Label>
        <p className="mt-1.5">{s.runsWhen || s.when || "—"}</p>
      </div>
      <div>
        <Label>What it does</Label>
        {s.steps.length ? (
          <ol className="mt-2 space-y-2">
            {s.steps.map((st, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${st.waits ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}>{i + 1}</span>
                <span>
                  {st.text}
                  {st.waits && a?.label === "Waits for you" && <span className="font-semibold text-neutral-900"> · waits for you</span>}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1.5">{s.does || "—"}</p>
        )}
        {s.sop ? (
          <a href={s.sop.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium text-neutral-900 underline underline-offset-2">
            Full steps in the SOP
          </a>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No SOP yet.</p>
        )}
      </div>
      {s.notFor && (
        <div>
          <Label>Not for</Label>
          <p className="mt-1.5">{s.notFor}</p>
        </div>
      )}
      <div>
        <Label>Details</Label>
        <dl className="mt-2 divide-y divide-neutral-200 border-t border-neutral-200">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-neutral-500">{k}</dt>
              <dd className="text-right text-neutral-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function SkillsList({ skills, commit }: { skills: SkillCard[]; commit: string }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<SkillCard | null>(null)
  const shown = skills.filter(FILTERS[filter].match)
  return (
    <SkillsFrame count={skills.length}>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter skills">
        {(Object.keys(FILTERS) as Filter[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`rounded-full px-3 py-1 text-sm ${filter === k ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"}`}
          >
            {FILTERS[k].label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">{skills.length ? "No skill matches this filter." : "The catalog lists no skills."}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {shown.map((s) => (
            <li key={s.name}>
              <button type="button" onClick={() => setOpen(s)} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-neutral-50">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-neutral-900">{s.label}</span>
                  {s.label !== s.name && <span className="mt-0.5 block font-mono text-xs text-neutral-500 break-all">{s.name}</span>}
                  <span className="mt-1 block text-sm text-neutral-500">{s.summary}</span>
                  <span className="mt-2 block">
                    <Pills s={s} />
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        Read from the catalog at <span className="font-mono">{commit.slice(0, 7)}</span> on 434-context. A list only: nothing here starts a skill.
      </p>
      {open && (
        <DetailDrawer open onClose={() => setOpen(null)} title={open.label} width="lg">
          <SkillDetail s={open} />
        </DetailDrawer>
      )}
    </SkillsFrame>
  )
}
