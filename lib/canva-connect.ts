import { createHash } from "node:crypto"
import { authorizeUrl, completeConnect, pkce, CanvaError, type CanvaDeps } from "./canva-export"

/**
 * One-time Canva connection by a CRM super-admin, on the existing admin session (no new login system).
 * start: PKCE verifier + state are stored server-side (by hash of state), the browser is sent to Canva.
 * finish: the state is consumed once, must be unexpired and started by the same admin, then the code is exchanged.
 */
export interface ConnectDeps {
  canva: CanvaDeps
  session(): Promise<{ email: string } | null>
  isSuperAdmin(email: string): Promise<boolean>
  saveState(stateHash: string, verifier: string, by: string, expiresAtMs: number): Promise<void>
  takeState(stateHash: string, nowMs: number): Promise<{ verifier: string; by: string } | null>
}
const hash = (state: string) => createHash("sha256").update(state).digest("hex")

export async function startCanvaConnect(deps: ConnectDeps): Promise<{ status: number; location?: string; error?: string }> {
  const s = await deps.session()
  if (!s) return { status: 401, error: "Sign in to the admin first" }
  if (!await deps.isSuperAdmin(s.email)) return { status: 403, error: "Super-admin required to connect Canva" }
  const { verifier, challenge, state } = pkce()
  await deps.saveState(hash(state), verifier, s.email, deps.canva.nowMs() + 600_000)
  return { status: 302, location: authorizeUrl(deps.canva.client, challenge, state) }
}

export async function finishCanvaConnect(deps: ConnectDeps, query: URLSearchParams): Promise<{ status: number; location?: string; error?: string }> {
  const s = await deps.session()
  if (!s) return { status: 401, error: "Sign in to the admin first" }
  if (!await deps.isSuperAdmin(s.email)) return { status: 403, error: "Super-admin required to connect Canva" }
  const state = query.get("state") || "", code = query.get("code") || ""
  if (query.get("error")) return { status: 400, error: "Canva connection was not approved" }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(state) || !code || code.length > 2048) return { status: 400, error: "Invalid Canva callback" }
  const pending = await deps.takeState(hash(state), deps.canva.nowMs())
  if (!pending || pending.by !== s.email) return { status: 400, error: "Canva connection expired or was started by someone else; start again" }
  try { await completeConnect(deps.canva, { code, verifier: pending.verifier, by: s.email }) }
  catch (err) {
    console.error("[canva] connect failed:", connectFailureCode(err))
    return { status: 502, error: "Canva sign-in failed; start again" }
  }
  return { status: 302, location: "/admin/content?canva=connected" }
}

/**
 * What to log when the connect fails: Canva's short error code (for example invalid_client or http_401) for a token
 * refusal, or the stage that failed. Never Canva's message, a token, the code or the client secret.
 */
export function connectFailureCode(err: unknown): string {
  if (err instanceof CanvaError) {
    if (!err.code) return "store_conflict"
    return /^[A-Za-z0-9_.:-]{1,64}$/.test(err.code) ? `token:${err.code}` : "token:unrecognized"
  }
  return `store:${err instanceof Error && /^[A-Za-z]{1,40}$/.test(err.name) ? err.name : "error"}`
}
