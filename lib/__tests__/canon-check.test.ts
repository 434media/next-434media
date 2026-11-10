/**
 * The canon check (scripts/canon/check.ts, V1 item 2): a single-source value outside its owner fails. Invented values
 * for the rules; the real owners only to show the check can still read them.
 * Run: tsx --test lib/__tests__/canon-check.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
import { findCanon, listIn, readCanon, OWNERS, type Canon } from "../../scripts/canon/check"

const canon: Canon = {
  excludedCountries: ["atlantis", "lemuria", "mu", "hyperborea", "thule"],
  excludedCodes: ["QA1", "QB1", "QC1", "QD1", "QE1", "QF1", "QG1"].map((c) => c.slice(0, 2)),
  mailchimpTags: ["brand:acme", "source:newsletter", "status:prospect"],
  roster: ["Alpha Media", "Beta Boxing", "Gamma Canvas", "Delta"],
}
const rules = (path: string, text: string) => findCanon(path, text, canon).map((f) => f.rule)

test("a jurisdiction list declared or re-listed outside its owner fails", () => {
  assert.deepEqual(rules("lib/x.ts", "export const EXCLUDED_COUNTRIES = new Set(['x'])"), ["jurisdiction list declared outside its owner"])
  assert.deepEqual(rules("lib/x.ts", `const blocked = [\n"atlantis",\n"lemuria",\n"mu",\n"thule"]`), ["excluded countries re-listed"])
  assert.deepEqual(rules("lib/x.ts", `["QA","QB","QC","QD","QE","QF"]`), ["excluded countries re-listed"])
  // Three names, a mention in prose, an import, and the owner itself pass.
  assert.deepEqual(rules("lib/x.ts", `["atlantis","lemuria","mu"]`), [])
  assert.deepEqual(rules("lib/x.ts", "import { EXCLUDED_COUNTRIES } from './scorer'; EXCLUDED_COUNTRIES.has(c)"), [])
  assert.deepEqual(rules(OWNERS.jurisdiction, `export const EXCLUDED_COUNTRIES = new Set(["atlantis","lemuria","mu","thule"])`), [])
  // The prompt inputs CLAUDE.md names may state the jurisdictions in words for the model.
  assert.deepEqual(rules("lib/prospecting/translator.ts", `"atlantis" "lemuria" "mu" "thule"`), [])
})

test("a Mailchimp tag written by hand fails; the builders, event tags and other taxonomies pass", () => {
  assert.deepEqual(rules("lib/x.ts", `t.includes("brand:acme")`), ["Mailchimp tag written by hand"])
  assert.deepEqual(rules("lib/x.ts", "tags: [`status:prospect`]"), ["Mailchimp tag written by hand"])
  assert.deepEqual(rules("lib/x.ts", `brandTag("acme"); t.includes("event:anything"); "source:form"; "brand:acme-two"`), [])
  assert.deepEqual(rules(OWNERS.mailchimp, `"brand:acme"`), [])
})

test("a second brand roster fails; a brand named alone passes", () => {
  assert.deepEqual(rules("components/x.tsx", `const ORDER = ["Alpha Media", "Beta Boxing",\n "Gamma Canvas"]`), ["brand roster re-listed"])
  assert.deepEqual(rules("components/x.tsx", `<h1>Alpha Media</h1> {brand === "Beta Boxing" && "Gamma Canvas"}`), [], "display text and two comparisons")
  assert.deepEqual(rules("components/x.tsx", `if (brand === "Alpha Media") label = "Beta Boxing"`), [])
  assert.deepEqual(rules(OWNERS.roster, `["Alpha Media","Beta Boxing","Gamma Canvas"]`), [])
})

test("listIn reads a Set or an array, ignores comments, and fails loudly when the owner changed shape", () => {
  assert.deepEqual(listIn(`export const X: Set<string> = new Set([\n // a "comment"\n "a", "b",\n])`, "X"), ["a", "b"])
  assert.deepEqual(listIn(`export const Y = ["c"] as const`, "Y"), ["c"])
  assert.throws(() => listIn("export const Z = 1", "W"), /not found in its owner/)
})

test("the real owners still parse, so the check is not silently checking nothing", () => {
  const real = readCanon(join(__dirname, "../.."))
  assert.ok(real.excludedCountries.length >= 10)
  assert.ok(real.excludedCodes.length >= 10)
  assert.ok(real.mailchimpTags.some((t) => t.startsWith("brand:")) && real.mailchimpTags.some((t) => t.startsWith("source:")))
  assert.ok(real.roster.length >= 3)
})
