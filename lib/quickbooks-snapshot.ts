/**
 * The finance snapshot (V1 item 1, Phase 1): QuickBooks reports read when the page opens, reduced to the numbers the
 * approved design shows. Nothing here is stored: the result lives only in a short in-process cache.
 *
 * The books are on accrual and are not closed (founder, 2026-10-26: "Accounting method: Accrual", "Close the books"
 * Off), so every read asks for accrual and re-reads recent months; nothing is frozen.
 *
 * The parsers read Intuit's report JSON: `Columns.Column[]` (ColTitle, ColType, MetaData StartDate/EndDate/ColKey) and
 * `Rows.Row[]`, where a section has `group`, `Header`, `Rows` and `Summary`, and a data row has `ColData`. Amounts are
 * strings and may be empty. They are pure, and tested on invented reports (lib/__tests__/quickbooks-snapshot.test.ts).
 */

export interface QbColData { value?: string; id?: string }
export interface QbRow {
  type?: string
  group?: string
  ColData?: QbColData[]
  Header?: { ColData?: QbColData[] }
  Rows?: { Row?: QbRow[] }
  Summary?: { ColData?: QbColData[] }
}
export interface QbColumn { ColTitle?: string; ColType?: string; MetaData?: { Name?: string; Value?: string }[] }
export interface QbReport {
  Header?: { Currency?: string; ReportBasis?: string }
  Columns?: { Column?: QbColumn[] }
  Rows?: { Row?: QbRow[] }
}

export interface FinanceSnapshot {
  company: string
  environment: "sandbox" | "production"
  currency: string
  asOf: string
  today: string
  basis: string
  cash: { balance: number; priorMonthEnd: number | null; change: number | null; monthsOfCosts: number | null }
  receivable: { total: number; over90: number; openInvoices: number | null; buckets: { label: string; amount: number }[] }
  payable: { total: number; over90: number; buckets: { label: string; amount: number }[] }
  profitYtd: { income: number; costs: number; net: number; margin: number | null }
  /** Oldest first; the last month is month to date (`partial`). */
  months: { month: string; label: string; income: number; costs: number; net: number; partial: boolean }[]
  costsYtd: { name: string; amount: number }[]
}

export const num = (v: unknown): number => {
  const n = Number.parseFloat(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}

const meta = (c: QbColumn, name: string) => c.MetaData?.find((m) => m.Name === name)?.Value

/** Column indexes that hold money, with their dates; the "Total" column is flagged. */
export function moneyColumns(report: QbReport): { index: number; title: string; start?: string; end?: string; total: boolean }[] {
  return (report.Columns?.Column ?? [])
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => c.ColType === "Money")
    .map(({ c, index }) => ({
      index,
      title: c.ColTitle ?? "",
      start: meta(c, "StartDate"),
      end: meta(c, "EndDate"),
      total: (c.ColTitle ?? "").trim().toLowerCase() === "total" || meta(c, "ColKey") === "total",
    }))
}

/** Depth-first search for a section by its `group`. */
export function findGroup(rows: QbRow[] | undefined, group: string): QbRow | null {
  for (const row of rows ?? []) {
    if (row.group === group) return row
    const inner = findGroup(row.Rows?.Row, group)
    if (inner) return inner
  }
  return null
}

/** A section's summary amount in column `index`; 0 when the section is absent (QuickBooks omits empty sections). */
export function groupAmount(report: QbReport, group: string, index: number): number {
  const row = findGroup(report.Rows?.Row, group)
  return num(row?.Summary?.ColData?.[index]?.value)
}

/** The last money column that is not a Total: a report run without columns by month has just the one. */
function lastColumn(report: QbReport): number {
  const cols = moneyColumns(report)
  const plain = cols.filter((c) => !c.total)
  return (plain.at(-1) ?? cols.at(-1))?.index ?? 1
}

const COST_GROUPS = ["COGS", "Expenses", "OtherExpenses"] as const

/** Income and costs per month column (the Total column dropped). */
export function profitAndLossByMonth(report: QbReport): { start: string; end: string; income: number; costs: number; net: number }[] {
  return moneyColumns(report)
    .filter((c) => !c.total && c.start && c.end)
    .map((c) => {
      const income = groupAmount(report, "Income", c.index)
      const costs = COST_GROUPS.reduce((s, g) => s + groupAmount(report, g, c.index), 0)
      return { start: c.start!, end: c.end!, income, costs, net: groupAmount(report, "NetIncome", c.index) }
    })
}

/** Year-to-date totals from a P&L run without columns by month. */
export function profitAndLossTotals(report: QbReport): { income: number; costs: number; net: number } {
  const i = lastColumn(report)
  return {
    income: groupAmount(report, "Income", i),
    costs: COST_GROUPS.reduce((s, g) => s + groupAmount(report, g, i), 0),
    net: groupAmount(report, "NetIncome", i),
  }
}

/**
 * Costs by top-level category: each child of Expenses and Other Expenses by name, and cost of goods sold as one line.
 * Largest first; past `keep` lines, the rest are summed as "Everything else".
 */
export function costsByCategory(report: QbReport, keep = 8): { name: string; amount: number }[] {
  const i = lastColumn(report)
  const lines: { name: string; amount: number }[] = []
  const cogs = groupAmount(report, "COGS", i)
  if (cogs) lines.push({ name: "Cost of goods sold", amount: cogs })
  for (const g of ["Expenses", "OtherExpenses"]) {
    for (const row of findGroup(report.Rows?.Row, g)?.Rows?.Row ?? []) {
      const name = (row.Header?.ColData?.[0]?.value ?? row.ColData?.[0]?.value ?? "").trim()
      const amount = row.Summary ? num(row.Summary.ColData?.[i]?.value) : num(row.ColData?.[i]?.value)
      if (name && amount) lines.push({ name, amount })
    }
  }
  lines.sort((a, b) => b.amount - a.amount)
  if (lines.length <= keep) return lines
  const rest = lines.slice(keep - 1).reduce((s, l) => s + l.amount, 0)
  return [...lines.slice(0, keep - 1), { name: "Everything else", amount: rest }]
}

/** Bank balances at each month column of a balance sheet by month: oldest first. */
export function cashByColumn(report: QbReport): number[] {
  return moneyColumns(report)
    .filter((c) => !c.total)
    .map((c) => groupAmount(report, "BankAccounts", c.index))
}

/** An aging summary's grand total by bucket (AgedReceivables / AgedPayables). */
export function agingTotals(report: QbReport): { total: number; over90: number; buckets: { label: string; amount: number }[] } {
  const rows = report.Rows?.Row ?? []
  const grand = findGroup(rows, "GrandTotal") ?? [...rows].reverse().find((r) => r.Summary) ?? null
  const cells = grand?.Summary?.ColData ?? grand?.ColData ?? []
  const cols = moneyColumns(report)
  const buckets = cols.filter((c) => !c.total).map((c) => ({ label: c.title.replace(/\s+/g, " ").trim(), amount: num(cells[c.index]?.value) }))
  const totalCol = cols.find((c) => c.total)
  const total = totalCol ? num(cells[totalCol.index]?.value) : buckets.reduce((s, b) => s + b.amount, 0)
  const over90 = buckets.filter((b) => /91|over\s*90/i.test(b.label)).reduce((s, b) => s + b.amount, 0)
  return { total, over90, buckets }
}

// ---------------------------------------------------------------------------------------------------------------
// Dates, in the company's own time zone (San Antonio)
// ---------------------------------------------------------------------------------------------------------------

export const COMPANY_TZ = "America/Chicago"

/** YYYY-MM-DD for `ms` in the company's time zone. */
export function localDate(ms: number, tz = COMPANY_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))
}

/** The first day of the month `back` months before the month of `today` (YYYY-MM-DD). */
export function monthStart(today: string, back: number): string {
  const [y, m] = today.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 - back, 1))
  return d.toISOString().slice(0, 10)
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** The reads one snapshot needs, by name. Six months of history: the approved chart's actual half. */
export function snapshotQueries(today: string) {
  const accrual = { accounting_method: "Accrual" }
  return {
    byMonth: { path: "reports/ProfitAndLoss", params: { ...accrual, start_date: monthStart(today, 5), end_date: today, summarize_column_by: "Month" } },
    ytd: { path: "reports/ProfitAndLoss", params: { ...accrual, start_date: `${today.slice(0, 4)}-01-01`, end_date: today } },
    balance: { path: "reports/BalanceSheet", params: { ...accrual, start_date: monthStart(today, 1), end_date: today, summarize_column_by: "Month" } },
    receivable: { path: "reports/AgedReceivables", params: { report_date: today } },
    payable: { path: "reports/AgedPayables", params: { report_date: today } },
    openInvoices: { path: "query", params: { query: "select count(*) from Invoice where Balance > '0'" } },
  } as const
}

export interface SnapshotInputs {
  company: string
  environment: "sandbox" | "production"
  nowMs: number
  today: string
  byMonth: QbReport
  ytd: QbReport
  balance: QbReport
  receivable: QbReport
  payable: QbReport
  openInvoices: number | null
}

/** Assembles the snapshot from the reports. */
export function buildSnapshot(input: SnapshotInputs): FinanceSnapshot {
  const months = profitAndLossByMonth(input.byMonth).map((m, i, all) => ({
    month: m.start.slice(0, 7),
    label: `${MONTH[Number(m.start.slice(5, 7)) - 1]} ${m.start.slice(2, 4)}`,
    income: m.income,
    costs: m.costs,
    net: m.net,
    partial: i === all.length - 1 && m.start.slice(0, 7) === input.today.slice(0, 7),
  }))
  const cash = cashByColumn(input.balance)
  const balance = cash.at(-1) ?? 0
  const priorMonthEnd = cash.length >= 2 ? cash.at(-2)! : null
  // Months of costs: cash over the average of the last three complete months' costs.
  const complete = months.filter((m) => !m.partial).slice(-3)
  const avgCosts = complete.length ? complete.reduce((s, m) => s + m.costs, 0) / complete.length : 0
  const ytd = profitAndLossTotals(input.ytd)
  return {
    company: input.company,
    environment: input.environment,
    currency: input.ytd.Header?.Currency || input.byMonth.Header?.Currency || "USD",
    asOf: new Date(input.nowMs).toISOString(),
    today: input.today,
    basis: input.ytd.Header?.ReportBasis || "Accrual",
    cash: {
      balance,
      priorMonthEnd,
      change: priorMonthEnd === null ? null : balance - priorMonthEnd,
      monthsOfCosts: avgCosts > 0 ? balance / avgCosts : null,
    },
    receivable: { ...agingTotals(input.receivable), openInvoices: input.openInvoices },
    payable: agingTotals(input.payable),
    profitYtd: { ...ytd, margin: ytd.income > 0 ? ytd.net / ytd.income : null },
    months,
    costsYtd: costsByCategory(input.ytd),
  }
}
