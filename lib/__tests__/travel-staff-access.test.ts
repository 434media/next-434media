/**
 * Offline. Who reads a travel itinerary as staff (security log PSM-2; founder's ruling 2026-11-10, "Approve option 1"):
 * super admins and full admins only. `crm_only` and `intern` sessions, and any unknown role, get no staff access and
 * need a travel_access record for the page. Signed-in behaviour is checked on production after merge, because previews
 * cannot sign in.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { STAFF_TRAVEL_ROLES, staffReadsItineraries } from "../travel/staff-access"
import { ADMIN_ROLES } from "../session-cookie"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")

test("super admins and full admins read every itinerary as staff", () => {
  assert.equal(staffReadsItineraries("crm_super_admin"), true)
  assert.equal(staffReadsItineraries("full_admin"), true)
  assert.deepEqual([...STAFF_TRAVEL_ROLES].sort(), ["crm_super_admin", "full_admin"])
})

test("crm_only and intern do not; they need a travel_access record", () => {
  assert.equal(staffReadsItineraries("crm_only"), false)
  assert.equal(staffReadsItineraries("intern"), false)
})

test("a missing, empty or unknown role is refused", () => {
  for (const r of [undefined, null, "", "admin", "FULL_ADMIN", "traveler", " full_admin"]) {
    assert.equal(staffReadsItineraries(r as string), false, String(r))
  }
})

test("every admin role is decided: exactly two of the four are staff for travel", () => {
  assert.deepEqual(ADMIN_ROLES.filter(staffReadsItineraries).sort(), ["crm_super_admin", "full_admin"])
})

test("getTravelAccess admits a staff session only through the role check", () => {
  const src = read("lib/travel/auth.ts")
  const fn = src.slice(src.indexOf("export async function getTravelAccess"))
  assert.match(fn, /const staff = await getSession\(\)\n\s*if \(staff && staffReadsItineraries\(staff\.role\)\) \{/)
  assert.equal((fn.match(/source: "staff"/g) || []).length, 1, "one staff branch only")
  assert.ok(fn.indexOf("staffReadsItineraries(staff.role)") < fn.indexOf('source: "staff"'))
})

test("no travel page or route reads the admin session directly; all go through getTravelAccess", () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name)) files.push(path)
    }
  }
  for (const d of ["app/travel", "app/api/travel", "components/travel", "lib/travel"]) walk(join(ROOT, d))
  const direct = files
    .map((f) => relative(ROOT, f))
    .filter((f) => f !== join("lib", "travel", "auth.ts"))
    .filter((f) => /\bgetSession\b|isAuthorizedAdmin|SESSION_COOKIE/.test(read(f)))
  assert.deepEqual(direct, [])
  for (const f of ["app/api/travel/[project]/[traveler]/route.ts", "app/api/travel/[project]/[traveler]/editor-notes/route.ts", "app/travel/[project]/[traveler]/page.tsx"]) {
    assert.match(read(f), /await getTravelAccess\(projectSlug, travelerSlug\)/, f)
  }
})
