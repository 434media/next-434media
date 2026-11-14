// The rows of the Clients list. Pure, so it is tested (lib/__tests__/client-rows.test.ts).
//
// Opportunity records carry their company's name, so a company with opportunities would otherwise show once per
// opportunity: those collapse into one row per company (and department), preferring the client record. Two client
// records are two rows even when they share a name. Collapsing them hid the second record, so an edit made from the
// one visible row could not be told apart from the other record (2026-11-14: two client records named for one
// foundation, one of them a contact at another company).

export interface ClientRowInput {
  id: string
  company_name?: string
  name?: string
  department?: string
  is_opportunity?: boolean
}

export function clientRows<T extends ClientRowInput>(clients: T[]): T[] {
  const rows: T[] = []
  /** Company/department key → index of the row an opportunity-only company is shown on. */
  const byKey = new Map<string, number>()
  const keyOf = (c: T) => {
    const company = (c.company_name || c.name || "").toLowerCase().trim()
    const dept = (c.department || "").toLowerCase().trim()
    return company ? (dept ? `${company}|${dept}` : company) : ""
  }
  // Client records first: each is its own row.
  for (const c of clients) {
    if (c.is_opportunity || !keyOf(c)) continue
    if (!byKey.has(keyOf(c))) byKey.set(keyOf(c), rows.length)
    rows.push(c)
  }
  // An opportunity shows only when its company has no row yet (an opportunity-only company), once per company.
  for (const c of clients) {
    if (!c.is_opportunity || !keyOf(c) || byKey.has(keyOf(c))) continue
    byKey.set(keyOf(c), rows.length)
    rows.push(c)
  }
  return rows
}
