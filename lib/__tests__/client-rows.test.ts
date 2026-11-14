/**
 * Offline. The Clients list rows (lib/crm/client-rows.ts): two client records that share a company name are two rows,
 * so neither is hidden behind the other; opportunities still collapse into their company's row.
 *
 * Run: tsx --test lib/__tests__/client-rows.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { clientRows } from "../crm/client-rows"

test("two client records with one company name are two rows (neither hidden)", () => {
  const rows = clientRows([
    { id: "a", company_name: "First Foundation (a note)" },
    { id: "b", company_name: "first foundation (a note) " },
  ])
  assert.deepEqual(rows.map((r) => r.id), ["a", "b"])
})

test("opportunities collapse into their company's client row, and an opportunity-only company shows once", () => {
  const rows = clientRows([
    { id: "opp1", company_name: "Acme", is_opportunity: true },
    { id: "client", company_name: "Acme" },
    { id: "opp2", company_name: "Acme", is_opportunity: true },
    { id: "opp3", company_name: "Solo Co", is_opportunity: true },
    { id: "opp4", company_name: "Solo Co", is_opportunity: true },
  ])
  assert.deepEqual(rows.map((r) => r.id), ["client", "opp3"])
})

test("departments stay separate rows; a record with no name is left out", () => {
  const rows = clientRows([
    { id: "a", company_name: "Acme", department: "Marketing" },
    { id: "b", company_name: "Acme", department: "Events" },
    { id: "c", company_name: "", name: "" },
  ])
  assert.deepEqual(rows.map((r) => r.id), ["a", "b"])
})

test("the Clients view uses it", () => {
  const src = readFileSync(join(__dirname, "..", "..", "components/crm/ClientsView.tsx"), "utf-8")
  assert.match(src, /clientRows\(clients\)/)
  assert.doesNotMatch(src, /clients\.reduce\(/)
})
