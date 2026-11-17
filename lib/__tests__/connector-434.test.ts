/**
 * Offline. The 434 connector, slice 1 (build sequence V1 item 4, "the connector, widened"; founder approval
 * 2026-11-17): sign-in through the publisher's Auth0 check with the connector's own scope and settings, per-person
 * skill permissions from the roster, the per-caller tool list and the read-only 434 context. No network, no Firestore.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { generateKeyPairSync, sign as rsaSign } from "node:crypto"
import { loadConnectorConfig, verifyConnectorToken, type OAuthDeps } from "../owned-meta-oauth"
import { permittedSkills, skillPermission } from "../connector-434/permissions"
import { CONNECTOR_434_ENV_PREFIX, CONNECTOR_434_SCOPE, CONTEXT_TOOL, callerOf, toolsFor } from "../connector-434/tools"
import { brandVoiceOf, build434Context, contextProblems } from "../connector-434/context"
import { BRAND_RECORDS } from "../brand-records"

const ISSUER = "https://434media.us.auth0.com/", AUDIENCE = "https://www.434media.com/api/434/mcp", CLIENT = "assistantClient01", SUB = "google-oauth2|1234567890"
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" }
function jwt(claims: Record<string, unknown>) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const data = `${enc({ alg: "RS256", kid: "k1", typ: "JWT" })}.${enc(claims)}`
  return `${data}.${rsaSign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`
}
const NOW_S = 2_000_000_000
const good = { iss: ISSUER, aud: AUDIENCE, azp: CLIENT, sub: SUB, iat: NOW_S - 10, exp: NOW_S + 3600, scope: `openid ${CONNECTOR_434_SCOPE}` }
function deps(over: Partial<OAuthDeps> = {}) {
  const refused: string[] = []
  const d: OAuthDeps = {
    config: { issuer: ISSUER, audience: AUDIENCE, clientId: CLIENT, jwksUrl: `${ISSUER}.well-known/jwks.json`, callers: [{ subject: SUB, email: "staff@434media.com" }] },
    jwks: async () => [JWK], scopes: [CONNECTOR_434_SCOPE],
    authorize: async () => ({ authorized: true, role: "crm_only" }),
    sendCapable: async () => true,
    nowSeconds: () => NOW_S, onRefuse: (r) => { refused.push(r) }, ...over,
  }
  return { d, refused }
}

test("sign-in: any active roster role connects with the 434 scope; the roster gate and expiry still refuse", async () => {
  const ok = deps()
  const info = await verifyConnectorToken(jwt(good), ok.d)
  assert.deepEqual(info?.scopes, [CONNECTOR_434_SCOPE])
  assert.deepEqual(callerOf(info as never), { email: "staff@434media.com", role: "crm_only", skills: [] })

  const off = deps({ authorize: async () => ({ authorized: false, reason: "deactivated" }) })
  assert.equal(await verifyConnectorToken(jwt(good), off.d), undefined); assert.deepEqual(off.refused, ["admin_gate"])
  const late = deps()
  assert.equal(await verifyConnectorToken(jwt({ ...good, exp: NOW_S }), late.d), undefined); assert.deepEqual(late.refused, ["exp"])

  // A publisher token does not open this connector, and a 434 token does not open the publisher.
  const pub = deps()
  assert.equal(await verifyConnectorToken(jwt({ ...good, scope: "owned-meta:write" }), pub.d), undefined); assert.deepEqual(pub.refused, ["scope"])
  const asPublisher = deps({ scopes: undefined })
  assert.equal(await verifyConnectorToken(jwt(good), asPublisher.d), undefined); assert.deepEqual(asPublisher.refused, ["scope"])
})

test("settings: the connector reads its own CONNECTOR_434_* names and fails closed by name", () => {
  const env = {
    CONNECTOR_434_ISSUER: ISSUER, CONNECTOR_434_AUDIENCE: AUDIENCE, CONNECTOR_434_CLIENT_ID: CLIENT,
    CONNECTOR_434_JWKS_URL: `${ISSUER}.well-known/jwks.json`, CONNECTOR_434_CALLERS: JSON.stringify([{ subject: SUB, email: "Staff@434media.com" }]),
  }
  assert.deepEqual(loadConnectorConfig(env, CONNECTOR_434_ENV_PREFIX).config?.callers, [{ subject: SUB, email: "staff@434media.com" }])
  assert.deepEqual(loadConnectorConfig({}, CONNECTOR_434_ENV_PREFIX).problems,
    ["CONNECTOR_434_ISSUER", "CONNECTOR_434_AUDIENCE", "CONNECTOR_434_CLIENT_ID", "CONNECTOR_434_JWKS_URL", "CONNECTOR_434_CALLERS"])
  // The publisher's own settings do not switch this connector on.
  const publisherOnly = Object.fromEntries(Object.entries(env).map(([k, v]) => [k.replace("CONNECTOR_434", "OWNED_META_CONNECTOR"), v]))
  assert.equal(loadConnectorConfig(publisherOnly, CONNECTOR_434_ENV_PREFIX).config, null)
  assert.ok(loadConnectorConfig(publisherOnly).config)
})

test("permissions: skill:<name> entries in the existing roster array, least privilege", () => {
  const catalog = ["434-intake-qualification", "brand-book-share", "add-work-record"]
  assert.equal(skillPermission("brand-book-share"), "skill:brand-book-share")
  assert.throws(() => skillPermission("Brand Book"))
  assert.deepEqual(permittedSkills({ isActive: true, role: "crm_only", permissions: ["content", "skill:brand-book-share", "skill:not-in-catalog", "skill:*", 7] }, catalog), ["brand-book-share"])
  assert.deepEqual(permittedSkills({ isActive: true, role: "crm_only", permissions: ["content"] }, catalog), [])
  assert.deepEqual(permittedSkills({ isActive: false, role: "crm_only", permissions: ["skill:brand-book-share"] }, catalog), [])
  assert.deepEqual(permittedSkills({ isActive: false, role: "crm_super_admin" }, catalog), [])
  assert.deepEqual(permittedSkills({ isActive: true, role: "crm_super_admin" }, catalog), [...catalog].sort())
  assert.deepEqual(permittedSkills(null, catalog), [])
  assert.deepEqual(permittedSkills(null, catalog, true), [...catalog].sort())
})

test("tool list: built per caller; nobody unverified sees anything; slice 1 offers only the context tool", () => {
  assert.deepEqual(toolsFor(null), [])
  assert.deepEqual(toolsFor({ email: "a@434media.com", role: "intern", skills: [] }).map((t) => t.name), [CONTEXT_TOOL.name])
  assert.equal(callerOf({ scopes: ["owned-meta:read"], extra: { email: "a@434media.com", role: "crm_only" } }), null)
  assert.equal(callerOf({ scopes: [CONNECTOR_434_SCOPE], extra: { role: "crm_only" } }), null)
  assert.equal(CONTEXT_TOOL.readOnly, true)
})

test("434 context: generated canon only, offers by name, no figures and no internal fields", () => {
  const ctx = build434Context(null)
  assert.deepEqual(contextProblems(ctx), [])
  assert.equal(ctx.company.canonicalDefinition, BRAND_RECORDS.canonicalDefinition)
  assert.equal(ctx.company.mottoPlain, BRAND_RECORDS.mottoPlain)
  assert.deepEqual(ctx.offers.map((o) => o.name).sort(), ["Original IP", "Platforms for Brands", "Productions for Brands"])
  for (const name of ["Salute to Troops", "TXMX Boxing", "MilCityUSA", "VemosVamos"]) assert.ok(ctx.properties.some((p) => p.name === name), name)
  assert.deepEqual(Object.keys(ctx.properties[0]).sort(), ["description", "name", "url"])
  const json = JSON.stringify(ctx)
  for (const word of ["client", "founderCredit", "rightsDefaults", "recordKey"]) assert.ok(!json.includes(`"${word}"`), word)

  for (const figure of ["$5,000", "€ 900", "20%", "3k", "1,500 USD", "billed per hour"]) assert.notDeepEqual(contextProblems({ s: figure }), [], figure)
  for (const fine of ["2022–present", "Version 1.0.1", "Section 4.3", "434 MEDIA"]) assert.deepEqual(contextProblems({ s: fine }), [], fine)
  assert.deepEqual(contextProblems({ internal_context: "x" }), ["$.internal_context: internal field"])
  assert.deepEqual(contextProblems({ rateCard: [] }), ["$.rateCard: internal field"])
})

test("brand voice: only a well-formed voice row that passes the content check is served", () => {
  const row = { key: "voice-01-434-media-brand-voice", kind: "voice", title: "01-434-MEDIA-BRAND-VOICE", version: "1.0.1", body: "Plain, specific, accountable." }
  assert.deepEqual(brandVoiceOf(row), { title: row.title, version: "1.0.1", body: row.body })
  assert.equal(brandVoiceOf({ ...row, kind: "policy" }), null)
  assert.equal(brandVoiceOf({ ...row, body: "Our day rate is $2,500." }), null)
  assert.equal(brandVoiceOf(null), null)
  // The real file, where the private context clone is present locally (never in CI).
  const real = "docs/context/01 Voice System/01-434-MEDIA-BRAND-VOICE.md"
  if (existsSync(real)) assert.ok(brandVoiceOf({ ...row, body: readFileSync(real, "utf8") }), "the live brand voice file passes")
})
