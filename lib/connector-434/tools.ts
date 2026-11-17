/**
 * The 434 connector's tools and who sees them (434 build sequence V1 item 4, "the connector, widened"; slice 1,
 * founder approval 2026-11-17).
 *
 * The connector is the one way in (R1): any assistant, each person signed in as themself. The route builds the MCP
 * server per request, after the token is checked, and registers only the tools `toolsFor` returns, so a person's tool
 * list holds only what they may call. (The system-of-record connector lists every tool to every caller because
 * mcp-handler 2.1.1 does not pass the caller to the server factory; building per request avoids that.)
 *
 * Slice 1 has one tool, the read-only 434 context, open to every active roster member. Slice 2 adds one tool per
 * permitted skill, generated from the catalog, each gated by lib/connector-434/permissions.ts.
 *
 * Pure.
 */
export const CONNECTOR_434_SCOPE = "434:connect"
export const CONNECTOR_434_ENV_PREFIX = "CONNECTOR_434"

export interface Caller434 {
  email: string
  role: string
  /** Catalog skills this person may run (lib/connector-434/permissions.ts). Unused until slice 2. */
  skills: string[]
}

export interface Tool434 {
  name: string
  title: string
  description: string
  readOnly: boolean
}

export const CONTEXT_TOOL: Tool434 = {
  name: "get_434_context",
  title: "434 context",
  description:
    "434 MEDIA's approved company definition and descriptors, the motto, its offers by name, its properties and the " +
    "brand voice. Public, brand-level content only, with no figures. Read this before writing anything about 434.",
  readOnly: true,
}

/** The tools one caller is offered. */
export function toolsFor(caller: Caller434 | null): Tool434[] {
  if (!caller) return []
  return [CONTEXT_TOOL]
}

/** Who a verified token belongs to, from the AuthInfo the verifier returns. Null when anything is missing. */
export function callerOf(info: { scopes?: string[]; extra?: Record<string, unknown> } | undefined, skills: string[] = []): Caller434 | null {
  const email = info?.extra?.email, role = info?.extra?.role
  if (!info?.scopes?.includes(CONNECTOR_434_SCOPE) || typeof email !== "string" || typeof role !== "string") return null
  return { email, role, skills }
}
