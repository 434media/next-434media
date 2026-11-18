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
 * The Ask panel's tools (V1 item 4, Ask panel slice 1; founder approval 2026-11-18) live here too, so there is one
 * list for the panel, outside assistants and, at item 7, Slack: a person who holds `admin-ask` is offered them, and
 * nobody else is. Each declares its engine class (lib/engine/tool-policy.ts). At most ASK_TOOL_LIMIT tools in slice 1;
 * each new one needs a build-sequence line. The MCP route registers only the context tool for now (its handler loop
 * skips the rest), so these reach no outside assistant until the connector's door opens (SEC-1 to SEC-5).
 *
 * Pure.
 */
import type { ToolClass } from "../engine/tool-policy"

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
  /** The engine class (lib/engine/tool-policy.ts): what a run at a given level may call. */
  class: ToolClass
}

export const CONTEXT_TOOL: Tool434 = {
  name: "get_434_context",
  title: "434 context",
  description:
    "434 MEDIA's approved company definition and descriptors, the motto, its offers by name, its properties and the " +
    "brand voice. Public, brand-level content only, with no figures. Read this before writing anything about 434.",
  readOnly: true,
  class: "read",
}

/** The Ask panel's skill (434-context `03 Skills/admin-ask/`). Holding it is what offers the tools below. */
export const ASK_SKILL = "admin-ask"
/** Slice 1's ceiling on the panel's tools, the context tool included (plan guardrail: "at most 8 tools in slice 1"). */
export const ASK_TOOL_LIMIT = 8

/**
 * The Ask panel's tools, beyond the context tool. Reads change nothing; `write` tools apply at once and carry an
 * Undo; the one `draft` tool only proposes, and the person's Confirm carries the change out. No tool sends, posts or
 * touches money: those requests are refused, with a link to To do or Finance.
 */
export const ASK_TOOLS: Tool434[] = [
  {
    name: "whats_waiting",
    title: "What's waiting",
    description: "What is waiting on the person asking: drafts waiting for a decision and untriaged arrivals in the inbox, as their own inbox shows them. Ids, names, short summaries and how long each has waited.",
    readOnly: true,
    class: "read",
  },
  {
    name: "find",
    title: "Find",
    description: "Find people, organizations, opportunities and tasks by words in a name, company, email, title or task title. Returns ids with a few fields each, only what the person asking may see.",
    readOnly: true,
    class: "read",
  },
  {
    name: "triage_arrival",
    title: "Triage an arrival",
    description: "Decide one untriaged inbox arrival: promote (make a lead), save (keep as a contact) or dismiss. Applies at once; the person gets Undo for two minutes.",
    readOnly: false,
    class: "write",
  },
  {
    name: "update_task",
    title: "Update a task",
    description: "Change one task's due date, status or assignee. Applies at once; the value before is kept, and the person gets Undo for two minutes.",
    readOnly: false,
    class: "write",
  },
  {
    name: "propose_stage_change",
    title: "Propose a stage change",
    description: "Propose moving an opportunity's stage (discovery, proposal, closed_won, closed_lost) or a person's lifecycle stage (contact, lead, customer). Changes nothing: the person sees a Confirm card and decides.",
    readOnly: true,
    class: "draft",
  },
]

/** The tools one caller is offered: the context tool to everyone, the Ask tools only to a holder of `admin-ask`. */
export function toolsFor(caller: Caller434 | null): Tool434[] {
  if (!caller) return []
  return caller.skills.includes(ASK_SKILL) ? [CONTEXT_TOOL, ...ASK_TOOLS] : [CONTEXT_TOOL]
}

/** Who a verified token belongs to, from the AuthInfo the verifier returns. Null when anything is missing. */
export function callerOf(info: { scopes?: string[]; extra?: Record<string, unknown> } | undefined, skills: string[] = []): Caller434 | null {
  const email = info?.extra?.email, role = info?.extra?.role
  if (!info?.scopes?.includes(CONNECTOR_434_SCOPE) || typeof email !== "string" || typeof role !== "string") return null
  return { email, role, skills }
}
