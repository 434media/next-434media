/**
 * Brand profiles from the command line: the same publish path as the admin routes (lib/firestore-brand-profiles.ts),
 * for working sessions until the Brands area's editing screens exist (plan v11, Step 4).
 *
 *   npx tsx scripts/brand-profiles/profile.ts <command> … [--env-dir ~/434]
 *
 * --env-dir loads that directory's .env files the way Next does (@next/env). Node's own --env-file does not unescape
 * the quoted GOOGLE_SERVICE_ACCOUNT_KEY, so it cannot be used for production.
 *
 *   create <id> --identity-source <s> --identity-record <r> [--brand-type owned|client] [--client-id <id>] [--seeds <path>]
 *   draft <id> <file.json>            save the draft from {profile, examples?} (a private file outside this repository)
 *   publish <id>                      validate the draft and publish it as a new version
 *   restore <id> <id@vN> [--force]    republish an earlier version as a new version; --force replaces a draft with
 *                                     unpublished edits, which is kept in drafts_before_restore
 *   show <id>                         the published version and whether the draft differs from it
 *   history <id>                      every published version
 *   export <id> <id@vN> <file>        write a version's backup record to a file (434-context pulls the records
 *                                     itself, daily: GET /api/brand-profiles/backups, plan v11.1 Step 2b)
 *   book <id> <standard.md> --source <path in 434-context>
 *                                     generate the brand book from the brand's visual standard into the draft's
 *                                     `visual` block (lib/content-pipeline/brand-book.ts; plan v11.2.1 Step 4 item 3),
 *                                     starting from the draft, or the published version when there is no draft.
 *                                     Publish it from the Brands area or with publish.
 *
 * Writes need --actor <email>. Everything runs against the emulator when FIRESTORE_EMULATOR_HOST is set; against
 * production only with --production (reads too), which a working session passes for a write only after the founder's
 * go-ahead for that write.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { parseVisualStandard } from "../../lib/content-pipeline/brand-book"
import { bookDigest } from "../../lib/content-pipeline/brand-book-check"
import { scriptDb } from "./load"
import { firestoreBrandProfiles } from "../../lib/firestore-brand-profiles"
import { profileSha256, publishProblems, type BrandType, type ProfileExamples } from "../../lib/content-pipeline/profile-store"
import { backupRecord } from "../../lib/content-pipeline/profile-backup"

const argv = process.argv.slice(2)
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const VALUE_FLAGS = new Set(["--env-dir", "--actor", "--brand-type", "--client-id", "--identity-source", "--identity-record", "--seeds", "--source"])
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.has(argv[i - 1])))

async function main() {
  const [command, id, a, b] = positional
  if (!command || !id) throw new Error("usage: profile.ts <create|draft|publish|restore|show|history|export|book> <id> …")
  const writes = ["create", "draft", "publish", "restore", "book"].includes(command)
  const envDir = flag("--env-dir")
  if (envDir) {
    const { createRequire } = await import("node:module")
    const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"))
    ;(fromNext("@next/env") as { loadEnvConfig: (dir: string, dev?: boolean, log?: unknown) => unknown }).loadEnvConfig(envDir, false, { info: () => {}, error: console.error })
  }
  const { db, target } = await scriptDb(argv.includes("--production"))
  console.log(`target: ${target}`)
  const actor = flag("--actor") ?? ""
  if (writes && !/^[^@\s]+@[^@\s]+$/.test(actor)) throw new Error("writes need --actor <email>")
  const store = firestoreBrandProfiles(db), at = new Date().toISOString()

  if (command === "create") {
    const brand_type = (flag("--brand-type") ?? "owned") as BrandType
    const r = await store.create({ id, brand_type, client_id: flag("--client-id") ?? null, identity: { source: flag("--identity-source") ?? "", record: flag("--identity-record") ?? "" }, sources: { seeds: flag("--seeds") ?? null } })
    console.log(r.created ? `created brand_profiles/${id}` : `brand_profiles/${id} already exists; left as it is`)
  } else if (command === "draft") {
    if (!a) throw new Error("draft <id> <file.json>")
    const raw = JSON.parse(readFileSync(a, "utf8")) as { profile?: unknown; examples?: ProfileExamples }
    if (!raw.profile) throw new Error("the file holds {profile, examples?}")
    const doc = await store.saveDraft(id, { profile: raw.profile, examples: raw.examples ?? { approved: [], rejected: [] } }, actor, at)
    const problems = publishProblems(doc)
    console.log(`draft saved (sha256 ${profileSha256(raw.profile)}); ${problems.length ? `it would NOT publish:\n- ${problems.join("\n- ")}` : "it would publish"}`)
  } else if (command === "publish" || command === "restore") {
    if (command === "restore" && !a) throw new Error("restore <id> <id@vN>")
    const r = command === "publish" ? await store.publish(id, actor, at) : await store.restore(id, a!, actor, at, argv.includes("--force"))
    if (!r.ok) { console.error(`REFUSED:\n- ${r.problems.join("\n- ")}`); process.exitCode = 2; return }
    console.log(`published ${r.version.version_id} (profile ${r.version.profile.profileVersion}, sha256 ${r.version.profile_sha256})${r.version.restored_from ? `, restored from ${r.version.restored_from}` : ""}`)
  } else if (command === "show") {
    const doc = await store.get(id)
    if (!doc) throw new Error(`no brand_profiles/${id}`)
    const p = doc.published
    console.log(JSON.stringify({ id, brand_type: doc.brand_type, client_id: doc.client_id, identity: doc.identity, sources: doc.sources, last_version: doc.last_version,
      published: p && { version_id: p.version_id, profileVersion: p.profile.profileVersion, rulesVersion: p.profile.rulesVersion, sha256: p.profile_sha256, published_by: p.published_by, published_at: p.published_at, restored_from: p.restored_from, series: Object.keys(p.profile.series), requestKinds: p.profile.requestKinds.map(k => k.kind), template_map: p.template_map },
      draft: doc.draft && { sha256: profileSha256(doc.draft.profile), same_as_published: !!p && profileSha256(doc.draft.profile) === p.profile_sha256, updated_by: doc.draft.updated_by, updated_at: doc.draft.updated_at, publishProblems: publishProblems(doc) } }, null, 2))
  } else if (command === "history") {
    for (const v of await store.versions(id)) console.log(`${v.version_id}  ${v.profile.profileVersion}  ${v.profile_sha256}  ${v.published_at}  ${v.published_by}${v.restored_from ? `  restored from ${v.restored_from}` : ""}`)
  } else if (command === "export") {
    if (!a || !b) throw new Error("export <id> <id@vN> <file>")
    const v = (await store.versions(id)).find(x => x.version_id === a)
    if (!v) throw new Error(`no version ${a}`)
    writeFileSync(b, backupRecord(v)); console.log(`wrote ${b}`)
  } else if (command === "book") {
    const source = flag("--source")
    if (!a || !source) throw new Error("book <id> <standard.md> --source <its path in 434-context>")
    const md = readFileSync(a, "utf8")
    const parsed = parseVisualStandard(md, { path: source, sha256: createHash("sha256").update(md).digest("hex").slice(0, 16) })
    // Stamped, so a block changed by hand after this is not shown (brand-book-check.ts).
    const visual = { ...parsed, digest: bookDigest(parsed) }
    const doc = await store.get(id)
    if (!doc) throw new Error(`no brand_profiles/${id}`)
    const base = doc.draft ?? (doc.published && { profile: doc.published.profile, examples: doc.published.examples })
    if (!base) throw new Error("no draft or published profile to add the brand book to")
    const saved = await store.saveDraft(id, { profile: { ...(base.profile as object), visual }, examples: base.examples }, actor, at)
    const problems = publishProblems(saved)
    console.log(`brand book from ${visual.standard.title} (${visual.standard.version}, sha256 ${visual.standard.sha256}): ${visual.sections.length} sections into the draft; ${problems.length ? `it would NOT publish:\n- ${problems.join("\n- ")}` : "it would publish"}`)
  } else throw new Error(`unknown command ${command}`)
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })
