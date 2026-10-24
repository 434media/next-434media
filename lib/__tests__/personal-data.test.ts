/**
 * Offline. The personal data that used to be hard-coded here (event roles, a traveller's route) now lives in
 * Firestore: the modules normalize what they read, the one-time import is create-or-skip, and the personal-data
 * check fails on addresses, phone numbers and the old paths. Invented data only; Firestore is an in-memory fake.
 * Addresses are assembled at run time so this file never trips the check it tests.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createEventRoleOverlayIfAbsent,
  getEventRoleOverlay,
  invalidateEventRoleOverlaysCache,
  normalizeEventRoleOverlay,
  roleTagsFor,
} from "../firestore-event-role-overlays"
import {
  createTravelProjectIfAbsent,
  getTravelProject,
  getTravelProjectRecord,
  invalidateTravelProjectsCache,
} from "../firestore-travel-projects"
import { projectsFromLegacy, rolesFromLegacy } from "../../scripts/personal-data/import"
import { findPersonalData, redact, type Allowlist } from "../../scripts/personal-data/check"

const at = (user: string, domain: string) => `${user}@${domain}`

function fakeDb() {
  const store = new Map<string, Record<string, unknown>>()
  let reads = 0
  const db = {
    collection: (c: string) => ({
      doc: (id: string) => {
        const key = `${c}/${id}`
        return {
          get: async () => {
            reads++
            const data = store.get(key)
            return { id, exists: !!data, data: () => (data ? structuredClone(data) : undefined) }
          },
          create: async (data: Record<string, unknown>) => {
            if (store.has(key)) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 })
            for (const v of Object.values(data)) if (v === undefined) throw new Error("undefined value")
            store.set(key, structuredClone(data))
          },
        }
      },
    }),
  }
  return { db: db as unknown as FirebaseFirestore.Firestore, store, reads: () => reads }
}

test("an overlay keeps role tags only, and lowercases, trims and de-duplicates emails", () => {
  const o = normalizeEventRoleOverlay("ev", {
    roles: { "role:speaker": [` ${at("Pat", "Example.com")} `, at("pat", "example.com"), 7, ""], "site:x": [at("a", "example.com")], "role:empty": [] },
  })
  assert.deepEqual(o.roles, { "role:speaker": [at("pat", "example.com")] })
  assert.equal(o.eventSlug, "ev")
  assert.deepEqual(roleTagsFor(o, at("PAT", "example.com")), ["role:speaker"])
  assert.deepEqual(roleTagsFor(o, at("other", "example.com")), [])
  assert.deepEqual(roleTagsFor(null, at("pat", "example.com")), [])
  assert.deepEqual(roleTagsFor(o, undefined), [])
})

test("the overlay import is create-or-skip and never overwrites", async () => {
  const { db, store } = fakeDb()
  invalidateEventRoleOverlaysCache()
  assert.equal(await getEventRoleOverlay("ev-a", db), null)
  assert.deepEqual(await createEventRoleOverlayIfAbsent("ev-a", { "role:judge": [at("J", "example.com")] }, db), { created: true })
  assert.deepEqual(await createEventRoleOverlayIfAbsent("ev-a", { "role:judge": [at("someone-else", "example.com")] }, db), { created: false })
  const back = await getEventRoleOverlay("ev-a", db)
  assert.deepEqual(back?.roles, { "role:judge": [at("j", "example.com")] })
  assert.equal(store.size, 1)
})

test("the old role file maps to the three role tags it used to add", () => {
  const roles = rolesFromLegacy({ speakers: [at("S", "example.com")], pitchCompanies: [], semifinalJudges: [at("j", "example.com"), at("J", "example.com")] })
  assert.deepEqual(roles, { "role:tech-day-speaker": [at("s", "example.com")], "role:tech-fuel-semifinal-judge": [at("j", "example.com")] })
  assert.throws(() => rolesFromLegacy({ speakers: [] }), /pitchCompanies/)
})

const legacyTravel = {
  "client-agm-2026": {
    slug: "client-agm-2026", client: "Client Co", purpose: "AGM", year: 2026, startDate: "2026-01-01", endDate: "2026-01-09",
    airtableBaseId: "appInvented000000",
    travelers: { tv: { slug: "tv", name: "Invented Person", displayName: "IP", routeStops: [{ code: "AUS", city: "Austin", dates: "Jan 1", home: true }, { code: "DEN", city: "Denver", dates: "Jan 2" }] } },
  },
}

test("a travel project round-trips through the import, and a stop that is not home carries no home field", async () => {
  const { db, store } = fakeDb()
  invalidateTravelProjectsCache()
  const [input] = projectsFromLegacy(legacyTravel)
  assert.deepEqual(await createTravelProjectIfAbsent(input, db), { created: true })
  assert.deepEqual(await createTravelProjectIfAbsent(input, db), { created: false })
  const stored = store.get("travel_projects/client-agm-2026") as { travelers: Record<string, { routeStops: object[] }> }
  assert.equal("home" in stored.travelers.tv.routeStops[1], false)
  const back = await getTravelProjectRecord("client-agm-2026", db)
  assert.equal(back?.client, "Client Co")
  assert.equal(back?.year, 2026)
  assert.deepEqual(back?.travelers, input.travelers)
  const pair = await getTravelProject("client-agm-2026", "tv", db)
  assert.equal(pair?.traveler.displayName, "IP")
  assert.equal(await getTravelProject("client-agm-2026", "nobody", db), null)
  assert.equal(await getTravelProject("client-agm-2026", "__proto__", db), null)
})

test("a slug from a URL that is not a plain slug is null without a read", async () => {
  const { db, reads } = fakeDb()
  invalidateTravelProjectsCache()
  assert.equal(await getTravelProjectRecord("../x", db), null)
  assert.equal(await getTravelProjectRecord("A/B", db), null)
  assert.equal(reads(), 0)
  assert.equal(await getTravelProjectRecord("missing", db), null)
  assert.equal(reads(), 1)
})

const allow: Allowlist = {
  domains: ["434media.com", "example.com"],
  addresses: [at("a", "b.co")],
  skipPaths: [],
  forbiddenPaths: [],
  pending: [],
}

test("the check flags a real-looking address and phone, and passes placeholders", () => {
  const real = at("someone", "gmail.com")
  const text = [
    `speakers: ["${real}"]`,
    `ok: ${at("build", "434media.com")} ${at("hello", "send.434media.com")} ${at("you", "example.com")} ${at("x", "demo.test")} ${at("a", "b.co")}`,
    "logo: brand@2x.png",
    "call (210) 555-0142 or 210-555-0100",
    "id 2105550100 and 1234567890",
    `phone: ${["(210)", "732-4411"].join(" ")}`,
  ].join("\n")
  const found = findPersonalData("lib/x.ts", text, allow)
  assert.deepEqual(found.map((f) => [f.line, f.kind]), [[1, "email"], [6, "phone"]])
  assert.equal(redact(found[0]), "s***@gmail.com")
  assert.equal(redact(found[1]), "***-***-**11")
})

test("a pending entry clears one address in one file and nowhere else", () => {
  const real = at("someone", "gmail.com")
  const [f] = findPersonalData("lib/a.ts", real, allow)
  const withPending = { ...allow, pending: [{ path: "lib/a.ts", sha256: f.sha256, reason: "test" }] }
  assert.equal(findPersonalData("lib/a.ts", real, withPending).length, 0)
  assert.equal(findPersonalData("lib/b.ts", real, withPending).length, 1)
  assert.equal(findPersonalData("lib/a.ts", at("another", "gmail.com"), withPending).length, 1)
})
