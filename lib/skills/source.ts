/**
 * Where a business skill comes from at run time (434 build sequence V1 item 4, the proof slice; founder decision D1,
 * 2026-11-14: "approve the GitHub App").
 *
 * Business skills live only in the private 434-context repository, never in this public one (Skill Building Standard
 * §2), and the site holds no token that can write there (CLAUDE.md, "No backup token on the site"). So a run reads the
 * skill through a GitHub App that can only read:
 *  - the App has one permission, Contents: read, and is installed on 434media/434-context alone;
 *  - its id and private key are Vercel Production Sensitive variables (`CONTEXT_APP_ID`, `CONTEXT_APP_PRIVATE_KEY`);
 *  - each read mints a short-lived installation token (an hour at most, Contents: read, that one repository), so no
 *    long-lived token exists anywhere.
 *
 * A skill is read **at a commit**, never at a branch: the run's pin names the commit, and the folder read there must
 * hash to the pinned fingerprint (lib/skills/loader.ts). A file changed on `main` changes nothing until the founder
 * pins the new commit. Content at a commit never changes, so it is cached by commit; tokens are cached until five
 * minutes before they expire.
 *
 * Reads only. The `fetch` is injectable, so the tests run without GitHub.
 */
import { createHash, createSign } from "node:crypto"
import type { SkillFiles } from "./loader"

export const CONTEXT_REPO = { owner: "434media", repo: "434-context" } as const
export const SKILLS_DIR = "03 Skills"
export const CATALOG_PATH = "03 Skills/skills-index.json"
export const APP_ID_ENV = "CONTEXT_APP_ID"
export const APP_KEY_ENV = "CONTEXT_APP_PRIVATE_KEY"

const API = "https://api.github.com"
const COMMIT = /^[a-f0-9]{40}$/
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const LIMITS = { files: 500, bytes: 30 * 1024 * 1024 } as const

export class SkillSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SkillSourceError"
  }
}

export interface SourceDeps {
  fetch?: typeof fetch
  env?: Record<string, string | undefined>
  now?: () => number
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")

/** The App's own JWT (RS256): issued a minute in the past for clock drift, valid nine minutes. GitHub allows ten. */
export function appJwt(appId: string, privateKeyPem: string, nowMs: number): string {
  const iat = Math.floor(nowMs / 1000) - 60
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const body = b64url(JSON.stringify({ iat, exp: iat + 600 - 60, iss: appId }))
  const signer = createSign("RSA-SHA256")
  signer.update(`${head}.${body}`)
  return `${head}.${body}.${b64url(signer.sign(privateKeyPem))}`
}

function credentials(env: Record<string, string | undefined>): { appId: string; key: string } {
  const appId = (env[APP_ID_ENV] ?? "").trim()
  // Vercel stores a multi-line value as is; a value pasted with literal "\n" is accepted too.
  const key = (env[APP_KEY_ENV] ?? "").replace(/\\n/g, "\n").trim()
  if (!/^\d+$/.test(appId) || !key.includes("PRIVATE KEY")) throw new SkillSourceError(`The skill source is not configured (${APP_ID_ENV}, ${APP_KEY_ENV})`)
  return { appId, key }
}

let tokenCache: { token: string; expiresAt: number } | null = null
const contentCache = new Map<string, SkillFiles>()

/** For tests: forget cached tokens and content. */
export function resetSkillSourceCache(): void {
  tokenCache = null
  contentCache.clear()
}

async function gh(path: string, init: RequestInit, deps: SourceDeps): Promise<Response> {
  const res = await (deps.fetch ?? fetch)(`${API}${path}`, {
    ...init,
    headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "434-skill-source", ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new SkillSourceError(`GitHub ${init.method ?? "GET"} ${path.split("?")[0]}: ${res.status}`)
  return res
}

/**
 * A short-lived installation token, narrowed again at minting to Contents: read on 434-context alone, whatever the App
 * is later granted.
 */
export async function installationToken(deps: SourceDeps = {}): Promise<string> {
  const now = (deps.now ?? Date.now)()
  if (tokenCache && tokenCache.expiresAt - 5 * 60_000 > now) return tokenCache.token
  const { appId, key } = credentials(deps.env ?? process.env)
  const jwt = appJwt(appId, key, now)
  const auth = { authorization: `Bearer ${jwt}` }
  const inst = (await (await gh(`/repos/${CONTEXT_REPO.owner}/${CONTEXT_REPO.repo}/installation`, { headers: auth }, deps)).json()) as { id?: number }
  if (!inst?.id) throw new SkillSourceError("The App is not installed on 434-context")
  const minted = (await (
    await gh(`/app/installations/${inst.id}/access_tokens`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ repositories: [CONTEXT_REPO.repo], permissions: { contents: "read" } }),
    }, deps)
  ).json()) as { token?: string; expires_at?: string; permissions?: Record<string, string> }
  if (!minted?.token) throw new SkillSourceError("GitHub returned no installation token")
  // Refuse a token that can do more than read contents: the App was given more than it should hold.
  const extra = Object.entries(minted.permissions ?? {}).filter(([k, v]) => !(k === "contents" && v === "read") && !(k === "metadata" && v === "read"))
  if (extra.length) throw new SkillSourceError(`The App's token carries more than Contents: read (${extra.map(([k, v]) => `${k}:${v}`).join(", ")}); fix the App before any run`)
  tokenCache = { token: minted.token, expiresAt: Date.parse(minted.expires_at ?? "") || now + 50 * 60_000 }
  return minted.token
}

async function authed(path: string, deps: SourceDeps): Promise<Response> {
  return gh(path, { headers: { authorization: `Bearer ${await installationToken(deps)}` } }, deps)
}

/** The commit a ref (a branch, a tag or a commit) points at now. Used only when the founder pins a version. */
export async function resolveCommit(ref: string, deps: SourceDeps = {}): Promise<string> {
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(ref)) throw new SkillSourceError("Not a ref")
  const c = (await (await authed(`/repos/${CONTEXT_REPO.owner}/${CONTEXT_REPO.repo}/commits/${encodeURIComponent(ref)}`, deps)).json()) as { sha?: string }
  if (!c?.sha || !COMMIT.test(c.sha)) throw new SkillSourceError("GitHub returned no commit")
  return c.sha
}

interface TreeEntry { path: string; type: string; sha: string; size?: number }

/** One file at a commit, as text. */
export async function readFileAt(commit: string, path: string, deps: SourceDeps = {}): Promise<string> {
  if (!COMMIT.test(commit)) throw new SkillSourceError("A skill is read at a full commit id, never a branch")
  const key = `file:${commit}:${path}`
  const hit = contentCache.get(key)
  if (hit) return hit[path]
  const encoded = path.split("/").map(encodeURIComponent).join("/")
  const res = await authed(`/repos/${CONTEXT_REPO.owner}/${CONTEXT_REPO.repo}/contents/${encoded}?ref=${commit}`, deps)
  const body = (await res.json()) as { content?: string; encoding?: string; type?: string }
  if (body?.type !== "file" || body.encoding !== "base64" || typeof body.content !== "string") throw new SkillSourceError(`${path} is not a file at ${commit.slice(0, 7)}`)
  const text = Buffer.from(body.content, "base64").toString("utf8")
  contentCache.set(key, { [path]: text })
  return text
}

/**
 * A folder under `03 Skills/` at a commit: every text file under it, by its path inside the folder. Binary files are
 * left out, as readSkillFolder leaves them out, so a skill's fingerprint is the one the loader computes on a checkout.
 * Each file is checked against the git object id GitHub listed for it.
 */
export async function readFolderAt(folder: string, commit: string, deps: SourceDeps = {}): Promise<SkillFiles> {
  if (!COMMIT.test(commit)) throw new SkillSourceError("A skill is read at a full commit id, never a branch")
  if (!folder.startsWith(`${SKILLS_DIR}/`) || folder.split("/").some((s) => !s || s === "." || s === "..")) throw new SkillSourceError("Only a folder under 03 Skills/ is read")
  const key = `folder:${commit}:${folder}`
  const hit = contentCache.get(key)
  if (hit) return { ...hit }
  const prefix = `${folder}/`
  const tree = (await (await authed(`/repos/${CONTEXT_REPO.owner}/${CONTEXT_REPO.repo}/git/trees/${commit}?recursive=1`, deps)).json()) as { tree?: TreeEntry[]; truncated?: boolean }
  if (tree?.truncated) throw new SkillSourceError("The repository tree is too large to list in one read")
  const blobs = (tree?.tree ?? []).filter((e) => e.type === "blob" && e.path.startsWith(prefix))
  if (!blobs.length) throw new SkillSourceError(`Nothing at ${folder} in ${commit.slice(0, 7)}`)
  if (blobs.length > LIMITS.files) throw new SkillSourceError(`${folder} has over ${LIMITS.files} files`)
  const files: SkillFiles = {}
  let total = 0
  for (const b of blobs.sort((x, y) => x.path.localeCompare(y.path))) {
    const blob = (await (await authed(`/repos/${CONTEXT_REPO.owner}/${CONTEXT_REPO.repo}/git/blobs/${b.sha}`, deps)).json()) as { content?: string; encoding?: string }
    if (blob?.encoding !== "base64" || typeof blob.content !== "string") throw new SkillSourceError(`Unreadable file ${b.path}`)
    const buf = Buffer.from(blob.content, "base64")
    // The blob is content-addressed: check it is the content GitHub listed.
    const gitSha = createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex")
    if (gitSha !== b.sha) throw new SkillSourceError(`File ${b.path} does not match its listed content`)
    total += buf.length
    if (total > LIMITS.bytes) throw new SkillSourceError(`${folder} is over ${LIMITS.bytes} bytes`)
    if (buf.includes(0)) continue
    files[b.path.slice(prefix.length)] = buf.toString("utf8")
  }
  contentCache.set(key, files)
  return { ...files }
}

/** A skill's folder (`03 Skills/<skill>/`) at a commit. */
export async function readSkillAt(skill: string, commit: string, deps: SourceDeps = {}): Promise<SkillFiles> {
  if (!SKILL_NAME.test(skill)) throw new SkillSourceError("Not a skill name")
  return readFolderAt(`${SKILLS_DIR}/${skill}`, commit, deps)
}

/** An exam suite's folder (`03 Skills/evals/exam/<suite>/`) at a commit: suite.json and cases/*.json. */
export async function readSuiteAt(suite: string, commit: string, deps: SourceDeps = {}): Promise<Record<string, string>> {
  if (!SKILL_NAME.test(suite)) throw new SkillSourceError("Not a suite name")
  const all = await readFolderAt(`${SKILLS_DIR}/evals/exam/${suite}`, commit, deps)
  return Object.fromEntries(Object.entries(all).filter(([p]) => p === "suite.json" || /^cases\/[^/]+\.json$/.test(p)))
}

/** What the catalog (03 Skills/skills-index.json) says of a skill: its autonomy ceiling, model and properties. */
export interface CatalogEntry {
  autonomy_ceiling: string | null
  model: string | null
  properties: string[] | null
  data_class: string | null
}

export function catalogEntry(catalogText: string, skill: string): CatalogEntry {
  let parsed: { skills?: Record<string, Partial<CatalogEntry>> }
  try {
    parsed = JSON.parse(catalogText)
  } catch {
    throw new SkillSourceError("The catalog is not JSON")
  }
  const e = parsed?.skills?.[skill]
  if (!e) throw new SkillSourceError(`${skill} is not in the catalog`)
  return {
    autonomy_ceiling: typeof e.autonomy_ceiling === "string" ? e.autonomy_ceiling : null,
    model: typeof e.model === "string" ? e.model : null,
    properties: Array.isArray(e.properties) ? e.properties.filter((p): p is string => typeof p === "string") : null,
    data_class: typeof e.data_class === "string" ? e.data_class : null,
  }
}
