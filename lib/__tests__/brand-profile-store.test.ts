/**
 * Brand profiles in the database (lib/content-pipeline/profile-store.ts, lib/firestore-brand-profiles.ts): Publish
 * validates the draft and refuses a broken one, every version is kept with who and when, Restore republishes an earlier
 * version in one action, the engine reads the profile in scope, and posts are stamped with its version.
 * The Firestore part runs against the emulator (FIRESTORE_EMULATOR_HOST) and is skipped without it.
 * Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 tsx --test lib/__tests__/brand-profile-store.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { MAX_PROFILE_BYTES, preparePublish, publishProblems, profileSha256, type BrandProfileDoc } from "../content-pipeline/profile-store"
import { BRAND, activeProfile, setProcessProfile, withProfile } from "../content-pipeline/brand"
import { SERIES } from "../content-pipeline/series"
import { KIND_CODE } from "../content-pipeline/worker"
import { profileStamp } from "../content-pipeline/run"
import { backupPath, backupRecord, parseAfter, readTokenCheck, serveBackups, BACKUP_READ_TOKEN_ENV, type BackupSource } from "../content-pipeline/profile-backup"
import type { ProfileVersion } from "../content-pipeline/profile-store"
import type { BrandProfile } from "../content-pipeline/profile"
import { published, loadPublishedProfileFirst } from "./published-profile"

loadPublishedProfileFirst()
const AT = "2026-10-19T18:00:00.000Z", BY = "founder@example.com"
const docWith = (profile: unknown, over: Partial<BrandProfileDoc> = {}): BrandProfileDoc => ({
  id: "milcity", brand_type: "owned", client_id: null, identity: { source: "master Section 4", record: "MilCityUSA" }, sources: { seeds: "content_pipeline_config/mcu_seeds" },
  draft: { profile, examples: { approved: [], rejected: [] }, updated_by: BY, updated_at: AT }, published: null, last_version: 0, drafts_before_restore: [], ...over,
})
const clone = () => structuredClone(published.milcity) as unknown as Record<string, unknown>

test("Publish: a valid draft becomes version 1, with who, when, its hash and the platform → format → template map", () => {
  const r = preparePublish(docWith(published.milcity), BY, AT)
  assert.ok(r.ok)
  const v = r.version
  assert.equal(v.version_id, "milcity@v1"); assert.equal(v.n, 1); assert.equal(v.published_by, BY); assert.equal(v.published_at, AT)
  assert.equal(v.profile_sha256, profileSha256(published.milcity)); assert.equal(v.restored_from, null); assert.ok(!("backup" in v), "no backup status is written on the site")
  assert.equal(v.template_map.instagram.feed.news, published.milcity.series.news!.templates.feed)
  assert.equal(v.template_map.facebook.reels.breaking, published.milcity.series.breaking!.templates.reels)
  assert.ok(!("dt101" in v.template_map.instagram.reels), "a series with no Reels template has no Reels entry")
  assert.equal(r.doc.published, v); assert.equal(r.doc.last_version, 1)
})

test("Publish refuses a broken profile and changes nothing", () => {
  const broken = clone(); delete broken.editorial
  const doc = docWith(broken, { published: null })
  const r = preparePublish(doc, BY, AT)
  assert.ok(!r.ok); assert.ok(r.problems.some(p => /editorial is required/.test(p)), r.problems.join("; "))
  assert.equal(doc.published, null); assert.equal(doc.last_version, 0)
  // So are a profile filed under another brand, a client brand with no client id, bad examples, no draft and no actor.
  assert.ok(publishProblems(docWith(published.milcity, { id: "txmx" })).includes("the profile's id is not txmx"))
  assert.ok(publishProblems(docWith(published.milcity, { brand_type: "client" })).includes("client_id is required for a client brand"))
  assert.ok(publishProblems({ ...docWith(published.milcity), draft: { profile: published.milcity, examples: { approved: [{ text: "" }], rejected: [] }, updated_by: BY, updated_at: AT } }).some(p => p.startsWith("examples.approved[0]")))
  assert.deepEqual(publishProblems(docWith(null, { draft: null })), ["there is no draft to publish"])
  assert.ok(!preparePublish(docWith(published.milcity), " ", AT).ok)
})

test("Restore republishes an earlier version as a new one, and it becomes the draft", () => {
  const v1 = preparePublish(docWith(published.milcity), BY, AT)
  assert.ok(v1.ok)
  const edited = clone(); edited.rulesVersion = "mcu-rules-test.3"
  const v2 = preparePublish({ ...v1.doc, draft: { profile: edited, examples: { approved: [], rejected: [] }, updated_by: BY, updated_at: AT } }, BY, AT)
  assert.ok(v2.ok); assert.equal(v2.version.version_id, "milcity@v2")
  const v3 = preparePublish(v2.doc, BY, AT, { draft: { profile: v1.version.profile, examples: v1.version.examples }, restoredFrom: "milcity@v1" })
  assert.ok(v3.ok)
  assert.equal(v3.version.version_id, "milcity@v3"); assert.equal(v3.version.restored_from, "milcity@v1")
  assert.equal(v3.version.profile_sha256, v1.version.profile_sha256); assert.equal(v3.doc.draft!.profile, v1.version.profile)
  assert.deepEqual(v3.doc.drafts_before_restore, [], "nothing unpublished was replaced")
  // Restoring the version that is live adds no duplicate.
  const same = preparePublish(v3.doc, BY, AT, { draft: { profile: v1.version.profile, examples: v1.version.examples }, restoredFrom: "milcity@v1" })
  assert.ok(!same.ok); assert.deepEqual(same.problems, ["nothing to restore: milcity@v1 is what is live (milcity@v3)"])
})

test("Restore never loses unpublished draft edits: refused unless forced, then kept; an unchanged draft is not republished", () => {
  const v1 = preparePublish(docWith(published.milcity), BY, AT)
  assert.ok(v1.ok)
  // Publishing the draft that is already live adds no duplicate version.
  const again = preparePublish(v1.doc, BY, AT)
  assert.ok(!again.ok); assert.deepEqual(again.problems, ["nothing to publish: the draft is the published version milcity@v1"])
  const editing = { ...v1.doc, draft: { profile: { ...structuredClone(published.milcity), rulesVersion: "unpublished-edit" }, examples: { approved: [], rejected: [] }, updated_by: BY, updated_at: AT } }
  // An earlier version, not the live one (restoring the live one is refused on its own).
  const earlier = { profile: { ...structuredClone(published.milcity), rulesVersion: "earlier" }, examples: { approved: [], rejected: [] } }
  const refused = preparePublish(editing, BY, AT, { draft: earlier, restoredFrom: "milcity@v0" })
  assert.ok(!refused.ok); assert.match(refused.problems.join(), /the draft has unpublished edits/)
  const forced = preparePublish(editing, BY, AT, { draft: earlier, restoredFrom: "milcity@v0", force: true })
  assert.ok(forced.ok)
  assert.deepEqual(forced.doc.drafts_before_restore, [editing.draft], "the replaced draft is kept")
  assert.equal(forced.doc.draft!.profile, earlier.profile)
  // Only the last two are kept, newest first.
  const d = (tag: string) => ({ profile: { ...structuredClone(published.milcity), rulesVersion: tag }, examples: { approved: [], rejected: [] }, updated_by: BY, updated_at: AT })
  const third = preparePublish({ ...editing, draft: d("newest"), drafts_before_restore: [d("older"), d("oldest")] }, BY, AT, { draft: { profile: d("an earlier version").profile, examples: { approved: [], rejected: [] } }, restoredFrom: "milcity@v2", force: true })
  assert.ok(third.ok); assert.deepEqual(third.doc.drafts_before_restore.map(x => (x.profile as { rulesVersion: string }).rulesVersion), ["newest", "older"])
})

test("the brand document's own fields and size are checked on Publish", () => {
  assert.ok(publishProblems(docWith(published.milcity, { brand_type: "partner" as never })).includes("brand_type: owned or client"))
  const huge = { ...structuredClone(published.milcity), editorial: "x".repeat(MAX_PROFILE_BYTES) }
  assert.match(publishProblems(docWith(huge)).join(), /a profile and its examples must stay under 200000/)
})

test("the engine reads the profile in scope: concurrent scopes don't mix, and no scope means no run", async () => {
  const other = { ...structuredClone(published.milcity), name: "Other Brand", draftPrefix: "OTH" } as BrandProfile
  const seen = await Promise.all([
    withProfile({ profile: published.milcity, versionId: "milcity@v1" }, async () => { await new Promise(r => setTimeout(r, 5)); return [BRAND.name, activeProfile().versionId, profileStamp().profile_version_id] }),
    withProfile({ profile: other, versionId: "other@v4" }, async () => [BRAND.name, activeProfile().versionId, profileStamp().profile_version_id]),
  ])
  assert.deepEqual(seen, [[published.milcity.name, "milcity@v1", "milcity@v1"], ["Other Brand", "other@v4", "other@v4"]])
  assert.equal(withProfile({ profile: published.milcity, versionId: "milcity@v9" }, () => KIND_CODE.dt101), published.milcity.requestKinds.find(k => k.kind === "dt101")!.code)
  assert.deepEqual(Object.keys(SERIES), Object.keys(published.milcity.series))
  const saved = published.active
  setProcessProfile(null)
  try { assert.throws(() => BRAND.name, /No published brand profile is in scope/) } finally { setProcessProfile(saved) }
})

const TOKEN = "t".repeat(40)
const ENV = { [BACKUP_READ_TOKEN_ENV]: TOKEN }

test("backup: the record is the version as published, without the legacy backup status", () => {
  const r = preparePublish(docWith(published.milcity), BY, AT)
  assert.ok(r.ok)
  assert.equal(backupPath(r.version), "06 Standards/Brand Profiles/Published/milcity/v1.json")
  const record = JSON.parse(backupRecord(r.version))
  assert.equal(record.version_id, "milcity@v1"); assert.deepEqual(record.profile, published.milcity)
  // A version stored before Step 2b carries backup: {status}; the record is the same bytes without it.
  const legacy = { ...r.version, backup: { status: "done", commit: "abc" } } as ProfileVersion
  assert.equal(backupRecord(legacy), backupRecord(r.version)); assert.ok(!("backup" in record))
  assert.ok(backupRecord(r.version).endsWith("}\n"))
})

test("backup endpoint: the read credential is compared in constant time and refused when unset or short", () => {
  assert.equal(readTokenCheck(`Bearer ${TOKEN}`, ENV), "ok")
  assert.equal(readTokenCheck(`Bearer ${TOKEN}x`, ENV), "denied")
  assert.equal(readTokenCheck(`Bearer ${TOKEN.slice(1)}`, ENV), "denied")
  assert.equal(readTokenCheck(TOKEN, ENV), "denied", "the Bearer scheme is required")
  assert.equal(readTokenCheck(null, ENV), "denied")
  assert.equal(readTokenCheck(`Bearer ${TOKEN}`, {}), "unset")
  assert.equal(readTokenCheck("Bearer short", { [BACKUP_READ_TOKEN_ENV]: "short" }), "unset", "a weak credential is not accepted")
  assert.equal(readTokenCheck("Bearer ", { [BACKUP_READ_TOKEN_ENV]: "" }), "unset")
})

test("backup endpoint: after= parses brand:n pairs and refuses anything else", () => {
  assert.deepEqual(parseAfter(null), {}); assert.deepEqual(parseAfter(""), {})
  assert.deepEqual(parseAfter("milcity:4,txmx-boxing:0"), { milcity: 4, "txmx-boxing": 0 })
  for (const bad of ["milcity", "milcity:-1", "milcity:4,milcity:5", "Milcity:4", "../x:1", "milcity:4;drop", "milcity:1234567"]) assert.equal(parseAfter(bad), null, bad)
})

test("backup endpoint: lists only versions newer than 434-context holds, reads only, no CORS", async () => {
  const versions: Record<string, ProfileVersion[]> = {}
  let doc = docWith(published.milcity)
  for (let k = 0; k < 3; k++) {
    const draft = { ...structuredClone(published.milcity), rulesVersion: `r${k}` }
    const r = preparePublish({ ...doc, draft: { profile: draft, examples: { approved: [], rejected: [] }, updated_by: BY, updated_at: AT } }, BY, AT)
    assert.ok(r.ok); doc = r.doc; (versions.milcity ??= []).push(r.version)
  }
  const calls: string[] = []
  const source: BackupSource = {
    list: async () => [{ id: "milcity" }, { id: "Not A Brand" }],
    versionsAfter: async (id, n, limit) => { calls.push(`${id}>${n}`); return (versions[id] ?? []).filter(v => v.n > n).slice(0, limit) },
  }
  const get = (q: string, auth: string | null = `Bearer ${TOKEN}`, env: Record<string, string> = ENV) =>
    serveBackups(new Request(`https://example.test/api/brand-profiles/backups${q}`, { headers: auth ? { authorization: auth } : {} }), async () => source, env)

  const newer = await get("?after=milcity:1")
  assert.equal(newer.status, 200); assert.equal(newer.headers.get("cache-control"), "no-store"); assert.equal(newer.headers.get("access-control-allow-origin"), null)
  const body = await newer.json() as { versions: { version_id: string; path: string; record: string }[] }
  assert.deepEqual(body.versions.map(v => v.version_id), ["milcity@v2", "milcity@v3"])
  assert.equal(body.versions[1].path, "06 Standards/Brand Profiles/Published/milcity/v3.json")
  assert.equal(body.versions[1].record, backupRecord(versions.milcity[2]), "the same record export writes")
  assert.deepEqual(calls, ["milcity>1"], "a non-brand document id is skipped")
  assert.equal((body as unknown as { more: boolean }).more, false)
  assert.deepEqual((await (await get("?after=milcity:3")).json()), { versions: [], more: false }, "up to date: nothing")
  assert.equal(((await (await get("")).json()) as { versions: unknown[] }).versions.length, 3, "a brand 434-context does not hold yet starts from 0")

  // Bounded: a page holds at most pageSize versions, and says when more are left.
  const paged = (q: string) => serveBackups(new Request(`https://example.test/x${q}`, { headers: { authorization: `Bearer ${TOKEN}` } }), async () => source, ENV, 2)
  const p1 = await (await paged("")).json() as { versions: { n: number }[]; more: boolean }
  assert.deepEqual([p1.versions.map(v => v.n), p1.more], [[1, 2], true])
  const p2 = await (await paged("?after=milcity:2")).json() as { versions: { n: number }[]; more: boolean }
  assert.deepEqual([p2.versions.map(v => v.n), p2.more], [[3], false])
  assert.equal((await get("?after=milcity:1", null)).status, 401)
  assert.equal((await get("?after=milcity:1", `Bearer ${"u".repeat(40)}`)).status, 401)
  assert.equal((await get("?after=milcity:1", `Bearer ${TOKEN}`, {})).status, 503, "unset: refused for everyone")
  assert.equal((await get("?after=nope")).status, 400)
  calls.length = 0
  await get("?after=milcity:1", null)
  assert.deepEqual(calls, [], "nothing is read before the credential is checked")
  const failing = await serveBackups(new Request("https://example.test/x", { headers: { authorization: `Bearer ${TOKEN}` } }), async () => { throw new Error("db down") }, ENV)
  assert.equal(failing.status, 500)
})

test("Firestore: publish, refuse a broken draft, restore, and read the published profile fresh", { skip: !process.env.FIRESTORE_EMULATOR_HOST && "no FIRESTORE_EMULATOR_HOST" }, async () => {
  const [{ scriptDb }, { firestoreBrandProfiles, readPublishedProfile }] = await Promise.all([import("../../scripts/brand-profiles/load"), import("../firestore-brand-profiles")])
  const { db, target } = await scriptDb()
  assert.match(target, /^emulator/)
  const id = `zz-test-${Date.now().toString(36)}`, profile = { ...structuredClone(published.milcity), id }
  const store = firestoreBrandProfiles(db)
  assert.deepEqual(await store.create({ id, brand_type: "owned", client_id: null, identity: { source: "test", record: "test" }, sources: { seeds: null } }), { created: true })
  assert.deepEqual(await store.create({ id, brand_type: "client", client_id: "x", identity: { source: "t", record: "t" }, sources: { seeds: null } }), { created: false })
  assert.deepEqual(await readPublishedProfile(id, db), { problems: [`no published brand profile for ${id}`] })
  await store.saveDraft(id, { profile, examples: { approved: [{ text: "An approved caption" }], rejected: [] } }, BY, AT)
  assert.deepEqual(await readPublishedProfile(id, db), { problems: [`no published brand profile for ${id}`] }, "a draft affects nothing")
  const v1 = await store.publish(id, BY, AT)
  assert.ok(v1.ok); assert.equal(v1.version.version_id, `${id}@v1`)
  const broken = structuredClone(profile) as Record<string, unknown>; delete broken.editorial
  await store.saveDraft(id, { profile: broken, examples: { approved: [], rejected: [] } }, BY, AT)
  const refused = await store.publish(id, BY, AT)
  assert.ok(!refused.ok && refused.problems.some(p => /editorial is required/.test(p)))
  const live = await readPublishedProfile(id, db)
  assert.ok("active" in live && live.active.versionId === `${id}@v1`, "the refused draft changed nothing")
  const edited = { ...structuredClone(profile), rulesVersion: "test-rules.2" }
  await store.saveDraft(id, { profile: edited, examples: { approved: [], rejected: [] } }, BY, AT)
  assert.ok((await store.publish(id, BY, AT)).ok)
  assert.ok(!(await store.publish(id, BY, AT)).ok, "no duplicate version")
  const now = await readPublishedProfile(id, db)
  assert.ok("active" in now && now.active.profile.rulesVersion === "test-rules.2" && now.active.versionId === `${id}@v2`, "read fresh: the new version governs at once")
  await store.saveDraft(id, { profile: { ...edited, rulesVersion: "unpublished" }, examples: { approved: [], rejected: [] } }, BY, AT)
  assert.ok(!(await store.restore(id, `${id}@v1`, BY, AT)).ok, "unpublished draft edits are not overwritten")
  const restored = await store.restore(id, `${id}@v1`, BY, AT, true)
  assert.equal(((await store.get(id))!.drafts_before_restore[0].profile as { rulesVersion: string }).rulesVersion, "unpublished", "kept")
  assert.ok(restored.ok && restored.version.version_id === `${id}@v3` && restored.version.restored_from === `${id}@v1`)
  assert.ok(!(await store.restore(id, `${id}@v99`, BY, AT)).ok)
  const back = await readPublishedProfile(id, db)
  assert.ok("active" in back && back.active.profile.rulesVersion === profile.rulesVersion && back.active.versionId === `${id}@v3`)
  assert.deepEqual((await store.versions(id)).map(v => [v.version_id, v.published_by, v.restored_from]), [[`${id}@v3`, BY, `${id}@v1`], [`${id}@v2`, BY, null], [`${id}@v1`, BY, null]])
  assert.deepEqual((await store.versionsAfter(id, 1, 50)).map(v => v.version_id), [`${id}@v2`, `${id}@v3`], "oldest first")
  assert.deepEqual(await store.versionsAfter(id, 3, 50), [])
  assert.deepEqual((await store.versionsAfter(id, 0, 2)).map(v => v.n), [1, 2], "limited")
})
