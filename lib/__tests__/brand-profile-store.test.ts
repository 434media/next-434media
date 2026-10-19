/**
 * Brand profiles in the database (lib/content-pipeline/profile-store.ts, lib/firestore-brand-profiles.ts): Publish
 * validates the draft and refuses a broken one, every version is kept with who and when, Restore republishes an earlier
 * version in one action, the engine reads the profile in scope, and posts are stamped with its version.
 * The Firestore part runs against the emulator (FIRESTORE_EMULATOR_HOST) and is skipped without it.
 * Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 tsx --test lib/__tests__/brand-profile-store.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { preparePublish, publishProblems, profileSha256, type BrandProfileDoc } from "../content-pipeline/profile-store"
import { BRAND, activeProfile, setProcessProfile, withProfile } from "../content-pipeline/brand"
import { SERIES } from "../content-pipeline/series"
import { KIND_CODE } from "../content-pipeline/worker"
import { profileStamp } from "../content-pipeline/run"
import { backupPath, backupRecord, backupToGitHub, backupPublished } from "../content-pipeline/profile-backup"
import type { BrandProfile } from "../content-pipeline/profile"
import { published, loadPublishedProfileFirst } from "./published-profile"

loadPublishedProfileFirst()
const AT = "2026-10-19T18:00:00.000Z", BY = "founder@example.com"
const docWith = (profile: unknown, over: Partial<BrandProfileDoc> = {}): BrandProfileDoc => ({
  id: "milcity", brand_type: "owned", client_id: null, identity: { source: "master Section 4", record: "MilCityUSA" }, sources: { seeds: "content_pipeline_config/mcu_seeds" },
  draft: { profile, examples: { approved: [], rejected: [] }, updated_by: BY, updated_at: AT }, published: null, last_version: 0, ...over,
})
const clone = () => structuredClone(published.milcity) as unknown as Record<string, unknown>

test("Publish: a valid draft becomes version 1, with who, when, its hash and the platform → format → template map", () => {
  const r = preparePublish(docWith(published.milcity), BY, AT)
  assert.ok(r.ok)
  const v = r.version
  assert.equal(v.version_id, "milcity@v1"); assert.equal(v.n, 1); assert.equal(v.published_by, BY); assert.equal(v.published_at, AT)
  assert.equal(v.profile_sha256, profileSha256(published.milcity)); assert.equal(v.restored_from, null); assert.deepEqual(v.backup, { status: "pending" })
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
})

test("the engine reads the profile in scope: concurrent scopes don't mix, and no scope means no run", async () => {
  const other = { ...structuredClone(published.milcity), name: "Other Brand", draftPrefix: "OTH" } as BrandProfile
  const seen = await Promise.all([
    withProfile({ profile: published.milcity, versionId: "milcity@v1" }, async () => { await new Promise(r => setTimeout(r, 5)); return [BRAND.name, activeProfile().versionId, profileStamp().profile_version_id] }),
    withProfile({ profile: other, versionId: "other@v4" }, async () => [BRAND.name, activeProfile().versionId, profileStamp().profile_version_id]),
  ])
  assert.deepEqual(seen, [["MilCityUSA", "milcity@v1", "milcity@v1"], ["Other Brand", "other@v4", "other@v4"]])
  assert.equal(withProfile({ profile: published.milcity, versionId: "milcity@v9" }, () => KIND_CODE.dt101), published.milcity.requestKinds.find(k => k.kind === "dt101")!.code)
  assert.deepEqual(Object.keys(SERIES), Object.keys(published.milcity.series))
  const saved = published.active
  setProcessProfile(null)
  try { assert.throws(() => BRAND.name, /No published brand profile is in scope/) } finally { setProcessProfile(saved) }
})

test("backup: the record is the version as published, to a records branch; without the token it stays pending", async () => {
  const r = preparePublish(docWith(published.milcity), BY, AT)
  assert.ok(r.ok)
  assert.equal(backupPath(r.version), "06 Standards/Brand Profiles/Published/milcity/v1.json")
  const record = JSON.parse(backupRecord(r.version))
  assert.equal(record.version_id, "milcity@v1"); assert.ok(!("backup" in record)); assert.deepEqual(record.profile, published.milcity)
  let marked = 0
  assert.deepEqual(await backupPublished(r.version, async () => { marked++ }, {}), { status: "pending" }); assert.equal(marked, 0)
  // With a token: the branch is created from main once, then the file is committed to it (scripted GitHub).
  const calls: string[] = []
  const gh = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method} ${url.replace("https://api.github.com/repos/434media/434-context", "")}`)
    const body = (status: number, json: unknown) => new Response(JSON.stringify(json), { status })
    if (url.endsWith("/git/ref/heads/records/brand-profile-backups")) return body(404, {})
    if (url.endsWith("/git/ref/heads/main")) return body(200, { object: { sha: "abc" } })
    if (url.endsWith("/git/refs")) return body(201, {})
    if (init?.method === "GET") return body(404, {})
    assert.equal(JSON.parse(String(init?.body)).branch, "records/brand-profile-backups")
    return body(201, { commit: { sha: "def" } })
  }) as typeof fetch
  const state = await backupToGitHub(r.version, "t", gh, () => AT)
  assert.deepEqual(state, { status: "done", path: backupPath(r.version), commit: "def", at: AT })
  assert.ok(calls.some(c => c.startsWith("PUT /contents/06%20Standards/Brand%20Profiles/Published/milcity/v1.json")), calls.join("\n"))
  assert.ok(!calls.some(c => /heads\/main$/.test(c) && c.startsWith("PUT")), "never writes main")
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
  const now = await readPublishedProfile(id, db)
  assert.ok("active" in now && now.active.profile.rulesVersion === "test-rules.2" && now.active.versionId === `${id}@v2`, "read fresh: the new version governs at once")
  const restored = await store.restore(id, `${id}@v1`, BY, AT)
  assert.ok(restored.ok && restored.version.version_id === `${id}@v3` && restored.version.restored_from === `${id}@v1`)
  assert.ok(!(await store.restore(id, `${id}@v99`, BY, AT)).ok)
  const back = await readPublishedProfile(id, db)
  assert.ok("active" in back && back.active.profile.rulesVersion === profile.rulesVersion && back.active.versionId === `${id}@v3`)
  assert.deepEqual((await store.versions(id)).map(v => [v.version_id, v.published_by, v.restored_from]), [[`${id}@v3`, BY, `${id}@v1`], [`${id}@v2`, BY, null], [`${id}@v1`, BY, null]])
  await store.markBackup(id, 3, { status: "done", path: "p", commit: "c", at: AT })
  assert.equal((await store.get(id))!.published!.backup.status, "done")
})
