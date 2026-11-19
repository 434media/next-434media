/**
 * Opportunities page regressions (founder report, 2026-11-19).
 * Run: pnpm dlx tsx --test lib/__tests__/opportunity-save-navigation.test.ts
 *
 * 1. Setting a deal to Closed Lost and pressing Save changes "didn't persist":
 *    the drawer closed, the list reloaded while ?openOpportunity= was still in
 *    the URL, and the reopen effect put the drawer back up. The reload went
 *    through the 30s per-instance list cache, so the reopened drawer showed the
 *    pre-save stage. A failed save must say so and keep the drawer open.
 * 2. A "Due today & follow-ups" card linked to ?tab=pipeline only, where the
 *    owner filter (defaulting to the signed-in user) hid other owners' deals.
 */
import { after, afterEach, test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { act, createElement, type ReactNode } from "react"
import type { Client, Toast } from "../../components/crm/types"
import type { OpportunityFormData } from "../../hooks/useClientHandlers"

const load = createRequire(__filename)
const { JSDOM } = load("jsdom")
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/admin/opportunities" })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = load("react-dom/client") as typeof import("react-dom/client")
const originalFetch = globalThis.fetch
const roots: ReturnType<typeof createRoot>[] = []
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const deal = (disposition: Client["disposition"]): Client => ({
  id: "deal-1",
  name: "Road to San Japan",
  company_name: "HEB",
  title: "Road to San Japan",
  email: "",
  phone: "",
  status: "prospect",
  brand: "MilCityUSA",
  assigned_to: "Someone Else",
  is_opportunity: true,
  disposition,
  doc: "75",
  contacts: [],
  web_links: [],
  docs: [],
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-11-18T00:00:00.000Z",
} as unknown as Client)

function mockModule(path: string, exports: unknown) {
  const filename = load.resolve(path)
  load.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule
}

// ---- The page, with visual children and the Next router replaced ----
let params = new URLSearchParams()
const replacements: string[] = []
const router = { replace: (url: string) => { replacements.push(url) }, push: (url: string) => { replacements.push(url) } }
let drawer!: { open: boolean; formData: OpportunityFormData; onSave: () => Promise<unknown>; onClose: () => void; onFormChange: (f: OpportunityFormData) => void }
let toast: Toast | null = null
const nothing = () => null
mockModule("next/navigation", { useSearchParams: () => params, useRouter: () => router, usePathname: () => "/admin/opportunities" })
mockModule("../../components/AdminRoleGuard", { AdminRoleGuard: ({ children }: { children: ReactNode }) => children })
mockModule("../../components/admin/HowItWorks", { HowItWorks: nothing })
mockModule("../../components/crm", {
  Toast: (props: { toast: Toast | null }) => { toast = props.toast; return null },
  DashboardView: nothing,
  PipelineView: nothing,
  OpportunitiesKanbanView: nothing,
  ClientsView: nothing,
  TasksView: nothing,
  ClientDetailDrawer: nothing,
  OpportunityDetailDrawer: (props: typeof drawer) => { drawer = props; return null },
  TaskDetailDrawer: nothing,
  LinkedTasksPanel: nothing,
})
const OpportunitiesPage = load("../../app/admin/opportunities/page").default

// Let fetch chains (fetch -> json -> setState) finish inside act.
async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
async function mount() {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => root.render(createElement(OpportunitiesPage)))
  await settle()
  return root
}
afterEach(async () => {
  await act(async () => { for (const root of roots.splice(0)) root.unmount() })
  document.body.innerHTML = ""
  globalThis.fetch = originalFetch
  toast = null
})
after(() => dom.window.close())

/** Production-shaped backend: a plain list read is served from a stale instance cache. */
function backend(put: (body: Record<string, unknown>) => Response) {
  let stored = deal("proposal")
  const listReads: string[] = []
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    if (url === "/api/admin/crm/clients" && options?.method === "PUT") {
      const body = JSON.parse(String(options.body)) as Record<string, unknown>
      const res = put(body)
      if (res.ok) stored = { ...stored, ...body } as Client
      return res
    }
    if (url.startsWith("/api/admin/crm/clients")) {
      listReads.push(url)
      // Only a fresh read sees the write; the cached read still has the old stage.
      return response({ clients: [url.includes("fresh=1") ? stored : deal("proposal")] })
    }
    if (url === "/api/auth/session") return response({ user: { email: "me@example.com", name: "Me" } })
    if (url === "/api/admin/team-members") return response({ success: true, data: [] })
    if (url === "/api/admin/crm") return response({ stats: {}, pipeline: [] })
    if (url.startsWith("/api/admin/crm/tasks")) return response({ tasks: [] })
    return response({})
  }
  return { listReads, stored: () => stored }
}

test("Closed Lost save closes the drawer, drops the deep link and reloads fresh", async () => {
  params = new URLSearchParams("tab=pipeline&openOpportunity=deal-1")
  replacements.length = 0
  const store = backend(() => response({ success: true }))
  const root = await mount()
  assert.equal(drawer.open, true, "deep link opens the deal")
  assert.equal(drawer.formData.disposition, "proposal")

  await act(async () => drawer.onFormChange({ ...drawer.formData, disposition: "closed_lost" }))
  await act(async () => { await drawer.onSave() })
  // Let the post-save reload land while the router still shows the old URL.
  await settle()
  await act(async () => root.render(createElement(OpportunitiesPage)))

  assert.equal(store.stored().disposition, "closed_lost", "the PUT carried Closed Lost")
  assert.equal(drawer.open, false, "the reload must not reopen the drawer it just closed")
  assert.equal(replacements.at(-1), "/admin/opportunities?tab=pipeline", "the deep link is dropped")
  assert.ok(store.listReads.includes("/api/admin/crm/clients?fresh=1"), "the post-save reload skips the list cache")
  assert.equal(toast?.type, "success")

  // Once the router applies the replacement, a later deep link opens the saved stage.
  params = new URLSearchParams("tab=pipeline")
  await act(async () => root.render(createElement(OpportunitiesPage)))
  params = new URLSearchParams("tab=pipeline&openOpportunity=deal-1")
  await act(async () => root.render(createElement(OpportunitiesPage)))
  await settle()
  assert.equal(drawer.open, true)
  assert.equal(drawer.formData.disposition, "closed_lost")
})

test("a failed save keeps the drawer open and shows the server's error", async () => {
  params = new URLSearchParams("tab=pipeline&openOpportunity=deal-1")
  replacements.length = 0
  backend(() => response({ error: "Failed to update client" }, 500))
  await mount()
  await act(async () => drawer.onFormChange({ ...drawer.formData, disposition: "closed_lost" }))
  await act(async () => { await drawer.onSave() })
  await settle()
  assert.equal(drawer.open, true, "edits stay on screen")
  assert.equal(drawer.formData.disposition, "closed_lost")
  assert.equal(toast?.type, "error")
  assert.match(toast?.message ?? "", /not saved: Failed to update client/)
  assert.ok(!replacements.some((u) => !u.includes("openOpportunity=deal-1")), "the deep link stays")
})

test("a follow-up card links to its exact opportunity, whoever owns it", async () => {
  mockModule("../../lib/auth", { getSession: async () => ({ email: "me@example.com" }), isAuthorizedAdmin: () => true })
  mockModule("../../lib/firestore-leads", { getLeads: async () => [] })
  const today = new Date().toISOString().split("T")[0]
  mockModule("../../lib/firestore-crm", { getClients: async () => [{ ...deal("proposal"), next_followup_date: today }] })
  const { GET } = load("../../app/api/admin/followups/route") as { GET: () => Promise<Response> }
  const body = await (await GET()).json() as { items: Array<{ type: string; href: string }> }
  const item = body.items.find((i) => i.type === "opportunity")
  assert.equal(item?.href, "/admin/opportunities?tab=pipeline&openOpportunity=deal-1")
})

test("the dashboard's Active Opportunities leaves out archived deals, whatever stage they still carry", async () => {
  globalThis.fetch = async () => response({})
  const { DashboardView } = load("../../components/crm/DashboardView") as typeof import("../../components/crm/DashboardView")
  const open = { ...deal("proposal"), id: "open-1", title: "Open deal", is_archived: false } as Client
  // Production, 2026-11-19: archived on Jul 5 but still at Proposal.
  const archived = { ...deal("proposal"), id: "arch-1", title: "Archived deal", is_archived: true, archived_at: "2026-07-05T23:53:29.316Z" } as Client
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  const props = {
    stats: null, pipeline: [], clients: [open, archived], tasks: [],
    onViewChange: () => {}, onShowClientForm: () => {}, onClientClick: () => {}, onOpportunityClick: () => {}, onTaskClick: () => {},
    currentUser: null,
  } as unknown as Parameters<typeof DashboardView>[0]
  await act(async () => root.render(createElement(DashboardView, props)))
  await settle()
  const text = container.textContent ?? ""
  assert.match(text, /Active Opportunities\(1\)/)
  assert.match(text, /Open deal/)
  assert.doesNotMatch(text, /Archived deal/)
})

// ---- /api/admin/crm: the quota warning needs a quota error, not an empty store ----
async function crmDashboard(reads: { clients?: () => Promise<unknown[]>; tasks?: () => Promise<unknown[]> }) {
  mockModule("../../lib/auth", { getSession: async () => ({ email: "me@example.com" }), isAuthorizedAdmin: () => true })
  mockModule("../../lib/firestore-crm", {
    getClients: reads.clients ?? (async () => []),
    getOpportunities: async () => [],
    getSalesReps: async () => [],
    getAllTasks: reads.tasks ?? (async () => []),
  })
  const route = load.resolve("../../app/api/admin/crm/route")
  delete load.cache[route]
  const { GET } = load(route) as { GET: () => Promise<Response> }
  return await (await GET()).json() as { success?: boolean; warning?: string }
}

test("an empty store is not a quota error", async () => {
  const body = await crmDashboard({})
  assert.equal(body.success, true)
  assert.equal(body.warning, undefined)
})

test("a RESOURCE_EXHAUSTED read shows the quota warning; another failure says data may be incomplete", async () => {
  const quiet = console.error
  console.error = () => {}
  try {
    const quota = Object.assign(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."), { code: 8 })
    const exhausted = await crmDashboard({ clients: async () => { throw quota } })
    assert.match(exhausted.warning ?? "", /quota exceeded/i)
    const other = await crmDashboard({ tasks: async () => { throw Object.assign(new Error("14 UNAVAILABLE"), { code: 14 }) } })
    assert.ok(other.warning && !/quota/i.test(other.warning), "a non-quota failure is not called a quota error")
  } finally {
    console.error = quiet
  }
})
