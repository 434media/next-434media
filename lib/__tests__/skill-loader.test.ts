/**
 * The SKILL.md loader (lib/skills/loader.ts, V1 item 2) on an invented skill (fixtures/skills/sample-greeter): the
 * specification and size checks, the fingerprint pin, the tool allow-list, the folder-confined read tool, and one full
 * agent run on the SDK's mock model. No business skill is in this public repository (Skill Building Standard §2).
 * Run: tsx --test lib/__tests__/skill-loader.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
import { tool } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { z } from "zod"
import { fingerprint, parseFrontmatter, parseSkill, readSkillFolder, skillAgent, skillInstructions, skillTools, type SkillFiles } from "../skills/loader"

const DIR = join(__dirname, "fixtures/skills/sample-greeter")
const load = () => readSkillFolder(DIR)
const md = (front: string, body = "Do the thing.") => ({ "SKILL.md": `---\n${front}\n---\n\n${body}\n` })

test("reads the invented skill folder and parses it", async () => {
  const files = await load()
  assert.deepEqual(Object.keys(files).sort(), ["SKILL.md", "references/rules.md", "scripts/format.py"])
  const r = parseSkill(files, { folder: "sample-greeter" })
  assert.ok(r.ok, !r.ok ? r.problems.join("; ") : "")
  assert.equal(r.skill.name, "sample-greeter")
  assert.deepEqual(r.skill.metadata, { owner: "Test Owner", version: "0.1.0" })
  assert.deepEqual(r.skill.allowedTools, ["lookup_visitor"])
  assert.deepEqual(r.skill.resources, ["references/rules.md"])
  assert.deepEqual(r.skill.scripts, ["scripts/format.py"])
  assert.match(r.skill.body, /^# Sample greeter/)
  assert.equal(r.skill.sha256, fingerprint(files))
})

test("the frontmatter forms 434-context's adapters use: quoted versions, a metadata map, block scalars", () => {
  const f = parseFrontmatter(`---\nname: x\ndescription: >\n  folded over\n  two lines\nmetadata:\n  owner: A B\n  version: "1.1.0"\n---\nbody`)
  assert.deepEqual(f.problems, [])
  assert.equal(f.fields.description, "folded over two lines")
  assert.deepEqual(f.fields.metadata, { owner: "A B", version: "1.1.0" })
  assert.equal(f.body, "body")
})

test("refuses what the specification refuses, naming each problem", () => {
  const bad = (files: SkillFiles, re: RegExp, folder?: string) => {
    const r = parseSkill(files, { folder })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.problems.some(p => re.test(p)), `${re} not in: ${r.problems.join("; ")}`)
  }
  bad({ "README.md": "x" }, /no SKILL\.md/)
  bad({ "SKILL.md": "# no frontmatter" }, /must start with YAML frontmatter/)
  bad(md("description: d"), /"name" is required/)
  bad(md("name: Bad-Name\ndescription: d"), /lowercase/)
  bad(md("name: a--b\ndescription: d"), /lowercase/)
  bad(md("name: -a\ndescription: d"), /lowercase/)
  bad(md(`name: ${"a".repeat(65)}\ndescription: d`), /lowercase/)
  bad(md("name: other\ndescription: d"), /must match its folder/, "sample")
  bad(md("name: a"), /"description" is required/)
  bad(md(`name: a\ndescription: ${"d".repeat(1025)}`), /limit is 1024/)
  bad(md("name: a\ndescription: d\nwhen: x"), /unknown frontmatter field "when"/)
  bad(md("name: a\ndescription: d\ntools: [a, b]"), /flow collections|unknown/)
  bad(md("name: a\ndescription: d", ""), /no instructions/)
  bad(md("name: a\ndescription: d", "line\n".repeat(501)), /over 500 lines/)
  bad(md("name: a\ndescription: d", "x".repeat(21 * 1024)), /20 KB cap/)
  bad({ ...md("name: a\ndescription: d"), "../escape.md": "x" }, /unsafe file path/)
})

test("the fingerprint changes with any byte of any file, and with a file's path", async () => {
  const files = await load()
  const base = fingerprint(files)
  assert.notEqual(fingerprint({ ...files, "references/rules.md": files["references/rules.md"] + " " }), base)
  const { ["references/rules.md"]: rules, ...rest } = files
  assert.notEqual(fingerprint({ ...rest, "references/rule.md": rules }), base)
  assert.equal(fingerprint({ ...files }), base)
})

test("tools: only what allowed-tools names, plus the folder-confined reader", async () => {
  const files = await load()
  const r = parseSkill(files)
  assert.ok(r.ok)
  const lookup_visitor = tool({ inputSchema: z.object({}), execute: async () => ({}) })
  const send_email = tool({ inputSchema: z.object({}), execute: async () => ({ sent: true }) })
  const { tools, missing } = skillTools(r.skill, files, { lookup_visitor, send_email })
  assert.deepEqual(Object.keys(tools).sort(), ["lookup_visitor", "read_skill_file"])
  assert.deepEqual(missing, [])
  // No allowed-tools field: the caller's tools are not offered at all.
  const none = parseSkill(md("name: a\ndescription: d"))
  assert.ok(none.ok)
  assert.deepEqual(Object.keys(skillTools(none.skill, {}, { send_email }).tools), ["read_skill_file"])
  // The reader serves only listed files: not SKILL.md's neighbours outside the list, not scripts, not a traversal.
  const exec = tools.read_skill_file.execute!
  const ctx = { toolCallId: "t", messages: [] } as never
  assert.deepEqual(await exec({ path: "references/rules.md" }, ctx), { path: "references/rules.md", content: files["references/rules.md"] })
  for (const path of ["scripts/format.py", "../../../package.json", "/etc/passwd", "SKILL.md"]) {
    assert.ok("error" in (await exec({ path }, ctx) as object), path)
  }
})

test("the instructions carry the body, the readable files, and that scripts cannot run", async () => {
  const r = parseSkill(await load())
  assert.ok(r.ok)
  const text = skillInstructions(r.skill)
  assert.match(text, /^# Sample greeter/)
  assert.match(text, /- references\/rules\.md/)
  assert.match(text, /scripts\/format\.py\) cannot be run here/)
})

test("skillAgent refuses a bad skill, a changed one, and one needing a tool the run lacks", async () => {
  const files = await load()
  const model = new MockLanguageModelV4()
  assert.throws(() => skillAgent({ files: md("name: A\ndescription: d"), model }), /Skill refused: "name"/)
  assert.throws(() => skillAgent({ files, model, expectedSha256: "0".repeat(64), tools: { lookup_visitor: tool({ inputSchema: z.object({}) }) } }), /not the pinned version/)
  assert.throws(() => skillAgent({ files, model }), /needs tools this run does not offer: lookup_visitor/)
})

test("a full run on the mock model: reads the reference, calls the allowed tool, answers; caching on, routing kept", async () => {
  const files = await load()
  const usage = { inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: 0 } }
  const calls: Parameters<MockLanguageModelV4["doGenerate"]>[0][] = []
  const script = [
    { content: [{ type: "tool-call" as const, toolCallId: "1", toolName: "read_skill_file", input: JSON.stringify({ path: "references/rules.md" }) }], finishReason: { unified: "tool-calls" as const, raw: undefined } },
    { content: [{ type: "tool-call" as const, toolCallId: "2", toolName: "lookup_visitor", input: JSON.stringify({ id: "v1" }) }], finishReason: { unified: "tool-calls" as const, raw: undefined } },
    { content: [{ type: "text" as const, text: "Hello, Ana!" }], finishReason: { unified: "stop" as const, raw: undefined } },
  ]
  const model = new MockLanguageModelV4({ doGenerate: async o => { calls.push(o); return { ...script[calls.length - 1], usage, warnings: [] } } })
  const looked: string[] = []
  const lookup_visitor = tool({ inputSchema: z.object({ id: z.string() }), execute: async ({ id }) => { looked.push(id); return { name: "Ana" } } })
  const { agent, skill } = skillAgent({ files, folder: "sample-greeter", expectedSha256: fingerprint(files), model, tools: { lookup_visitor }, providerOptions: { gateway: { zeroDataRetention: true } } })
  const r = await agent.generate({ prompt: "Greet visitor v1." })
  assert.equal(r.text, "Hello, Ana!")
  assert.deepEqual(looked, ["v1"])
  assert.equal(calls.length, 3)
  // The skill body is the system prompt; the reference came back as the first tool result.
  assert.equal(calls[0].prompt[0].role, "system")
  assert.match(String(calls[0].prompt[0].content), /# Sample greeter/)
  assert.match(JSON.stringify(calls[1].prompt), /Hello, <name>!/)
  // Gateway automatic caching on every step, the caller's routing kept.
  for (const c of calls) assert.deepEqual(c.providerOptions?.gateway, { zeroDataRetention: true, caching: "auto" })
  assert.equal(skill.metadata.version, "0.1.0")
})
