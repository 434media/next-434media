/**
 * The exam's tools are mocks. Nothing in lib/exam sends, posts or writes anything real: every tool a case offers is
 * built here from the suite's JSON description, records the call, checks the caller's scope, and returns the suite's
 * canned result. This module imports no client for email, Slack, Meta, Firestore or any other store, and a test pins
 * that (lib/__tests__/exam.test.ts).
 */
import { jsonSchema, tool, type ToolSet } from "ai"
import type { Scope, ToolSpec } from "./suite"

/** One call an executor made, accepted by the mock or rejected for scope. */
export interface ToolCallRecord {
  tool: string
  args: Record<string, unknown>
  accepted: boolean
  /** Why the mock refused it. */
  rejection?: string
  /** Set by the runner on any call whose arguments fall outside the caller's scope, accepted or not. */
  outOfScope?: string
}

/**
 * Whether a value falls in a scope list. An entry is an exact value (case-insensitive), `*@domain` for any address at
 * that domain, or `*` for anything. An empty list admits nothing: scope fails closed.
 */
export function inScope(value: string, allowed: string[]): boolean {
  const v = value.trim().toLowerCase()
  return allowed.some(a => {
    const p = a.trim().toLowerCase()
    if (p === "*") return true
    if (p.startsWith("*@")) return v.endsWith(p.slice(1))
    return v === p
  })
}

/**
 * Check a call's arguments against the caller's scope: each argument the tool's spec maps to a scope list must hold
 * only values in it. Arrays are checked element by element; an address in "Name <a@b.example>" form is reduced to the
 * address. Returns the first problem, or undefined.
 */
export function scopeProblem(spec: Pick<ToolSpec, "scope">, args: Record<string, unknown>, scope: Scope | undefined): string | undefined {
  for (const [arg, list] of Object.entries(spec.scope)) {
    if (!(arg in args)) continue
    const raw = args[arg]
    const values = (Array.isArray(raw) ? raw : [raw]).map(v => {
      const s = String(v ?? "")
      const m = /<([^>]+)>/.exec(s)
      return m ? m[1] : s
    })
    const allowed = scope?.[list] ?? []
    for (const v of values) if (!inScope(v, allowed)) return `${arg} "${v}" is outside the caller's ${list}`
  }
  return undefined
}

/** Build the mock tool set for one case. Calls land in `log`; nothing else happens. */
export function mockTools(specs: ToolSpec[], scope: Scope | undefined, log: ToolCallRecord[]): ToolSet {
  const tools: ToolSet = {}
  for (const spec of specs) {
    tools[spec.name] = tool({
      description: spec.description,
      inputSchema: jsonSchema(spec.input as Parameters<typeof jsonSchema>[0]),
      execute: async (input: unknown) => {
        const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
        const problem = scopeProblem(spec, args, scope)
        log.push({ tool: spec.name, args, accepted: !problem, ...(problem ? { rejection: problem } : {}) })
        return problem ? { ok: false, rejected: true, reason: problem } : spec.result
      },
    })
  }
  return tools
}
