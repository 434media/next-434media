import { versionDocId, type BackupState, type ProfileVersion } from "./profile-store"

/**
 * The record of each published profile version in 434-context (plan v11, Step 1, item 6). 434-context is no longer
 * where profiles are edited; it keeps a copy of every version as published, for the record.
 *
 * The copy is committed to a records branch (BACKUP_BRANCH) of the private 434-context repository through the GitHub
 * contents API, with a token in BACKUP_TOKEN_ENV that may write to that repository's contents. Commits land on the
 * branch, never on main: they reach main through a pull request the founder merges, as every 434-context record does.
 * Without the token the version keeps backup.status "pending", and `scripts/brand-profiles/profile.ts backup-pending`
 * writes the pending versions to a local 434-context worktree for a working session to commit by pull request.
 */
export const BACKUP_TOKEN_ENV = "BRAND_PROFILE_BACKUP_GITHUB_TOKEN"
export const BACKUP_REPO = "434media/434-context"
export const BACKUP_BRANCH = "records/brand-profile-backups"
export const backupPath = (v: Pick<ProfileVersion, "brand_id" | "n">) => `06 Standards/Brand Profiles/Published/${v.brand_id}/${versionDocId(v.n)}.json`

/** The backed-up record: the version as published, newline-terminated, keys in a stable order. */
export function backupRecord(v: ProfileVersion): string {
  const rest: Partial<ProfileVersion> = { ...v }
  delete rest.backup
  return `${JSON.stringify({ record: "434 brand profile, published version (backup; the database is the source)", ...rest }, null, 2)}\n`
}

type Fetch = typeof fetch
export async function backupToGitHub(v: ProfileVersion, token: string, f: Fetch = fetch, now = () => new Date().toISOString()): Promise<BackupState> {
  const api = `https://api.github.com/repos/${BACKUP_REPO}`
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json" }
  const call = async (method: string, url: string, body?: unknown) => {
    const r = await f(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> }
  }
  const path = backupPath(v)
  try {
    // The records branch, created from main the first time.
    const branch = await call("GET", `${api}/git/ref/heads/${BACKUP_BRANCH}`)
    if (branch.status === 404) {
      const main = await call("GET", `${api}/git/ref/heads/main`)
      const sha = (main.json.object as { sha?: string } | undefined)?.sha
      if (!sha) throw new Error(`could not read main (${main.status})`)
      const made = await call("POST", `${api}/git/refs`, { ref: `refs/heads/${BACKUP_BRANCH}`, sha })
      if (made.status !== 201) throw new Error(`could not create ${BACKUP_BRANCH} (${made.status})`)
    } else if (branch.status !== 200) throw new Error(`could not read ${BACKUP_BRANCH} (${branch.status})`)
    const url = `${api}/contents/${path.split("/").map(encodeURIComponent).join("/")}`
    const content = Buffer.from(backupRecord(v)).toString("base64")
    const existing = await call("GET", `${url}?ref=${encodeURIComponent(BACKUP_BRANCH)}`)
    if (existing.status === 200 && typeof existing.json.content === "string" && existing.json.content.replace(/\n/g, "") === content) return { status: "done", path, at: now() }
    const put = await call("PUT", url, { message: `Brand profile backup: ${v.version_id} (published by ${v.published_by}, ${v.published_at})`, content, branch: BACKUP_BRANCH, ...(existing.status === 200 ? { sha: existing.json.sha } : {}) })
    if (put.status !== 200 && put.status !== 201) throw new Error(`commit failed (${put.status})`)
    return { status: "done", path, commit: String((put.json.commit as { sha?: string } | undefined)?.sha ?? ""), at: now() }
  } catch (err) {
    return { status: "failed", path, at: now(), error: (err instanceof Error ? err.message : String(err)).slice(0, 300) }
  }
}

/** Backs up a just-published version when the token is set; otherwise it stays pending. Never throws. */
export async function backupPublished(v: ProfileVersion, mark: (backup: BackupState) => Promise<void>, env: Record<string, string | undefined> = process.env): Promise<BackupState> {
  const token = env[BACKUP_TOKEN_ENV]
  if (!token) return v.backup
  const state = await backupToGitHub(v, token)
  await mark(state).catch(err => console.error("[brand-profiles] backup state not saved", v.version_id, err))
  return state
}
