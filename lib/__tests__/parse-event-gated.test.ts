/**
 * Offline. /api/parse-event was reachable without signing in (security log PSM-1): anyone could make the server fetch
 * an event page and parse it. It is admin tooling with one caller, the events page, so every handler calls the admin
 * gate first (the admin-api-route skill's requireAdmin), and the route sends no wildcard CORS headers. The signed-out
 * 401 is also checked on the preview; a signed-in parse is checked on production after merge.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(__dirname, "..", "..")
const ROUTE = join(ROOT, "app", "api", "parse-event", "route.ts")
const METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS"

/** The first statement inside each `export async function METHOD(...) {`, and any handler exported another way. */
function handlers(source: string): { method: string; first: string }[] {
  const out: { method: string; first: string }[] = []
  const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+(${METHODS})\\s*\\(`, "g")
  for (let m; (m = fn.exec(source)); ) {
    let i = source.indexOf("(", m.index), depth = 0
    for (; i < source.length; i++) {
      if (source[i] === "(") depth++
      else if (source[i] === ")" && --depth === 0) break
    }
    const open = source.indexOf("{", i)
    const body = source.slice(open + 1).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))
    out.push({ method: m[1], first: body[0] ?? "" })
  }
  const other = new RegExp(`export\\s+(?:const|let|var)\\s+(${METHODS})\\b|export\\s*\\{[^}]*\\b(${METHODS})\\b`, "g")
  for (let m; (m = other.exec(source)); ) out.push({ method: m[1] || m[2], first: "<not a plain function>" })
  return out
}

const src = readFileSync(ROUTE, "utf8")

test("parse-event: every handler calls requireAdmin first, before the body is read", () => {
  const found = handlers(src)
  assert.ok(found.length > 0, "no exported handler found")
  for (const h of found) {
    assert.match(h.first, /^const\s+auth\s*=\s*await\s+requireAdmin\(\)/, `${h.method}: first statement is "${h.first}"`)
  }
  assert.ok(src.indexOf("await requireAdmin()") < src.indexOf("request.json()"), "the gate runs before the body is read")
})

test("parse-event: requireAdmin is the skill's gate — no session 401, not an admin 403", () => {
  const gate = src.slice(src.indexOf("async function requireAdmin"), src.indexOf("export async function POST"))
  assert.match(gate, /await getSession\(\)/)
  assert.match(gate, /if \(!session\) return \{ error: "Unauthorized", status: 401/)
  assert.match(gate, /if \(!isAuthorizedAdmin\(session\.email\)\)/)
  assert.match(gate, /status: 403/)
  assert.match(src, /import \{ getSession, isAuthorizedAdmin \} from "@\/lib\/auth"/)
})

test("parse-event: no wildcard CORS and no OPTIONS handler inviting cross-origin calls", () => {
  assert.doesNotMatch(src, /Access-Control-Allow-Origin/)
  assert.ok(!handlers(src).some((h) => h.method === "OPTIONS"))
})

test("the check refuses a handler that reads the body before the gate", () => {
  const bad = `export async function POST(req: Request) {\n  const { url } = await req.json()\n  const auth = await requireAdmin()\n}`
  assert.doesNotMatch(handlers(bad)[0].first, /requireAdmin/)
  assert.equal(handlers(`export const POST = handler`)[0].first, "<not a plain function>")
})

test("the only caller in this repository is the admin events page", () => {
  const callers: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx|js|mjs)$/.test(name) && !path.includes("__tests__") && path !== ROUTE && readFileSync(path, "utf8").includes("/api/parse-event")) {
        callers.push(relative(ROOT, path))
      }
    }
  }
  for (const top of ["app", "components", "lib", "scripts"]) walk(join(ROOT, top))
  assert.deepEqual(callers, [join("app", "admin", "events", "page.tsx")])
})
