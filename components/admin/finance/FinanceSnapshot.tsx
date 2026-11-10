"use client"

import { useCallback, useEffect, useState } from "react"
import type { FinanceSnapshot as Snapshot } from "@/lib/quickbooks-snapshot"

/**
 * The finance snapshot (V1 item 1, Phase 1), from the approved mockup (434-context#230): the four tiles, revenue and
 * costs by month, and, until projections exist (Phase 2), costs by category and aging where the roll-up and the
 * pipeline will go. Colours are the 434 palette's series roles from the mockup: actual `color-03`, costs line in the
 * text colour, signal red only for state (over 90 days). Read only: the page has no control that changes the books.
 */

const C = { actual: "#49625E", light: "#CAD9D6", tint: "#E5EBEB", mid: "#A2B7B2", signal: "#D0271D" }

type Api =
  | { quickbooks: { connected: true; cached: boolean }; snapshot: Snapshot }
  | { quickbooks: { connected: false; configured: false; missing: string[] } }
  | { quickbooks: { connected: false; configured: true; reconnect?: boolean }; error?: string }
  | { quickbooks: { connected: true }; error: string }

type View =
  | { kind: "loading" }
  | { kind: "not_configured"; missing: string[] }
  | { kind: "not_connected"; reconnect: boolean; message?: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; snapshot: Snapshot }

function money(n: number, currency = "USD", compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 1 : 0,
    notation: compact && Math.abs(n) >= 1000 ? "compact" : "standard",
  }).format(n)
}

function signed(n: number, currency: string): string {
  return `${n >= 0 ? "↑" : "↓"} ${money(Math.abs(n), currency)}`
}

function asOfLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso))
}

function monthEndLabel(today: string): string {
  const [y, m] = today.split("-").map(Number)
  const end = new Date(Date.UTC(y, m - 1, 0))
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(end)
}

export default function FinanceSnapshot({ notice, subtitle }: { notice: string | null; subtitle: string }) {
  const [view, setView] = useState<View>({ kind: "loading" })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (fresh: boolean) => {
    setRefreshing(true)
    try {
      const r = await fetch(`/api/admin/finance${fresh ? "?fresh=1" : ""}`, { cache: "no-store" })
      const data = (await r.json().catch(() => null)) as Api | null
      if (!data) setView({ kind: "error", message: "The finance API did not answer." })
      else if ("snapshot" in data) setView({ kind: "ok", snapshot: data.snapshot })
      else if (!data.quickbooks.connected && "configured" in data.quickbooks && data.quickbooks.configured === false)
        setView({ kind: "not_configured", missing: data.quickbooks.missing })
      else if (!data.quickbooks.connected)
        setView({ kind: "not_connected", reconnect: Boolean((data.quickbooks as { reconnect?: boolean }).reconnect), message: "error" in data ? data.error : undefined })
      else setView({ kind: "error", message: ("error" in data && data.error) || "The QuickBooks read failed." })
    } catch {
      setView({ kind: "error", message: "The finance API did not answer." })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  const snap = view.kind === "ok" ? view.snapshot : null

  return (
    <div className="grid gap-4 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2 pb-1">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[30px] font-extrabold leading-tight text-neutral-900">Finance</h1>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
          {snap && (
            <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-neutral-500">
              <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-green-500" />
              <span>
                QuickBooks · {snap.company} · {asOfLabel(snap.asOf)}
              </span>
              {snap.environment === "sandbox" && (
                <span className="rounded px-1.5 py-0.5 bg-amber-100 text-amber-800">Sandbox: Intuit&apos;s test company, not 434&apos;s books</span>
              )}
            </p>
          )}
        </div>
        {snap && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="h-9 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:border-neutral-500 disabled:opacity-60"
            >
              {refreshing ? "Reading…" : "Refresh"}
            </button>
            <form method="post" action="/api/admin/finance/quickbooks/disconnect">
              <button type="submit" className="h-9 rounded-full border border-neutral-300 bg-white px-4 text-sm text-neutral-600 hover:border-neutral-500">
                Disconnect
              </button>
            </form>
          </div>
        )}
      </header>

      {notice && <p className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700">{notice}</p>}

      {view.kind === "loading" && <Panel title="Reading QuickBooks…" body="Cash, money owed and profit load from the books when this page opens." />}

      {view.kind === "not_configured" && (
        <Panel
          title="QuickBooks is not set up for this deployment"
          body={`The Intuit app's keys are missing here: ${view.missing.join(", ")}. They are set in the Vercel project, never in code.`}
        />
      )}

      {view.kind === "not_connected" && (
        <Panel
          title={view.reconnect ? "Reconnect QuickBooks" : "QuickBooks is not connected yet"}
          body={
            view.reconnect
              ? `${view.message ?? "The connection to QuickBooks has ended."} Reconnecting takes you to Intuit to approve it again.`
              : "Connect once and this page reads cash, money owed and profit from the books each time it opens. It only reads: nothing is written to QuickBooks."
          }
          action={{ href: "/api/admin/finance/quickbooks/connect", label: view.reconnect ? "Reconnect QuickBooks" : "Connect QuickBooks" }}
        />
      )}

      {view.kind === "error" && (
        <Panel title="QuickBooks did not answer" body={view.message} onRetry={() => void load(true)} />
      )}

      {snap && <SnapshotBody s={snap} />}
    </div>
  )
}

function Panel({ title, body, action, onRetry }: { title: string; body: string; action?: { href: string; label: string }; onRetry?: () => void }) {
  return (
    <div className="rounded-[14px] border border-neutral-200 bg-white px-5 py-4">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
      {action && (
        <a href={action.href} className="mt-3 inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white" style={{ background: C.actual }}>
          {action.label}
        </a>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 h-9 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold">
          Try again
        </button>
      )}
    </div>
  )
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold leading-tight text-neutral-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Tile({ k, v, children }: { k: string; v: string; children: React.ReactNode }) {
  return (
    <article className="grid content-start gap-2.5 rounded-[14px] border border-neutral-200 bg-white p-5">
      <span className="text-sm text-neutral-500">{k}</span>
      <span className="text-2xl lg:text-[32px] font-semibold leading-none tabular-nums tracking-tight text-neutral-900">{v}</span>
      <span className="text-[13px] text-neutral-500">{children}</span>
    </article>
  )
}

const B = ({ children, down }: { children: React.ReactNode; down?: boolean }) => (
  <b className="font-semibold" style={{ color: down ? C.signal : undefined }}>
    {children}
  </b>
)

function SnapshotBody({ s }: { s: Snapshot }) {
  const cur = s.currency
  return (
    <>
      <section aria-label="Business health" className="grid grid-cols-2 gap-4 min-[1000px]:grid-cols-4">
        <Tile k="Cash" v={money(s.cash.balance, cur)}>
          {s.cash.change !== null && (
            <>
              <B down={s.cash.change < 0}>{signed(s.cash.change, cur)}</B> since {monthEndLabel(s.today)}
            </>
          )}
          {s.cash.monthsOfCosts !== null && (
            <>
              {s.cash.change !== null && " · "}
              <B>{s.cash.monthsOfCosts.toFixed(1)} months</B> of costs
            </>
          )}
        </Tile>
        <Tile k="Owed to you" v={money(s.receivable.total, cur)}>
          {s.receivable.openInvoices !== null && <>{s.receivable.openInvoices} open invoice{s.receivable.openInvoices === 1 ? "" : "s"} · </>}
          {s.receivable.over90 > 0 ? <B down>{money(s.receivable.over90, cur)} over 90 days</B> : <>nothing over 90 days</>}
        </Tile>
        <Tile k="Profit this year" v={money(s.profitYtd.net, cur)}>
          {s.profitYtd.margin !== null && (
            <>
              <B down={s.profitYtd.margin < 0}>{(s.profitYtd.margin * 100).toFixed(1)}% margin</B> ·{" "}
            </>
          )}
          plan arrives with projections
        </Tile>
        <Tile k="Next 90 days" v="—">
          The forecast arrives with projections
        </Tile>
      </section>

      <div className="grid gap-4 min-[1000px]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <Card title="Revenue and costs by month" aside={<span className="text-[13px] text-neutral-500">Last 6 months</span>}>
          <MonthChart s={s} />
          <div className="mt-3.5 grid gap-x-5 gap-y-2 text-[13px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr))]">
            <Key swatch={<i className="mt-[5px] inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: C.actual }} />} name="Actual" text="Income QuickBooks has recorded for the month." />
            <Key swatch={<i className="mt-[9px] inline-block w-3.5 border-t-2 border-neutral-900" />} name="Costs" text="Cost of sales and expenses for the month." />
          </div>
          <p className="mt-2.5 text-xs text-neutral-500">
            QuickBooks runs on {s.basis.toLowerCase()} (Accounting method), so Actual means invoiced, paid or not. Unpaid invoices are in Owed to you. The books are not
            closed, so recent months are re-read each time.
          </p>
        </Card>

        <Card title="Costs this year" aside={<span className="text-[13px] text-neutral-500">Jan–{s.months.at(-1)?.label.split(" ")[0] ?? ""}</span>}>
          <CostList s={s} />
        </Card>
      </div>

      <div className="grid gap-4 min-[1000px]:grid-cols-2">
        <Card title="Owed to you, by age">
          <Aging buckets={s.receivable.buckets} total={s.receivable.total} cur={cur} />
        </Card>
        <Card title="You owe, by age">
          <Aging buckets={s.payable.buckets} total={s.payable.total} cur={cur} />
        </Card>
      </div>
    </>
  )
}

function Key({ swatch, name, text }: { swatch: React.ReactNode; name: string; text: string }) {
  return (
    <div className="grid grid-cols-[14px_1fr] items-start gap-x-2">
      {swatch}
      <b className="font-semibold">{name}</b>
      <span className="col-start-2 text-neutral-500">{text}</span>
    </div>
  )
}

function MonthChart({ s }: { s: Snapshot }) {
  const [hover, setHover] = useState<number | null>(null)
  const months = s.months
  if (months.length === 0) return <p className="text-sm text-neutral-500">No months in the books yet.</p>
  const W = 640,
    H = 240,
    padL = 48,
    padB = 26,
    padT = 10
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.costs]))
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const y = (v: number) => padT + (H - padT - padB) * (1 - Math.max(0, v) / top)
  const slot = (W - padL) / months.length
  const bw = Math.min(56, slot * 0.56)
  const cx = (i: number) => padL + slot * i + slot / 2
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const line = months.map((m, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(m.costs).toFixed(1)}`).join(" ")
  const h = hover !== null ? months[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Income and costs for the last six months">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke={C.tint} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-neutral-500 text-[11px] tabular-nums">
              {money(t, s.currency, true)}
            </text>
          </g>
        ))}
        {months.map((m, i) => (
          <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <rect x={padL + slot * i} y={padT} width={slot} height={H - padT - padB} fill={hover === i ? C.tint : "transparent"} opacity={0.6} />
            <rect
              x={cx(i) - bw / 2}
              y={y(m.income)}
              width={bw}
              height={Math.max(0, H - padB - y(m.income))}
              rx={3}
              fill={m.partial ? "none" : C.actual}
              stroke={C.actual}
              strokeWidth={m.partial ? 1.5 : 0}
              strokeDasharray={m.partial ? "4 3" : undefined}
            />
            <text x={cx(i)} y={H - 8} textAnchor="middle" className="fill-neutral-500 text-[11px]">
              {m.label.split(" ")[0]}
              {m.partial ? " (to date)" : ""}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke="currentColor" className="text-neutral-900" strokeWidth={2} />
        {months.map((m, i) => (
          <circle key={m.month} cx={cx(i)} cy={y(m.costs)} r={3} className="fill-white stroke-neutral-900" strokeWidth={2} />
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-xs leading-relaxed shadow-lg"
          style={{ left: `${(cx(hover) / W) * 100}%`, transform: hover > months.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
        >
          <div className="text-neutral-500">
            {h.label}
            {h.partial ? ", to date" : ""}
          </div>
          <Row label="Income" value={money(h.income, s.currency)} />
          <Row label="Costs" value={money(h.costs, s.currency)} />
          <Row label="Left over" value={money(h.income - h.costs, s.currency)} down={h.income - h.costs < 0} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value, down }: { label: string; value: string; down?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: down ? C.signal : undefined }}>
        {value}
      </span>
    </div>
  )
}

function niceStep(max: number): number {
  const raw = max / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

function CostList({ s }: { s: Snapshot }) {
  if (s.costsYtd.length === 0) return <p className="text-sm text-neutral-500">No costs recorded this year.</p>
  const max = Math.max(...s.costsYtd.map((c) => c.amount))
  return (
    <div className="grid gap-2.5">
      {s.costsYtd.map((c) => (
        <div key={c.name} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{c.name}</span>
            <span className="font-semibold tabular-nums">{money(c.amount, s.currency)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px]" style={{ background: C.tint }}>
            <i className="block h-full rounded-[3px]" style={{ width: `${Math.max(2, (c.amount / max) * 100)}%`, background: C.mid }} />
          </div>
        </div>
      ))}
      <div className="flex justify-between px-0.5 pt-1 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{money(s.profitYtd.costs, s.currency)}</span>
      </div>
    </div>
  )
}

function Aging({ buckets, total, cur }: { buckets: { label: string; amount: number }[]; total: number; cur: string }) {
  if (total === 0) return <p className="text-sm text-neutral-500">Nothing here.</p>
  return (
    <div className="grid gap-2">
      {buckets.map((b) => {
        const late = /91|over\s*90/i.test(b.label) && b.amount > 0
        return (
          <div key={b.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
            <span className="text-neutral-500">{b.label === "Current" ? "Not yet due" : `${b.label} days`.replace(" days days", " days")}</span>
            <div className="h-1.5 overflow-hidden rounded-[3px]" style={{ background: C.tint }}>
              <i className="block h-full rounded-[3px]" style={{ width: `${total > 0 ? Math.max(0, (b.amount / total) * 100) : 0}%`, background: late ? C.signal : C.actual }} />
            </div>
            <span className="font-semibold tabular-nums" style={{ color: late ? C.signal : undefined }}>
              {money(b.amount, cur)}
            </span>
          </div>
        )
      })}
      <div className="flex justify-between pt-1 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{money(total, cur)}</span>
      </div>
    </div>
  )
}
