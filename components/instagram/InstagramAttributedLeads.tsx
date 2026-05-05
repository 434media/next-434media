"use client"

import { formatNumber } from "../../lib/instagram-utils"

export interface AttributedItem {
  type: "lead" | "client" | "email_signup"
  id: string
  email: string
  name: string
  source: string
  createdAt: string
  status?: string
  company?: string
  pageUrl?: string
}

export interface AttributedLeadsData {
  items: AttributedItem[]
  totals: {
    leads: number
    clients: number
    email_signups: number
    all: number
  }
  period: { startDate: string; endDate: string }
  warnings?: string[]
}

interface Props {
  data: AttributedLeadsData | null
  isLoading?: boolean
  rangeLabel: string
}

const TYPE_LABEL: Record<AttributedItem["type"], string> = {
  lead: "Lead",
  client: "Client",
  email_signup: "Email signup",
}

const TYPE_DOT: Record<AttributedItem["type"], string> = {
  lead: "bg-blue-500",
  client: "bg-emerald-500",
  email_signup: "bg-amber-500",
}

function formatDate(iso: string): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  } catch {
    return ""
  }
}

export function InstagramAttributedLeads({ data, isLoading, rangeLabel }: Props) {
  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6">
        <div className="grid grid-cols-3 gap-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-md bg-neutral-100" />
          ))}
        </div>
        <div className="h-40 mt-4 rounded-md bg-neutral-50 animate-pulse" />
      </div>
    )
  }

  // Connection-empty / no-data state
  if (!data || data.totals.all === 0) {
    return (
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-6">
        <div className="text-center">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h4 className="text-base font-medium text-neutral-900 mb-1">No Instagram-attributed records yet</h4>
          <p className="text-sm text-neutral-500 max-w-md mx-auto">
            We surface CRM records here when their source is tagged{" "}
            <span className="font-medium text-neutral-700">social</span>, or when an inbound
            email signup carries an{" "}
            <span className="font-mono text-[12px] bg-neutral-100 px-1 py-0.5 rounded">utm_source=instagram</span>{" "}
            tag on the page URL.
          </p>
          <p className="text-[11px] text-neutral-400 mt-3">
            Tag leads as <span className="font-medium text-neutral-700">social</span> in the lead
            drawer to attribute them here, or add UTM tags to your bio link to auto-attribute.
          </p>
        </div>
      </div>
    )
  }

  const { items, totals, warnings } = data

  return (
    <div className="space-y-4">
      {/* Summary banner — mono pills with semantic dot prefixes */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
          <span className="inline-block h-1 w-1 rounded-full bg-pink-500" aria-hidden="true" />
          {rangeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 tabular-nums">
          <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
          {totals.all} attributed {totals.all === 1 ? "record" : "records"}
        </span>
        {warnings && warnings.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 ring-1 ring-amber-200">
            <span className="inline-block h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
            Partial data — some sources couldn&apos;t be queried
          </span>
        )}
      </div>

      {/* Three-up tally */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Leads", value: totals.leads, dot: "bg-blue-500", hint: "Tagged source = social" },
          { label: "Clients", value: totals.clients, dot: "bg-emerald-500", hint: "source/lead_source mentions IG" },
          { label: "Email signups", value: totals.email_signups, dot: "bg-amber-500", hint: "UTM-tagged from IG" },
        ].map((tile) => (
          <div key={tile.label} className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className={`inline-block h-1 w-1 rounded-full ${tile.dot}`} aria-hidden="true" />
              {tile.label}
            </p>
            <p className="text-xl sm:text-2xl font-semibold tabular-nums text-neutral-900">{formatNumber(tile.value)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{tile.hint}</p>
          </div>
        ))}
      </div>

      {/* Per-record list */}
      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-900">Records</h3>
          <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
            {items.length} {items.length === 1 ? "record" : "records"} · newest first
          </p>
        </div>
        <div className="divide-y divide-neutral-100 max-h-[480px] overflow-y-auto">
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="px-5 py-3 flex items-center gap-4">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${TYPE_DOT[item.type]}`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {item.name || item.email || "(unnamed)"}
                  {item.company && item.company !== item.name && (
                    <span className="text-neutral-400 font-normal"> · {item.company}</span>
                  )}
                </p>
                <p className="text-xs text-neutral-500 truncate flex items-center gap-2">
                  <span className="truncate">{item.email}</span>
                  {item.status && (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span className="capitalize">{item.status.replace(/_/g, " ")}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700">
                  <span className={`inline-block h-1 w-1 rounded-full ${TYPE_DOT[item.type]}`} aria-hidden="true" />
                  {TYPE_LABEL[item.type]}
                </span>
                <p className="text-[11px] tabular-nums text-neutral-400 mt-0.5">{formatDate(item.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How attribution works — micro-copy */}
      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer hover:text-neutral-900 font-medium">How is attribution computed?</summary>
        <div className="mt-2 space-y-1 pl-4 leading-relaxed">
          <p>
            <span className="font-medium text-neutral-700">Leads</span>: shown when the lead&apos;s source is set to{" "}
            <span className="font-mono text-[11px] bg-neutral-100 px-1 rounded">social</span> in the CRM lead drawer.
          </p>
          <p>
            <span className="font-medium text-neutral-700">Clients</span>: shown when{" "}
            <span className="font-mono text-[11px] bg-neutral-100 px-1 rounded">source</span> or{" "}
            <span className="font-mono text-[11px] bg-neutral-100 px-1 rounded">lead_source</span> contains{" "}
            <span className="font-mono text-[11px]">instagram</span>,{" "}
            <span className="font-mono text-[11px]">ig</span>, or{" "}
            <span className="font-mono text-[11px]">social</span>.
          </p>
          <p>
            <span className="font-medium text-neutral-700">Email signups</span>: shown when the captured page URL contains{" "}
            <span className="font-mono text-[11px] bg-neutral-100 px-1 rounded">utm_source=instagram</span> or similar IG-tagged params.
          </p>
        </div>
      </details>
    </div>
  )
}
