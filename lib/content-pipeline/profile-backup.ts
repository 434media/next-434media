import { createHash, timingSafeEqual } from "node:crypto"
import { versionDocId, BRAND_ID, type ProfileVersion } from "./profile-store"

/**
 * The record of each published profile version in 434-context (plan v11.1, Step 2b). 434-context is no longer where
 * profiles are edited; it keeps a copy of every version as published, for the record.
 *
 * The site holds no token that can write to 434-context (founder, 2026-10-19: "No backup token on the site"). 434-context
 * pulls instead: a daily workflow there finds the highest v<n>.json it already has for each brand, asks the read-only
 * endpoint GET /api/brand-profiles/backups for the newer versions, writes each record to backupPath and opens a pull
 * request, so the founder's merge stays the approval. Nothing is written back: what is backed up is what 434-context
 * holds. The endpoint is gated by its own read-only credential (BACKUP_READ_TOKEN_ENV), separate from the admin session.
 */
export const BACKUP_READ_TOKEN_ENV = "BRAND_PROFILE_BACKUP_READ_TOKEN"
/** A configured credential shorter than this is treated as unset: the endpoint refuses rather than accept a weak one. */
export const MIN_READ_TOKEN_LENGTH = 32
export const backupPath = (v: Pick<ProfileVersion, "brand_id" | "n">) => `06 Standards/Brand Profiles/Published/${v.brand_id}/${versionDocId(v.n)}.json`

/** The backed-up record: the version as published, newline-terminated, keys in a stable order. Versions published
 * before Step 2b still carry a stored `backup` status field; it is not part of the record. */
export function backupRecord(v: ProfileVersion): string {
  const rest: Partial<ProfileVersion> & { backup?: unknown } = { ...v }
  delete rest.backup
  return `${JSON.stringify({ record: "434 brand profile, published version (backup; the database is the source)", ...rest }, null, 2)}\n`
}

/** One version as the endpoint lists it: where it goes in 434-context and the exact bytes to write there. */
export interface BackupEntry { brand_id: string; n: number; version_id: string; path: string; record: string }
export const backupEntry = (v: ProfileVersion): BackupEntry => ({ brand_id: v.brand_id, n: v.n, version_id: v.version_id, path: backupPath(v), record: backupRecord(v) })

/**
 * `after=milcity:4,txmx:0` → { milcity: 4, txmx: 0 }: the highest version 434-context holds per brand. A brand not
 * named starts from 0, so a new brand's versions are all listed. Anything malformed returns null (400).
 */
export function parseAfter(raw: string | null): Record<string, number> | null {
  const after: Record<string, number> = {}
  if (!raw) return after
  for (const part of raw.split(",")) {
    const m = /^([a-z][a-z0-9-]{1,30}):(\d{1,6})$/.exec(part.trim())
    if (!m || !BRAND_ID.test(m[1]) || m[1] in after) return null
    after[m[1]] = Number(m[2])
  }
  return after
}

/**
 * Whether the request carries the read credential. Both sides are hashed first, so the comparison is constant-time
 * and equal-length whatever the caller sends, and neither the length nor a prefix of the secret leaks. "unset" when
 * the credential is missing or too short: the endpoint then refuses everyone.
 */
export function readTokenCheck(authorization: string | null, env: Record<string, string | undefined> = process.env): "ok" | "denied" | "unset" {
  const expected = env[BACKUP_READ_TOKEN_ENV]
  if (!expected || expected.length < MIN_READ_TOKEN_LENGTH) return "unset"
  const bearer = /^Bearer (\S+)$/.exec(authorization ?? "")?.[1]
  if (!bearer) return "denied"
  const digest = (s: string) => createHash("sha256").update(s).digest()
  return timingSafeEqual(digest(bearer), digest(expected)) ? "ok" : "denied"
}

/** What the endpoint reads: the brands, and each brand's versions above a number. Reads only. */
export interface BackupSource {
  list(): Promise<{ id: string }[]>
  versionsAfter(id: string, n: number): Promise<ProfileVersion[]>
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } })

/**
 * GET /api/brand-profiles/backups?after=milcity:4 with `Authorization: Bearer <BRAND_PROFILE_BACKUP_READ_TOKEN>`:
 * every published version above the given numbers, all brands, oldest first per brand, each as its backup record.
 * 503 when the credential is not configured (refused for everyone), 401 for a wrong or missing one, 400 for a
 * malformed `after`, 500 when the database read fails. It writes nothing and sends no CORS headers.
 */
export async function serveBackups(req: Request, source: () => Promise<BackupSource>, env: Record<string, string | undefined> = process.env): Promise<Response> {
  const check = readTokenCheck(req.headers.get("authorization"), env)
  if (check === "unset") {
    console.error(`[GET /api/brand-profiles/backups] ${BACKUP_READ_TOKEN_ENV} is not set (or shorter than ${MIN_READ_TOKEN_LENGTH}); refusing`)
    return json({ error: "Backup endpoint not configured" }, 503)
  }
  if (check === "denied") return json({ error: "Unauthorized" }, 401)
  const after = parseAfter(new URL(req.url).searchParams.get("after"))
  if (!after) return json({ error: "after must look like milcity:4,txmx:0" }, 400)
  try {
    const store = await source()
    const brands = (await store.list()).map(d => d.id).filter(id => BRAND_ID.test(id)).sort()
    const versions: BackupEntry[] = []
    for (const id of brands) for (const v of await store.versionsAfter(id, after[id] ?? 0)) versions.push(backupEntry(v))
    return json({ versions }, 200)
  } catch (err) {
    console.error("[GET /api/brand-profiles/backups]", err)
    return json({ error: "Could not read brand profiles" }, 500)
  }
}
