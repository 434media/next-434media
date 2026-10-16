import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto"
import type { AdminRole } from "./auth"
import type { SlackMessage } from "./owned-meta-tool"
import { parseApprovers } from "./owned-meta-tool"
import type { ToolDeps, ToolName, ToolResult } from "./owned-meta-tool-handler"
import type { Principal } from "./owned-meta-intake"

/**
 * Service entry for the shared Slack app (hosted in the cos-crm-pilot project) to call the MCU publisher here.
 * Two independent checks, both fail-closed:
 *  1. The calling SERVICE: a Vercel OIDC token (RS256, team issuer JWKS) whose issuer, audience, subject, team,
 *     project and environment equal the configured pilot production identity, unexpired with zero tolerance.
 *     No stored secret is involved; any other project, preview or team is refused.
 *  2. The ACTING PERSON named by the pilot (the Slack-verified sender): this site's own per-person content
 *     permissions, then the existing admin gate (authorizeAdminSignIn) and, for anything beyond reading, a
 *     send-capable role. The pilot's own scopes are not trusted for this decision.
 * Approval is the founder's own Slack message, relayed by the authenticated pilot from Slack's signed event; it
 * must come from an allowlisted approver who is also the acting person, say "approve" and quote the hash prefix.
 */
export const CONTENT_SCOPES = ["content:read", "content:prepare", "content:approve", "content:publish"] as const
export type ContentScope = typeof CONTENT_SCOPES[number]
export const SERVICE_TOOL_SCOPE: Record<ToolName, ContentScope> = {
  find_posts: "content:read", status: "content:read", health: "content:read",
  create_post: "content:prepare", attach_exports: "content:prepare", attach_canva_design: "content:prepare", canva_template_fields: "content:prepare", canva_create_design: "content:prepare", canva_preview: "content:prepare", prepare: "content:prepare", record_external: "content:prepare", exclude: "content:prepare",
  approve: "content:approve", execute: "content:publish",
}
export interface ServiceConfig { issuer: string; audience: string; subject: string; teamId: string; projectId: string; people: { email: string; scopes: ContentScope[] }[] }
export interface ServiceDeps {
  config: ServiceConfig
  jwks(kid?: string): Promise<JsonWebKey[]>
  nowSeconds(): number
  authorize(email: string): Promise<{ authorized: true; role: AdminRole } | { authorized: false; reason: string }>
  sendCapable(email: string, role: AdminRole): Promise<boolean>
  approvers: string | undefined
  toolDeps(): Promise<ToolDeps>
  run(name: ToolName, input: unknown, principal: Principal, deps: ToolDeps): Promise<ToolResult>
  onRefuse?(reason: string): void
}

const b64json = (part: string): Record<string, unknown> | null => { try { const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8")); return v && typeof v === "object" && !Array.isArray(v) ? v : null } catch { return null } }

/** Returns null when the token is the configured pilot production identity, else a refusal reason (no claim values). */
export async function verifyServiceToken(token: string | undefined, deps: Pick<ServiceDeps, "config" | "jwks" | "nowSeconds">): Promise<string | null> {
  const c = deps.config
  const m = token ? /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token) : null
  if (!m) return "no_bearer_jwt"
  const header = b64json(m[1]), p = b64json(m[2])
  if (!header || !p) return "malformed"
  if (header.alg !== "RS256" || typeof header.kid !== "string") return "alg"
  let keys: JsonWebKey[]
  try { keys = await deps.jwks(header.kid) } catch { return "jwks_unavailable" }
  const jwk = keys.find(k => k.kid === header.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256"))
  if (!jwk) return "kid"
  let ok = false
  try { ok = verifySignature("RSA-SHA256", Buffer.from(`${m[1]}.${m[2]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(m[3], "base64url")) } catch { ok = false }
  if (!ok) return "signature"
  const now = deps.nowSeconds()
  if (p.iss !== c.issuer) return "issuer"
  if (!(p.aud === c.audience || Array.isArray(p.aud) && p.aud.length === 1 && p.aud[0] === c.audience)) return "audience"
  if (p.sub !== c.subject) return "subject"
  if (p.owner_id !== c.teamId) return "team"
  if (p.project_id !== c.projectId) return "project"
  if (p.environment !== "production") return "environment"
  if (typeof p.exp !== "number" || p.exp <= now) return "expired"
  if (p.nbf !== undefined && (typeof p.nbf !== "number" || p.nbf > now)) return "not_yet_valid"
  return null
}

export interface ServiceRequest { tool: ToolName; args: unknown; actor: { email: string; slackUserId: string }; approval?: { channel: string; ts: string; text: string; slackUserId: string } }

export async function handleServiceRequest(bearer: string | undefined, body: unknown, deps: ServiceDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  const refuse = (status: number, reason: string, error: string) => { try { deps.onRefuse?.(reason) } catch { /* reporting never changes the decision */ } return { status, body: { error } } }
  const service = await verifyServiceToken(bearer, deps)
  if (service) return refuse(401, `service:${service}`, "Service authentication failed")
  const r = body as Partial<ServiceRequest> | null
  if (!r || typeof r.tool !== "string" || !(r.tool in SERVICE_TOOL_SCOPE) || !r.actor || typeof r.actor.email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(r.actor.email) || typeof r.actor.slackUserId !== "string" || !/^U[A-Z0-9]{6,}$/.test(r.actor.slackUserId)) return refuse(400, "request", "Invalid request")
  const tool = r.tool as ToolName, email = r.actor.email.toLowerCase(), need = SERVICE_TOOL_SCOPE[tool]
  // The acting person, checked here on this site's own terms.
  const person = deps.config.people.find(x => x.email === email)
  if (!person?.scopes.includes(need)) return refuse(403, `person:${need}`, `This person does not have ${need}`)
  const gate = await deps.authorize(email)
  if (!gate.authorized) return refuse(403, "person:admin_gate", "This person is not an authorized admin")
  if (need !== "content:read" && !await deps.sendCapable(email, gate.role)) return refuse(403, "person:send_role", "This person's role cannot publish or change content")
  const toolDeps = await deps.toolDeps()
  if (tool === "approve") {
    // Only the acting person's own Slack message can approve, and only if they are an allowlisted approver.
    const a = r.approval
    const approvers = parseApprovers(deps.approvers)
    if (!a || a.slackUserId !== r.actor.slackUserId || approvers.get(a.slackUserId) !== email || typeof a.text !== "string" || typeof a.channel !== "string" || typeof a.ts !== "string") return refuse(403, "approval", "Approval must be the approver's own Slack message")
    const relayed: SlackMessage = { ts: a.ts, user: a.slackUserId, text: a.text }
    const args = { ...(r.args as Record<string, unknown>), approval: { channel: a.channel, ts: a.ts } }
    return deps.run(tool, args, { email }, { ...toolDeps, readSlackMessage: async (channel, ts) => channel === a.channel && ts === a.ts ? relayed : undefined })
  }
  return deps.run(tool, r.args, { email }, toolDeps)
}

export function loadServiceConfig(env: Record<string, string | undefined>): { config: ServiceConfig | null; problems: string[] } {
  const problems: string[] = []
  const issuer = env.OWNED_META_SERVICE_ISSUER ?? "", audience = env.OWNED_META_SERVICE_AUDIENCE ?? "", subject = env.OWNED_META_SERVICE_SUBJECT ?? ""
  const teamId = env.OWNED_META_SERVICE_TEAM_ID ?? "", projectId = env.OWNED_META_SERVICE_PROJECT_ID ?? ""
  if (!/^https:\/\/oidc\.vercel\.com\/[A-Za-z0-9_-]+$/.test(issuer)) problems.push("OWNED_META_SERVICE_ISSUER")
  if (!/^https:\/\/vercel\.com\/[A-Za-z0-9_-]+$/.test(audience)) problems.push("OWNED_META_SERVICE_AUDIENCE")
  if (!/^owner:[A-Za-z0-9_-]+:project:[A-Za-z0-9._-]+:environment:production$/.test(subject)) problems.push("OWNED_META_SERVICE_SUBJECT")
  if (!/^team_[A-Za-z0-9]+$/.test(teamId)) problems.push("OWNED_META_SERVICE_TEAM_ID")
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId)) problems.push("OWNED_META_SERVICE_PROJECT_ID")
  let people: ServiceConfig["people"] = []
  try {
    const raw = JSON.parse(env.OWNED_META_SERVICE_PEOPLE || "null")
    if (!Array.isArray(raw) || !raw.length || raw.length > 50 || !raw.every(x => x && Object.keys(x).sort().join(",") === "email,scopes" && /^[^\s@]+@434media\.com$/i.test(x.email) && Array.isArray(x.scopes) && x.scopes.length && x.scopes.every((s: unknown) => (CONTENT_SCOPES as readonly unknown[]).includes(s))) || new Set(raw.map(x => String(x.email).toLowerCase())).size !== raw.length) throw new Error()
    people = raw.map(x => ({ email: String(x.email).toLowerCase(), scopes: [...new Set(x.scopes as ContentScope[])] }))
  } catch { problems.push("OWNED_META_SERVICE_PEOPLE") }
  return problems.length ? { config: null, problems } : { config: { issuer, audience, subject, teamId, projectId, people }, problems }
}
