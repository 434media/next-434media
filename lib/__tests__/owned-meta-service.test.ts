/** Offline. Pilot service identity + acting-person checks for the MCU publisher service. No network, no Firestore. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync, sign as rsaSign } from "node:crypto"
import { handleServiceRequest, loadServiceConfig, verifyServiceToken, SERVICE_TOOL_SCOPE, type ServiceDeps, type ServiceConfig } from "../owned-meta-service"
import { runOwnedMetaTool, toolInput, type ToolDeps, type ToolName } from "../owned-meta-tool-handler"
import { draftBatch, runOwnedMeta, type MetaManifest, type MetaProvider, type MetaRecord, type MetaStore } from "../owned-meta-publisher"
import { assetDigest } from "../owned-meta-assets"
import type { IntakeDeps } from "../owned-meta-intake"

const NOW = 2_000_000_000, MARCOS = "U08LKLE5H3M", GUNA = "U0C9MUN3PGA"
const CONFIG: ServiceConfig = {
  issuer: "https://oidc.vercel.com/434media", audience: "https://vercel.com/434media",
  subject: "owner:434media:project:cos-crm-pilot:environment:production", teamId: "team_TESTteam000000000000000", projectId: "prj_TESTpilot0000000000000000",
  people: [{ email: "marcos@434media.com", scopes: ["content:read", "content:prepare", "content:approve", "content:publish"] }, { email: "staff@434media.com", scopes: ["content:read", "content:prepare"] }],
}
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 }), other = generateKeyPairSync("rsa", { modulusLength: 2048 })
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "v1", alg: "RS256" }
const claims = { iss: CONFIG.issuer, aud: CONFIG.audience, sub: CONFIG.subject, owner_id: CONFIG.teamId, project_id: CONFIG.projectId, environment: "production", iat: NOW - 5, exp: NOW + 600 }
function jwt(c: Record<string, unknown> = claims, header: Record<string, unknown> = { alg: "RS256", kid: "v1", typ: "JWT" }, key = privateKey) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url"), data = `${enc(header)}.${enc(c)}`
  return `${data}.${rsaSign("RSA-SHA256", Buffer.from(data), key).toString("base64url")}`
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
function manifest(): MetaManifest {
  const a = { name: "a", url: "https://approved.public.blob.vercel-storage.com/content-posts/12345678-1234-1234-1234-123456789abc.jpg", sha256: assetDigest(jpeg), size: jpeg.length, mime: "image/jpeg" as const, width: 1080, height: 1350, provenance: { source: "canva", templateRevision: "v1", generator: "none", metadata: "unverified" as const } }
  return { schema: 1, revision: 1, brand: "milcity", format: "carousel", assets: [a, { ...a, name: "b" }], captions: { instagram: "IG", facebook: "FB" }, destinations: { appId: "1", pageId: "2", instagramId: "3", apiVersion: "v26.0" }, placements: { instagram: "feed", facebook: "feed" }, instagramShareToFeed: false, aiGenerated: false, publicHostingApproved: true }
}
class Store implements MetaStore {
  constructor(public value: MetaRecord) {}
  async read() { return structuredClone(this.value) }
  async update<T>(_id: string, fn: (r: MetaRecord) => { next?: MetaRecord; result: T }) { const { next, result } = fn(structuredClone(this.value)); if (next) this.value = next; return result }
  async event() {}
}
function toolDeps(store: Store, calls: string[], decided: string[]): ToolDeps {
  const provider: MetaProvider = { preflight: () => null, prepare: async (_m, d, _u, p) => ({ ready: true, preparation: { ...p, container: d } }), publish: async (_m, d) => { calls.push(`publish:${d}`); return d === "instagram" ? "101" : "2_202" }, verify: async (_m, d) => ({ verified: true, permalink: `https://www.${d}.com/p/x` }) }
  return {
    env: { OWNED_META_APPROVER_SLACK_IDS: `${MARCOS}:marcos@434media.com` }, store, intake: {} as IntakeDeps, brandEnabled: async () => true,
    prepare: async () => store.value.batch,
    decide: async (_id, _rev, hash, email) => { decided.push(email); store.value.batch.approval = { by: email, at: "t", hash }; return store.value.batch },
    execute: a => runOwnedMeta({ id: a.id, runId: a.runId, store: a.store, provider, enabled: async () => true, resolveAssets: async b => b.manifest.assets.map(x => x.url) }),
    recordFailure: async a => ({ message: a.error instanceof Error ? a.error.message : "failed", status: 409 }),
    exclude: async () => {}, health: async () => ({}), readSlackMessage: async () => undefined, canvaExport: async () => [],
    randomId: () => "run-1", now: () => "2026-10-16T12:00:00Z",
  }
}
function deps(over: Partial<ServiceDeps> = {}, record?: MetaRecord) {
  const draft = draftBatch("batch-1", manifest())
  const store = new Store(record ?? { archived: false, revision: 1, batch: draft })
  const calls: string[] = [], decided: string[] = [], ran: { name: ToolName; email: string }[] = [], refused: string[] = []
  const d: ServiceDeps = {
    config: CONFIG, jwks: async () => [JWK], nowSeconds: () => NOW,
    authorize: async email => email.endsWith("@434media.com") && email !== "gone@434media.com" ? { authorized: true, role: email === "marcos@434media.com" ? "crm_super_admin" : email === "staff@434media.com" ? "crm_only" : "full_admin" } : { authorized: false, reason: "not_on_roster" },
    sendCapable: async (_e, role) => role === "crm_super_admin" || role === "full_admin",
    approvers: `${MARCOS}:marcos@434media.com`,
    toolDeps: async () => toolDeps(store, calls, decided),
    run: async (name, input, principal, td) => { ran.push({ name, email: principal.email }); return runOwnedMetaTool(name, input, principal, td) },
    onRefuse: r => { refused.push(r) }, ...over,
  }
  return { d, store, calls, decided, ran, refused }
}
const req = (tool: ToolName, args: unknown, email = "marcos@434media.com", slackUserId = MARCOS, extra: Record<string, unknown> = {}) => ({ tool, args, actor: { email, slackUserId }, ...extra })

test("only the pilot's production identity is accepted as the calling service", async () => {
  const ok = deps()
  assert.equal(await verifyServiceToken(jwt(), ok.d), null)
  const cases: [string, string, string][] = [
    ["another issuer", jwt({ ...claims, iss: "https://oidc.vercel.com/other" }), "issuer"],
    ["another audience", jwt({ ...claims, aud: "https://vercel.com/other" }), "audience"],
    ["another project's subject", jwt({ ...claims, sub: "owner:434media:project:next-434media:environment:production" }), "subject"],
    ["another team", jwt({ ...claims, owner_id: "team_other" }), "team"],
    ["another project id", jwt({ ...claims, project_id: "prj_TESTother0000000000000000" }), "project"],
    ["a preview deployment", jwt({ ...claims, environment: "preview" }), "environment"],
    ["expired (zero tolerance)", jwt({ ...claims, exp: NOW }), "expired"],
    ["alg none", jwt(claims, { alg: "none", kid: "v1" }), "alg"],
    ["unknown key", jwt(claims, { alg: "RS256", kid: "zz" }), "kid"],
    ["forged signature", jwt(claims, undefined, other.privateKey), "signature"],
  ]
  for (const [why, token, reason] of cases) assert.equal(await verifyServiceToken(token, ok.d), reason, why)
  assert.equal(await verifyServiceToken(undefined, ok.d), "no_bearer_jwt")
  const x = deps(), r = await handleServiceRequest(jwt({ ...claims, environment: "preview" }), req("status", { postId: "p" }), x.d)
  assert.equal(r.status, 401); assert.deepEqual(x.ran, [])
})

test("the acting person is checked here, independently of the pilot", async () => {
  const run = async (email: string, tool: ToolName, args: unknown = { postId: "p" }) => { const x = deps(); const r = await handleServiceRequest(jwt(), req(tool, args, email), x.d); return { status: r.status, ran: x.ran.length, refused: x.refused } }
  assert.deepEqual(await run("nobody@434media.com", "status"), { status: 403, ran: 0, refused: ["person:content:read"] }) // not on this site's list
  assert.deepEqual(await run("staff@434media.com", "execute", { postId: "p", batchId: "b", hash: "h" }), { status: 403, ran: 0, refused: ["person:content:publish"] })
  assert.deepEqual(await run("staff@434media.com", "prepare"), { status: 403, ran: 0, refused: ["person:send_role"] }) // listed, but a draft-only role
  assert.equal((await run("staff@434media.com", "status")).ran, 1) // reading is allowed for that role
  const gone = deps({ config: { ...CONFIG, people: [...CONFIG.people, { email: "gone@434media.com", scopes: ["content:read"] }] } })
  const r = await handleServiceRequest(jwt(), req("status", { postId: "p" }, "gone@434media.com"), gone.d)
  assert.equal(r.status, 403); assert.deepEqual(gone.refused, ["person:admin_gate"])
  for (const tool of Object.keys(toolInput)) assert.ok(tool in SERVICE_TOOL_SCOPE)
})

test("approval: only the acting approver's own Slack message, quoting the hash, approves; nothing else does", async () => {
  const x = deps(), hash = x.store.value.batch.hash, args = { postId: "p", revision: 1, hash }
  const msg = (over: Record<string, unknown> = {}) => ({ approval: { channel: "C0WORK", ts: "1792150000.000100", text: `approve ${hash.slice(0, 12)}`, slackUserId: MARCOS, ...over } })
  assert.equal((await handleServiceRequest(jwt(), req("approve", args, "marcos@434media.com", MARCOS, msg({ slackUserId: GUNA })), x.d)).status, 403) // someone else's message
  assert.equal((await handleServiceRequest(jwt(), req("approve", args), x.d)).status, 403) // no message at all
  const wrongHash = await handleServiceRequest(jwt(), req("approve", args, "marcos@434media.com", MARCOS, msg({ text: "approve it" })), x.d)
  assert.equal(wrongHash.status, 409); assert.deepEqual(x.decided, [])
  const ok = await handleServiceRequest(jwt(), req("approve", args, "marcos@434media.com", MARCOS, msg()), x.d)
  assert.equal(ok.status, 200); assert.deepEqual(x.decided, ["marcos@434media.com"])
})

test("publishing through the service keeps the Army exclusion and never repeats a final publish", async () => {
  const draft = draftBatch("batch-1", manifest()); draft.approval = { by: "marcos@434media.com", at: "t", hash: draft.hash }
  const army = deps({}, { archived: false, revision: 1, batch: draft, excluded: true })
  const r = await handleServiceRequest(jwt(), req("execute", { postId: "Opb3LOHpfZPFoxdQ720F", batchId: draft.id, hash: draft.hash }), army.d)
  assert.equal(r.status, 409); assert.deepEqual(army.calls, [])
  const ok = deps({}, { archived: false, revision: 1, batch: structuredClone(draft) })
  const first = await handleServiceRequest(jwt(), req("execute", { postId: "p", batchId: draft.id, hash: draft.hash }), ok.d)
  assert.equal(first.status, 200); assert.deepEqual(ok.calls, ["publish:instagram", "publish:facebook"])
  await handleServiceRequest(jwt(), req("execute", { postId: "p", batchId: draft.id, hash: draft.hash }), ok.d)
  assert.equal(ok.calls.length, 2)
})

test("service configuration fails closed by name", () => {
  const env = { OWNED_META_SERVICE_ISSUER: CONFIG.issuer, OWNED_META_SERVICE_AUDIENCE: CONFIG.audience, OWNED_META_SERVICE_SUBJECT: CONFIG.subject, OWNED_META_SERVICE_TEAM_ID: CONFIG.teamId, OWNED_META_SERVICE_PROJECT_ID: CONFIG.projectId, OWNED_META_SERVICE_PEOPLE: JSON.stringify(CONFIG.people) }
  assert.ok(loadServiceConfig(env).config)
  assert.deepEqual(loadServiceConfig({ ...env, OWNED_META_SERVICE_SUBJECT: "owner:434media:project:cos-crm-pilot:environment:preview" }).problems, ["OWNED_META_SERVICE_SUBJECT"])
  assert.deepEqual(loadServiceConfig({ ...env, OWNED_META_SERVICE_PEOPLE: JSON.stringify([{ email: "x@gmail.com", scopes: ["content:read"] }]) }).problems, ["OWNED_META_SERVICE_PEOPLE"])
  assert.equal(loadServiceConfig({}).problems.length, 6)
})
