/**
 * Tool allow-lists per skill and per autonomy level (434 build sequence V1 item 2, Foundation A: "Tool allow-lists per
 * skill and per autonomy level. A draft skill has no send, publish or write tool"; build plan v3, R1 of v2).
 *
 * Two lists decide which tools a run gets, and a tool must pass both:
 *  1. **Per skill:** the skill's `allowed-tools` (Agent Skills specification), applied by the loader
 *     (lib/skills/loader.ts skillTools). A tool the skill does not name is never offered.
 *  2. **Per autonomy level:** every tool declares its class, and the run's level admits only some classes. The level
 *     is the lower of the level the caller asks for and the skill's ceiling (the catalog's `autonomy ceiling`, R8).
 *
 * Classes, from least to most consequential:
 *  - `read`: reads data, changes nothing.
 *  - `draft`: produces a proposal held for a person (a draft reply, a draft record); changes no stored record.
 *  - `write`: changes a stored record (the CRM, a ledger, a file).
 *  - `send`: reaches a person outside 434 (email, message).
 *  - `publish`: puts something in public (a post, a page).
 *
 * Levels:
 *  - `draft`: read and draft only. The level every skill runs at until its exam passes (IMP-27; R5–R7).
 *  - `approval`: also write; send and publish only through a tool that is itself approval-gated (`gate: "approval"`:
 *    it queues for the founder-review queue and the send happens after a signed-in approval, R2), never directly.
 *  - `autonomous`: every class. IMP-27's unlock rule decides when a category gets here; money, contracts, pricing,
 *    public statements and first replies to new clients never do, and those tools declare `neverAutonomous`.
 *
 * Fails closed: a tool with no declared class, or a class this module does not know, is refused, as is any tool that
 * declares a protected target (lib/engine/protected-config.ts): the runtime has no tool that writes rule files,
 * policies or skill definitions.
 *
 * Pure. Holds no business rule: which skill sits at which level is runtime state in Firestore (Skill Building Standard
 * §5c); the ceiling is in the catalog.
 */

export const TOOL_CLASSES = ["read", "draft", "write", "send", "publish"] as const
export type ToolClass = (typeof TOOL_CLASSES)[number]

export const AUTONOMY_LEVELS = ["draft", "approval", "autonomous"] as const
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]

/** What the engine knows about a tool besides its schema. Every tool offered to a skill run needs one. */
export interface ToolDeclaration {
  class: ToolClass
  /** For send and publish: "approval" when the tool only queues the act for a signed-in founder approval. */
  gate?: "approval"
  /** Never runs autonomously, at any level (IMP-27's founder-only categories). */
  neverAutonomous?: boolean
  /** What the tool writes to: collection names or path prefixes. Checked against the protected targets. */
  writes?: string[]
}

export type ToolDeclarations = Record<string, ToolDeclaration | undefined>

const LEVEL_RANK: Record<AutonomyLevel, number> = { draft: 0, approval: 1, autonomous: 2 }

/** The lower of the two; an unknown level counts as `draft`. */
export function effectiveLevel(requested: string | undefined, ceiling: string | undefined): AutonomyLevel {
  const r = (AUTONOMY_LEVELS as readonly string[]).includes(requested ?? "") ? (requested as AutonomyLevel) : "draft"
  const c = (AUTONOMY_LEVELS as readonly string[]).includes(ceiling ?? "") ? (ceiling as AutonomyLevel) : "draft"
  return LEVEL_RANK[r] <= LEVEL_RANK[c] ? r : c
}

/** Why a tool is refused at a level, or null when it is admitted. */
export function refusal(name: string, decl: ToolDeclaration | undefined, level: AutonomyLevel, isProtected: (target: string) => boolean): string | null {
  if (!decl) return `${name}: no tool declaration (class unknown)`
  if (!(TOOL_CLASSES as readonly string[]).includes(decl.class)) return `${name}: unknown tool class "${decl.class}"`
  const hit = (decl.writes ?? []).find(isProtected)
  if (hit) return `${name}: writes "${hit}", a protected target (rule files, policies and skill definitions are never written at run time)`
  switch (level) {
    case "draft":
      return decl.class === "read" || decl.class === "draft" ? null : `${name}: a ${decl.class} tool, and a run at the draft level has none`
    case "approval":
      if (decl.class === "send" || decl.class === "publish") return decl.gate === "approval" ? null : `${name}: a ${decl.class} tool that is not approval-gated, and a run at the approval level sends and publishes only through approval`
      return null
    case "autonomous":
      if ((decl.class === "send" || decl.class === "publish" || decl.class === "write") && decl.neverAutonomous && decl.gate !== "approval")
        return `${name}: never autonomous, and not approval-gated`
      return null
  }
}

/**
 * Splits a run's candidate tools (already narrowed to the skill's `allowed-tools`) into those admitted at `level` and
 * those refused, with the reason for each.
 */
export function admitTools<T>(tools: Record<string, T>, decls: ToolDeclarations, level: AutonomyLevel, isProtected: (target: string) => boolean, alwaysAllowed: string[] = []): { admitted: Record<string, T>; refused: string[] } {
  const admitted: Record<string, T> = {}
  const refused: string[] = []
  for (const [name, t] of Object.entries(tools)) {
    if (alwaysAllowed.includes(name)) { admitted[name] = t; continue }
    const why = refusal(name, decls[name], level, isProtected)
    if (why) refused.push(why)
    else admitted[name] = t
  }
  return { admitted, refused }
}
