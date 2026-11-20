/**
 * The Skills list's catalog parse (lib/skills/catalog-view.ts) on an invented catalog. No business skill is in this
 * public repository (Skill Building Standard §2). Run: tsx --test lib/__tests__/skills-catalog-view.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseCatalog, splitDescription, sopUrl } from "../skills/catalog-view"

const CATALOG = JSON.stringify({
  generatedBy: "invented",
  skills: {
    "sample-greeter": {
      description: "Greets a visitor — reads the name, writes a hello. Use when someone asks for a greeting. Not for farewells.",
      owner: "A. Person",
      version: "1.2.3",
      status: "active",
      sop: "06 Standards/Sample Greeter_SOP.md",
      autonomy_ceiling: "approval",
      data_class: "personal",
      exam: { status: "suite", suites: ["03 Skills/evals/exam/sample-greeter"] },
      properties: ["434", "milcity", "unknownbrand"],
    },
    "bare-skill": { description: "Does one thing." },
  },
})

test("splits a description at its first Use sentence", () => {
  assert.deepEqual(splitDescription("Does X. Use this skill whenever Y. Do not use it for Z."), { does: "Does X.", when: "Use this skill whenever Y. Do not use it for Z." })
  assert.deepEqual(splitDescription("Does X only."), { does: "Does X only.", when: "" })
  // With no "Use" sentence, its limits say when.
  assert.deepEqual(splitDescription("Answers X. Runs only on Y. Not for Z."), { does: "Answers X.", when: "Runs only on Y. Not for Z." })
  // "Use" inside a sentence is not a split.
  assert.equal(splitDescription("Makes things to use. Use when asked.").does, "Makes things to use.")
})

test("parses every catalog field the card shows, in the catalog's order", () => {
  const [a, b] = parseCatalog(CATALOG)
  assert.equal(a.name, "sample-greeter")
  assert.equal(a.does, "Greets a visitor — reads the name, writes a hello.")
  assert.equal(a.when, "Use when someone asks for a greeting. Not for farewells.")
  assert.equal(a.owner, "A. Person")
  assert.equal(a.version, "1.2.3")
  assert.equal(a.autonomyCeiling, "approval")
  assert.match(a.stopPoint, /approval/)
  assert.equal(a.dataClass, "personal")
  assert.deepEqual(a.exam, { status: "suite", suites: 1 })
  assert.deepEqual(a.brands, ["434 MEDIA", "MilCityUSA", "unknownbrand"])
  assert.equal(a.sop?.url, "https://github.com/434media/434-context/blob/main/06%20Standards/Sample%20Greeter_SOP.md")
  assert.equal(b.name, "bare-skill")
  assert.equal(b.sop, null)
  assert.equal(b.owner, null)
  assert.equal(b.autonomyCeiling, null)
  assert.deepEqual(b.exam, { status: "none", suites: 0 })
  assert.deepEqual(b.brands, [])
})

test("refuses text that is not the catalog", () => {
  assert.throws(() => parseCatalog("not json"), /not JSON/)
  assert.throws(() => parseCatalog("{}"), /no skills/)
})

test("links an SOP at a commit when given one", () => {
  assert.equal(sopUrl("06 Standards/A.md", "abc"), "https://github.com/434media/434-context/blob/abc/06%20Standards/A.md")
})
