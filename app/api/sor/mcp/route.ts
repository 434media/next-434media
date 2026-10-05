/**
 * System-of-record connector — a read-only MCP server.
 *
 * Method: Vercel's documented approach for hosting an MCP server in a Next.js
 * App Router app — `mcp-handler` v2 with `@modelcontextprotocol/server` v2,
 * mounted as a route and exported as GET and POST.
 * https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel (last updated
 * 2026-09-18). Clients connect over Streamable HTTP; the framework determines
 * the route, so no base path is configured here.
 *
 * Zod 4 is installed under the alias `zod4` and imported only here. mcp-handler
 * v2 needs Zod 4, and this repo is on 3.25. The `zod/v4` subpath looks like the
 * answer and is not: in 3.25.76 its `~standard` carries only validate, vendor
 * and version, with no `jsonSchema`, which is precisely what the SDK reads to
 * advertise a tool's argument shape. Checked rather than assumed, after the
 * types failed to infer.
 *
 * An alias keeps the upgrade local. Two other files import zod, and neither has
 * anything to do with this route; moving the whole repository to Zod 4 is a
 * change that deserves its own pull request and its own reason.
 *
 * Auth is bearer-token rather than OAuth. The doc's OAuth path needs an
 * authorization server; there is none, and two static tokens in Vercel env
 * express what is actually being distinguished: 434's own jobs, and everything
 * outward-facing. `verifyToken` maps a token to a scope and nothing else.
 *
 * The public scope is not a filter applied per tool — every row leaves through
 * `project()` in lib/sor/visibility.ts, so a tool added later cannot forget it.
 *
 * Known limitation: `tools/list` returns every tool to every caller. No data
 * leaks — each internal tool refuses at call time — but the names and
 * descriptions of internal collections are visible to a public token.
 *
 * The SDK supports fixing this: its `McpServerFactory` receives an
 * `McpRequestContext` carrying `authInfo`, so internal tools could simply not be
 * registered for a public caller. `mcp-handler` 2.1.1, the version Vercel's
 * documentation pins, does not pass it through — it calls
 * `initializeServer(server)` with one argument. Casting to the wider SDK type
 * compiles and then silently hands every caller `undefined`, which would drop
 * the internal tools for the internal token too.
 *
 * So this waits for a version of the wrapper that forwards the context, or for
 * dropping the wrapper. Recorded rather than forced.
 */
import type { AuthInfo } from "@modelcontextprotocol/server"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod4"
import { listCollection, getOne, listPartnerServices, type Envelope } from "@/lib/sor/read"
import { type Scope } from "@/lib/sor/visibility"

export const maxDuration = 60

const scopeOf = (info?: AuthInfo): Scope =>
  info?.scopes?.includes("sor:internal") ? "internal" : "public"

const json = (value: Envelope<unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
})

/** Refusal that names the scope, so a caller learns the boundary rather than guessing. */
const denied = (tool: string) => ({
  content: [{
    type: "text" as const,
    text: JSON.stringify({ error: `${tool} is internal. This token has the public scope.` }, null, 2),
  }],
  isError: true,
})

const handler = createMcpHandler((server) => {
  server.registerTool("get_policy", {
    description: "The current policy document and voice files, with version. Internal only.",
    inputSchema: z.object({}),
  }, async (_args, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("get_policy")
    const result = await listCollection("policy_documents", "internal")
    // An empty policy collection is not "there is no policy" — it is a broken
    // deployment, and a job that reads the former will draft without any rules
    // at all. Say so loudly rather than returning an empty list.
    if (result.data.length === 0) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          error: "policy_documents is empty. The policy has not been loaded. Do not proceed.",
        }, null, 2) }],
        isError: true,
      }
    }
    return json(result)
  })

  server.registerTool("list_portfolio_records", {
    description:
      "Portfolio records. The public scope returns published records with public fields only.",
    inputSchema: z.object({
      commercial_model: z.string().optional(),
      category: z.string().optional(),
      published: z.boolean().optional(),
    }),
  }, async ({ commercial_model, category, published }, extra) =>
    json(await listCollection("portfolio_records", scopeOf(extra?.http?.authInfo), (r) =>
      (commercial_model === undefined || r.commercial_model === commercial_model) &&
      (category === undefined || (Array.isArray(r.production_categories) && r.production_categories.includes(category))) &&
      (published === undefined || r.published === published))))

  server.registerTool("get_portfolio_record", {
    description: "One portfolio record by key. Public scope sees public fields only.",
    inputSchema: z.object({ key: z.string() }),
  }, async ({ key }, extra) => json(await getOne("portfolio_records", key, scopeOf(extra?.http?.authInfo))))

  server.registerTool("list_icp_cohorts", {
    description: "ICP buyer cohorts A-E. Internal only. Not the CRM's Digital Canvas cohorts.",
    inputSchema: z.object({}),
  }, async (_args, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("list_icp_cohorts")
    return json(await listCollection("icp_cohorts", "internal"))
  })

  server.registerTool("get_icp_cohort", {
    description: "One ICP cohort by key. Internal only.",
    inputSchema: z.object({ key: z.string() }),
  }, async ({ key }, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("get_icp_cohort")
    return json(await getOne("icp_cohorts", key, "internal"))
  })

  server.registerTool("list_cohort_rules", {
    description:
      "Outbound constraints for a cohort: first-pitch constraints, operating rules, hard " +
      "escalations, founder reviews. Internal only. Read these before writing outbound for a " +
      "cohort — a hard escalation is a stop, not a style note.",
    inputSchema: z.object({ cohort: z.enum(["A", "B", "C", "D", "E"]).optional() }),
  }, async ({ cohort }, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("list_cohort_rules")
    return json(await listCollection("cohort_rules", "internal",
      (r) => !cohort || r.cohort === cohort))
  })

  server.registerTool("get_threshold", {
    description:
      "Qualification thresholds for a subject. Internal, and never quoted to a prospect.",
    inputSchema: z.object({ applies_to: z.string() }),
  }, async ({ applies_to }, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("get_threshold")
    return json(await listCollection("qualification_thresholds", "internal", (r) => r.applies_to === applies_to))
  })

  server.registerTool("list_partner_services", {
    description:
      "Partner services, each carrying a stale flag when last_reviewed is more than 31 days old (master 2.11). Internal only.",
    inputSchema: z.object({ tier: z.string().optional() }),
  }, async ({ tier }, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("list_partner_services")
    return json(await listPartnerServices("internal", tier))
  })

  server.registerTool("list_rate_card", {
    description: "Rate card lines. The public scope returns published anchors only.",
    inputSchema: z.object({ layer: z.enum(["fixed_minimum", "public_anchor", "internal_cost"]).optional() }),
  }, async ({ layer }, extra) =>
    json(await listCollection("rate_card_lines", scopeOf(extra?.http?.authInfo),
      (r) => layer === undefined || r.layer === layer)))

  server.registerTool("list_launch_dependencies", {
    description:
      "Open items whose status changes what a job may do — whether the investor intake form is " +
      "live (IMP-12), whether a Ntooitive inbox exists (IMP-10), whether an agent may send at all " +
      "(IMP-27). Each row carries effect_while_open, written to be followed without the register. " +
      "Read this before acting on any rule that cites an IMP. Internal only.",
    inputSchema: z.object({ status: z.enum(["open", "closed"]).optional() }),
  }, async ({ status }, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("list_launch_dependencies")
    return json(await listCollection("launch_dependencies", "internal",
      (r) => status === undefined || r.status === status))
  })

  server.registerTool("list_contractors", {
    description: "Contractors. Internal only. Populated when the Contractor Brief job is built.",
    inputSchema: z.object({}),
  }, async (_args, extra) => {
    if (scopeOf(extra?.http?.authInfo) !== "internal") return denied("list_contractors")
    return json(await listCollection("contractors", "internal"))
  })
})

/**
 * A token is compared with `timingSafeEqual` on equal-length buffers. A plain
 * `===` on a secret leaks its length and prefix to a patient caller, and there
 * is no reason to accept that when the fix is three lines.
 */
async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined
  const { timingSafeEqual } = await import("node:crypto")
  const matches = (expected?: string) => {
    if (!expected) return false
    const a = Buffer.from(bearer)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  if (matches(process.env.SOR_MCP_TOKEN_INTERNAL)) {
    return { token: bearer, clientId: "sor-internal", scopes: ["sor:internal", "sor:public"] }
  }
  if (matches(process.env.SOR_MCP_TOKEN_PUBLIC)) {
    return { token: bearer, clientId: "sor-public", scopes: ["sor:public"] }
  }
  return undefined
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["sor:public"],
})

export { authHandler as GET, authHandler as POST }
