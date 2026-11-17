/**
 * Offline. Preview sign-in against the staging store (lib/preview-auth.ts): production's configuration and behaviour
 * are untouched, and a preview can never use production's auth: not its Firebase project, not Google sign-in, not its
 * owners, and not a session cookie across the two. Also the staging seed (lib/staging/seed.ts): c434-staging only, and
 * made-up data only. Invented addresses and project ids throughout.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
  STAGING_PROJECT_ID,
  checkAuthProject,
  deployEnv,
  googleSignInAllowed,
  ownerEmailsVariable,
  tokenProjectAllowed,
} from "../preview-auth"
import { ownerEmails } from "../auth"
import { parseSessionCookieWithExpiry, sessionSigningContext, signPayload } from "../session-cookie"
import { approvalHash, type SendApproval } from "../send-approval"
import { recipientRefusal } from "../agent/send-email"
import { SEED_MARK, assertStagingProject, buildStagingSeed, writeStagingSeed, type SeedDb } from "../staging/seed"

const PROD_PROJECT = "made-up-production-project"

const KEYLESS_PROD = {
  GCP_PROJECT_NUMBER: "111",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel-434media",
  GCP_SERVICE_ACCOUNT_EMAIL: `app@${PROD_PROJECT}.iam.gserviceaccount.com`,
  FIREBASE_PROJECT_ID: PROD_PROJECT,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROD_PROJECT,
}

const PREVIEW_STAGING = {
  VERCEL_ENV: "preview",
  GCP_PROJECT_NUMBER: "222",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel-434media",
  GCP_SERVICE_ACCOUNT_EMAIL: `staging-app@${STAGING_PROJECT_ID}.iam.gserviceaccount.com`,
  FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
}

const token = (project: string) => ({ aud: project, iss: `https://securetoken.google.com/${project}` })

// ── Environment ──────────────────────────────────────────────────────────────────────────────────────────────────

test("an unset or unknown VERCEL_ENV counts as production (fails closed)", () => {
  assert.equal(deployEnv({}), "production")
  assert.equal(deployEnv({ VERCEL_ENV: "Preview" }), "production")
  assert.equal(deployEnv({ VERCEL_ENV: "staging" }), "production")
  assert.equal(deployEnv({ VERCEL_ENV: "preview" }), "preview")
})

// ── Production is untouched ──────────────────────────────────────────────────────────────────────────────────────

test("production signs in as before: its own project, on the key or keyless, accepting its own tokens", () => {
  for (const env of [{ VERCEL_ENV: "production", ...KEYLESS_PROD }, { VERCEL_ENV: "production", NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROD_PROJECT }, {}]) {
    const check = checkAuthProject(env)
    assert.deepEqual(check, { ok: true, env: "production", projectId: null })
    assert.equal(tokenProjectAllowed(token(PROD_PROJECT), check), true, "the Admin SDK's own audience check decides, as before")
  }
  assert.equal(googleSignInAllowed({ VERCEL_ENV: "production" }), true)
  assert.equal(googleSignInAllowed({}), true)
})

test("production never signs in against the staging project", () => {
  assert.equal(checkAuthProject({ VERCEL_ENV: "production", ...KEYLESS_PROD, FIREBASE_PROJECT_ID: STAGING_PROJECT_ID }).ok, false)
  assert.equal(checkAuthProject({ VERCEL_ENV: "production", ...KEYLESS_PROD, NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID }).ok, false)
})

test("production's owners are ADMIN_OWNER_EMAILS; the staging list is ignored there", () => {
  const env = { VERCEL_ENV: "production", ADMIN_OWNER_EMAILS: "owner@example.test", STAGING_ADMIN_OWNER_EMAILS: "tester@example.test" }
  assert.equal(ownerEmailsVariable(env), "ADMIN_OWNER_EMAILS")
  assert.deepEqual(ownerEmails(env), ["owner@example.test"])
  assert.deepEqual(ownerEmails({ ADMIN_OWNER_EMAILS: "owner@example.test", STAGING_ADMIN_OWNER_EMAILS: "tester@example.test" }), ["owner@example.test"])
})

test("production's session signature is unchanged: the plain HMAC of the payload", () => {
  const before = process.env.ADMIN_SESSION_SECRET
  process.env.ADMIN_SESSION_SECRET = "made-up-test-secret-at-least-32-characters-long"
  try {
    const payload = Buffer.from('{"user":{"email":"a@example.test","name":"A","role":"full_admin"}}').toString("base64url")
    const legacy = createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url")
    assert.equal(sessionSigningContext({ VERCEL_ENV: "production" }), "")
    assert.equal(sessionSigningContext({}), "")
    assert.equal(signPayload(payload, { VERCEL_ENV: "production" }), legacy)
    assert.equal(signPayload(payload, {}), legacy)
  } finally {
    if (before === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = before
  }
})

// ── A preview never uses production's auth ───────────────────────────────────────────────────────────────────────

test("a preview fully on staging may sign in, and only with staging tokens", () => {
  const check = checkAuthProject(PREVIEW_STAGING)
  assert.deepEqual(check, { ok: true, env: "preview", projectId: STAGING_PROJECT_ID })
  assert.equal(tokenProjectAllowed(token(STAGING_PROJECT_ID), check), true)
  assert.equal(tokenProjectAllowed(token(PROD_PROJECT), check), false, "a production Firebase token is refused")
  assert.equal(tokenProjectAllowed({ aud: STAGING_PROJECT_ID, iss: `https://securetoken.google.com/${PROD_PROJECT}` }, check), false)
  assert.equal(tokenProjectAllowed({}, check), false)
})

test("a preview not wholly on staging is refused, never let through to production", () => {
  const cases: Record<string, Record<string, string | undefined>> = {
    "on the key (production's credential), not keyless": { VERCEL_ENV: "preview", NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_KEY: "{}" },
    "server project is production": { ...PREVIEW_STAGING, FIREBASE_PROJECT_ID: PROD_PROJECT },
    "service account is production's": { ...PREVIEW_STAGING, GCP_SERVICE_ACCOUNT_EMAIL: `app@${PROD_PROJECT}.iam.gserviceaccount.com` },
    "service account only looks like staging's": { ...PREVIEW_STAGING, GCP_SERVICE_ACCOUNT_EMAIL: `x@${STAGING_PROJECT_ID}.iam.gserviceaccount.com.evil.test` },
    "browser config is production's": { ...PREVIEW_STAGING, NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROD_PROJECT },
    "browser config unset": { ...PREVIEW_STAGING, NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined },
  }
  for (const [name, env] of Object.entries(cases)) {
    const check = checkAuthProject(env)
    assert.equal(check.ok, false, name)
    assert.equal(tokenProjectAllowed(token(PROD_PROJECT), check), false, name)
    assert.equal(tokenProjectAllowed(token(STAGING_PROJECT_ID), check), false, name)
  }
})

test("Google sign-in, a production identity, is closed on a preview", () => {
  assert.equal(googleSignInAllowed({ VERCEL_ENV: "preview" }), false)
})

test("a preview's owners are the staging test accounts, never production's owners", () => {
  const env = { VERCEL_ENV: "preview", ADMIN_OWNER_EMAILS: "owner@example.test", STAGING_ADMIN_OWNER_EMAILS: "tester@example.test" }
  assert.equal(ownerEmailsVariable(env), "STAGING_ADMIN_OWNER_EMAILS")
  assert.deepEqual(ownerEmails(env), ["tester@example.test"])
  assert.deepEqual(ownerEmails({ VERCEL_ENV: "preview", ADMIN_OWNER_EMAILS: "owner@example.test" }), [], "unset staging list: no owners")
})

test("a session cookie never crosses between a preview and production, even with one shared secret", () => {
  const beforeSecret = process.env.ADMIN_SESSION_SECRET, beforeEnv = process.env.VERCEL_ENV
  process.env.ADMIN_SESSION_SECRET = "made-up-test-secret-at-least-32-characters-long"
  const mint = (env: Record<string, string>) => {
    const payload = Buffer.from(JSON.stringify({
      user: { email: "tester@example.test", name: "T", role: "crm_super_admin" },
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })).toString("base64url")
    return `${payload}.${signPayload(payload, env)}`
  }
  const parseIn = (vercelEnv: string | undefined, cookie: string) => {
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = vercelEnv
    return parseSessionCookieWithExpiry(cookie)
  }
  try {
    const previewCookie = mint({ VERCEL_ENV: "preview" })
    const productionCookie = mint({ VERCEL_ENV: "production" })
    assert.notEqual(parseIn("preview", previewCookie), null, "a preview reads its own cookie")
    assert.equal(parseIn("production", previewCookie), null, "production refuses a preview's cookie")
    assert.equal(parseIn(undefined, previewCookie), null, "an unset environment (production) refuses it too")
    assert.notEqual(parseIn("production", productionCookie), null, "production reads its own cookie")
    assert.equal(parseIn("preview", productionCookie), null, "a preview refuses production's cookie")
    assert.equal(parseIn("development", previewCookie), null)
  } finally {
    if (beforeSecret === undefined) delete process.env.ADMIN_SESSION_SECRET
    else process.env.ADMIN_SESSION_SECRET = beforeSecret
    if (beforeEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = beforeEnv
  }
})

// ── The staging seed ─────────────────────────────────────────────────────────────────────────────────────────────

function fakeDb() {
  const writes: string[] = []
  let commits = 0
  const db: SeedDb = {
    collection: (name) => ({ doc: (id) => `${name}/${id}` }),
    batch: () => ({ set: (ref) => writes.push(String(ref)), commit: async () => { commits++ } }),
  }
  return { db, writes, commits: () => commits }
}

test("the seed writes to c434-staging and refuses every other project before touching the database", async () => {
  const docs = buildStagingSeed({ origin: "https://preview.example.test" })
  for (const project of [PROD_PROJECT, "", undefined, null, "C434-STAGING", `${STAGING_PROJECT_ID}-x`]) {
    const f = fakeDb()
    await assert.rejects(writeStagingSeed(f.db, project, docs), /Staging seed refused/, String(project))
    assert.equal(f.writes.length, 0)
    assert.equal(f.commits(), 0)
    assert.throws(() => assertStagingProject(project))
  }
  const f = fakeDb()
  const counts = await writeStagingSeed(f.db, STAGING_PROJECT_ID, docs)
  assert.equal(f.writes.length, docs.length)
  assert.equal(f.commits(), 1)
  assert.deepEqual(Object.keys(counts).sort(), ["agent_ledger", "agent_tasks", "contact_forms", "crm_content_posts", "crm_people", "crm_person_emails", "crm_send_approvals", "crm_team_members", "leads"])
})

test("the seed is made-up data only, marked, warm-sourced, and includes a video post", () => {
  const docs = buildStagingSeed({ origin: "https://preview.example.test/", now: new Date("2026-11-16T12:00:00Z") })
  const text = JSON.stringify(docs)
  const addresses = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
  assert.ok(addresses.length > 0)
  for (const a of addresses) assert.match(a, /@example\.com$/, `only reserved example.com addresses: ${a}`)
  for (const d of docs) {
    assert.equal(d.data.seed, SEED_MARK, `${d.collection}/${d.id} is marked`)
    if (d.collection !== "crm_person_emails") assert.match(d.id, /^seed-/)
  }
  for (const lead of docs.filter((d) => d.collection === "leads")) {
    assert.ok(["manual", "web", "event"].includes(lead.data.source as string), "no cold source")
  }
  const video = docs.find((d) => d.collection === "crm_content_posts" && (d.data.assets as { kind: string }[]).some((a) => a.kind === "video"))
  assert.ok(video, "a video post")
  assert.equal((video!.data.assets as { url: string }[])[0].url, "https://preview.example.test/hero/hero-720p.mp4")
  // One reply draft waiting, intact (its hash is the hash of what is stored) and addressed outside the send allow-list.
  const draft = docs.find((d) => d.collection === "crm_send_approvals")!
  assert.equal(draft.data.hash, approvalHash(draft.data as unknown as SendApproval))
  assert.equal(recipientRefusal((draft.data as unknown as SendApproval).payload.to), "a recipient is outside the allow-list")
  assert.equal(docs.find((d) => d.collection === "agent_tasks")!.data.state, "awaiting_review")
  const roles = docs.filter((d) => d.collection === "crm_team_members").map((d) => d.data.role)
  assert.ok(!roles.includes("crm_super_admin") && !roles.includes("full_admin"), "seeded roster members hold narrow roles only")
})
