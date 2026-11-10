/**
 * Offline. Every API route under app/api/admin/finance calls requireFounder as the first statement of every handler
 * (lib/founder-guard.ts). The proxy covers only the finance page, so this is what stops a later route, such as Phase 1's
 * QuickBooks connect and callback, from shipping without the founder-only gate.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(__dirname, "..", "..")
const DIR = join(ROOT, "app", "api", "admin", "finance")
const METHODS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS"

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return /^route\.(ts|tsx|js)$/.test(name) ? [path] : []
  })
}

/** The first statement inside each `export async function METHOD(...) {`, and any handler exported another way. */
function handlers(source: string): { method: string; first: string }[] {
  const out: { method: string; first: string }[] = []
  const fn = new RegExp(`export\\s+async\\s+function\\s+(${METHODS})\\s*\\(`, "g")
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
  for (let m; (m = other.exec(source)); ) out.push({ method: m[1] || m[2], first: "<not a plain async function>" })
  return out
}

test("the finance API has at least one route", () => {
  assert.ok(routeFiles(DIR).length > 0)
})

for (const file of routeFiles(DIR)) {
  const name = relative(ROOT, file)
  test(`${name}: every handler calls requireFounder first`, () => {
    const found = handlers(readFileSync(file, "utf8"))
    assert.ok(found.length > 0, "no exported handler found")
    for (const h of found) {
      assert.match(h.first, /^const\s+\w+\s*=\s*await\s+requireFounder\(/, `${h.method}: first statement is "${h.first}"`)
    }
  })
}

test("the check refuses a handler that reads the body before the gate", () => {
  const bad = `export async function POST(req: Request) {\n  const body = await req.json()\n  const auth = await requireFounder("x")\n}`
  assert.doesNotMatch(handlers(bad)[0].first, /requireFounder/)
  assert.equal(handlers(`export const GET = handler`)[0].first, "<not a plain async function>")
})
