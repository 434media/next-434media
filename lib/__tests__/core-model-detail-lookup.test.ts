/**
 * Offline. A detail read rebuilds the cached core view once when the id is missing, because the record may have been
 * saved a moment ago on another instance (the People drawer showed "Not found" after a save that replaced a record
 * read from an old list). Run: tsx --test lib/__tests__/core-model-detail-lookup.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { findWithOneRebuild } from "../core-model/detail-lookup"

type View = { people: { id: string }[] }
const finder = (id: string) => (v: View) => v.people.find((p) => p.id === id) ?? null

function views(stale: View, fresh: View) {
  const calls = { get: 0, rebuild: 0 }
  return {
    calls,
    get: async () => { calls.get++; return stale },
    rebuild: async () => { calls.rebuild++; return fresh },
  }
}

test("found in the cached view: no rebuild", async () => {
  const v = views({ people: [{ id: "a" }] }, { people: [{ id: "a" }] })
  assert.deepEqual(await findWithOneRebuild(v.get, v.rebuild, finder("a")), { id: "a" })
  assert.deepEqual(v.calls, { get: 1, rebuild: 0 })
})

test("missing from a stale cache, present after one rebuild: found", async () => {
  const v = views({ people: [{ id: "old" }] }, { people: [{ id: "old" }, { id: "new" }] })
  assert.deepEqual(await findWithOneRebuild(v.get, v.rebuild, finder("new")), { id: "new" })
  assert.deepEqual(v.calls, { get: 1, rebuild: 1 })
})

test("missing after the rebuild too: a real not-found, and only one rebuild", async () => {
  const v = views({ people: [] }, { people: [] })
  assert.equal(await findWithOneRebuild(v.get, v.rebuild, finder("nope")), null)
  assert.deepEqual(v.calls, { get: 1, rebuild: 1 })
})

test("both detail routes, GET and PATCH, use it", () => {
  for (const f of ["app/api/admin/core/people/[id]/route.ts", "app/api/admin/core/organizations/[id]/route.ts"]) {
    const src = readFileSync(join(process.cwd(), f), "utf8")
    assert.equal(src.match(/findWithOneRebuild\(/g)?.length, 2, f)
    assert.match(src, /rebuildVisibleCoreView\(viewer\)/, f)
  }
})

test("a read after a write never shares a build that started before it", () => {
  const src = readFileSync(join(process.cwd(), "lib/core-model/read.ts"), "utf8")
  assert.match(src, /if \(inFlight && inFlightGeneration === generation\) return inFlight/)
  assert.match(src, /if \(inFlight === pending\) inFlight = null/)
})
