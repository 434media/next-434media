/**
 * Offline. Brand profiles (lib/content-pipeline/profile.ts): the emitted MilCityUSA profile loads and validates, a
 * profile that fails validation is refused, and nothing the engine needs is missing from it.
 * Run: tsx --test lib/__tests__/brand-profile.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import milcity from "../brand-profiles/milcity.json"
import manifest from "../brand-profiles/manifest.json"
import { loadProfile, profileProblems, validateProfile } from "../content-pipeline/profile"
import { PIPELINE_PROPERTIES, PROPERTY_TEMPLATES, propertyCanGenerate } from "../content-pipeline/properties"
import { SERIES } from "../content-pipeline/series"
import { MCU_BRAND_TEMPLATES } from "../canva-create"

const clone = () => structuredClone(milcity) as unknown as Record<string, unknown>

test("the emitted MilCityUSA profile validates, and the engine runs it", () => {
  assert.deepEqual(validateProfile(milcity), [])
  const p = loadProfile("milcity")
  assert.equal(p.name, "MilCityUSA"); assert.equal(p.draftPrefix, "MCU")
  assert.equal(SERIES.dt101.templates.feed, "EAHYOAJhC_8")
})

test("the generated profile is not hand-edited: it matches the hash its manifest records", () => {
  const bytes = readFileSync(new URL("../brand-profiles/milcity.json", import.meta.url))
  assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0, 16), manifest.profiles.milcity.artifactSha256)
  assert.equal(manifest.profiles.milcity.profileSha256, milcity.profileSha256)
})

test("a profile that fails validation is refused: loadProfile throws and Generate doesn't offer the brand", () => {
  const broken = clone(); delete broken.editorial
  assert.match(validateProfile(broken).join("; "), /editorial is required/)
  assert.throws(() => loadProfile("milcity", { milcity: broken }), /failed validation, so the content pipeline will not run it/)
  assert.deepEqual(profileProblems("txmx"), ["no brand profile for txmx"])
  assert.ok(!PROPERTY_TEMPLATES.txmx && !propertyCanGenerate("txmx", "news"))
  // Unknown keys, unknown formats and a request kind pointing at a missing series are all refused.
  const extra = clone(); extra.slogan = "x"
  assert.match(validateProfile(extra).join("; "), /profile\.slogan is not a profile key/)
  const fmt = clone(); (fmt.series as Record<string, unknown>).podcast = (fmt.series as Record<string, unknown>).news
  assert.match(validateProfile(fmt).join("; "), /series\.podcast: not a format the engine knows/)
  const kinds = clone(); (kinds.requestKinds as { series: string[] }[])[0].series = ["followon_graphicx"]
  assert.match(validateProfile(kinds).join("; "), /requestKinds\[0\]\.series: series defined in this profile/)
  const field = clone(); ((field.series as Record<string, { fields: { perLine?: unknown }[] }>).news.fields[0]).perLine = "15"
  assert.match(validateProfile(field).join("; "), /series\.news\.fields\[0\]\.perLine: 1–200/)
})

test("the Generate panel's templates come from the profile, as they were in code", () => {
  assert.deepEqual(PROPERTY_TEMPLATES.milcity, [
    { kind: "news", label: "News", templates: ["EAHXWo1LiF8"], detail: "One story, one card" },
    { kind: "breaking", label: "Breaking News", templates: ["EAHXZAbAA8s"], detail: "Primary source in the last 24 hours" },
    { kind: "dt101", label: "Defense Tech 101", templates: ["EAHYOAJhC_8"], detail: "Benefit-led card, mission-brief caption" },
    { kind: "icymi", label: "ICYMI roundup", templates: ["EAHXZPgjqSY", "EAHXZJnAT0o"], detail: "Cover + five published stories" },
  ])
  assert.ok(PIPELINE_PROPERTIES.filter(p => p.active).every(p => !profileProblems(p.id).length))
})

test("every template a profile names is inside the publisher's Canva allowlist", () => {
  for (const s of Object.values(SERIES)) for (const id of Object.values(s.templates)) if (id) assert.ok(MCU_BRAND_TEMPLATES.has(id), `${s.key}: ${id}`)
})
