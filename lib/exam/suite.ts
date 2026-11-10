/**
 * The exam's suite format (434 build sequence V1 item 3, IMP-27). A suite is fixtures plus assertions, never a runner,
 * so the same suite judges any executor: our engine, or a recorded run from another vendor.
 *
 * A suite is a folder:
 *   suite.json        what the suite is, the mock tools a case may offer, and how a flag and a hand-off are recognised
 *   cases/*.json      one case per file, or { "cases": [...] }; anyone adds a case by adding a file, with no code change
 *
 * Business suites (Polí, Smartie, the scheduling and MilCityUSA cases) hold business content, so they live with the
 * skill's evals in 434-context (Skill Building Standard §8), never in this public repository. The runner reads them
 * from a path. The suites committed here are invented, for the harness's own tests.
 */
import { createHash } from "node:crypto"
import { z } from "zod"

/** A mock tool a case may offer the executor. The exam never runs a real one: see lib/exam/mock-tools.ts. */
export const ToolSpec = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, "tool names are lower_snake_case"),
  description: z.string().min(1),
  /** JSON Schema for the tool's arguments. */
  input: z.record(z.string(), z.unknown()).default({ type: "object", properties: {} }),
  /** True when the real tool sends, posts or writes (an email, a post, a CRM write). Mocked either way. */
  sideEffect: z.boolean().default(false),
  /**
   * Arguments checked against the caller's scope, not just their shape: argument name → the scope list it must fall in
   * (`recipients` or `properties`). A call with a value outside the caller's scope is rejected by the mock and recorded.
   */
  scope: z.record(z.string(), z.enum(["recipients", "properties"])).default({}),
  /** What the mock returns when it accepts a call. */
  result: z.unknown().default({ ok: true }),
})
export type ToolSpec = z.infer<typeof ToolSpec>

export const SuiteSpec = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string(),
  version: z.string(),
  /** The skill or persona this suite examines, e.g. a skill's name. Free text. */
  subject: z.string().optional(),
  description: z.string().optional(),
  tools: z.array(ToolSpec).default([]),
  /** How an output flags something for a person: a call to `tool`, or text matching one of `patterns`. */
  flag: z.object({ tool: z.string().optional(), patterns: z.array(z.string()).default([]) }).default({ patterns: [] }),
  /**
   * How an output names its hand-off: a call to `tool` with the three fields, or a line per label in the text
   * ("Next owner: …", "Due: …", "Back to a person if: …"). Labels are matched case-insensitively at a line start.
   *
   * The completion rule (build plan v3) as the founder scoped it on 2026-11-10: it applies to new outputs only, meaning
   * a full task, not each one-line daily-brief item, and runs from before `since` are not scored on it. Every case it
   * applies to is checked for it, whether or not the case lists the check (see completionApplies).
   */
  completion: z
    .object({
      tool: z.string().optional(),
      /** The first case date (`input.today`) the rule applies to. A case with no date is a new output. */
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-11-10"),
      fields: z.object({ owner: z.string(), due: z.string(), returnCondition: z.string() }).default({ owner: "next_owner", due: "due", returnCondition: "return_condition" }),
      labels: z
        .object({ owner: z.array(z.string()), due: z.array(z.string()), returnCondition: z.array(z.string()) })
        .default({ owner: ["Next owner", "Owner"], due: ["Due", "Due date"], returnCondition: ["Back to a person if", "Returns to a person if", "Escalate if"] }),
    })
    .default({
      since: "2026-11-10",
      fields: { owner: "next_owner", due: "due", returnCondition: "return_condition" },
      labels: { owner: ["Next owner", "Owner"], due: ["Due", "Due date"], returnCondition: ["Back to a person if", "Returns to a person if", "Escalate if"] },
    }),
})
export type SuiteSpec = z.infer<typeof SuiteSpec>

/** Where a text check looks: the output text, the arguments of the tool calls (only `tool`'s, when named), or both. */
const Where = { in: z.enum(["all", "text", "tools"]).default("all"), tool: z.string().optional() }
const Text = z.object({ value: z.string(), ignoreCase: z.boolean().default(true), ...Where })
const Pattern = z.object({ pattern: z.string(), flags: z.string().default("i"), ...Where })
const Why = { why: z.string().optional() }

/** One check on an executor's output. `why` names the rule it holds the output to, and is shown with a failure. */
export const Assertion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("contains"), ...Text.shape, ...Why }),
  z.object({ type: z.literal("not_contains"), ...Text.shape, ...Why }),
  z.object({ type: z.literal("matches"), ...Pattern.shape, ...Why }),
  z.object({ type: z.literal("not_matches"), ...Pattern.shape, ...Why }),
  /** The tool was called (and, with `args`, with those argument values; with `accepted`, accepted or rejected). */
  z.object({ type: z.literal("tool_called"), tool: z.string(), args: z.record(z.string(), z.unknown()).optional(), accepted: z.boolean().optional(), ...Why }),
  /** The tool was not even attempted. */
  z.object({ type: z.literal("tool_not_called"), tool: z.string(), ...Why }),
  /** No tool marked `sideEffect` was attempted. */
  z.object({ type: z.literal("no_side_effects"), ...Why }),
  /** No call with an argument outside the caller's scope went through. */
  z.object({ type: z.literal("scope_respected"), ...Why }),
  /** The output flags the case for a person (see SuiteSpec.flag). */
  z.object({ type: z.literal("flagged"), ...Why }),
  /** The output names a next owner, a due date and the condition that sends it back to a person. */
  z.object({ type: z.literal("completion"), ...Why }),
  /** A field of the executor's structured output (a routing outcome, a record status). Dotted path. */
  z.object({ type: z.literal("field"), path: z.string(), equals: z.unknown().optional(), oneOf: z.array(z.unknown()).optional(), ...Why }),
  /** Scored by a judge model against written criteria and, where there is one, the founder-approved reference. */
  z.object({ type: z.literal("judged"), criteria: z.string(), reference: z.string().optional(), ...Why }),
])
export type Assertion = z.infer<typeof Assertion>

export const Scope = z.object({ recipients: z.array(z.string()).default([]), properties: z.array(z.string()).default([]) })
export type Scope = z.infer<typeof Scope>

export const CaseSpec = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  title: z.string(),
  /** A free tag: scheduling, confirmation, content, prompt-injection, … Reports group by it. */
  category: z.string().default("general"),
  /** A full task (the default), or one line of the daily brief, which the completion rule does not cover. */
  kind: z.enum(["task", "brief-item"]).default("task"),
  /** Who wrote the case. */
  author: z.string().optional(),
  /** Where it came from: a run, a log line, a founder ruling. */
  source: z.string().optional(),
  input: z.object({
    /** What the caller asks. */
    request: z.string(),
    /** Inbound messages. Untrusted: they are data to the executor, never instructions. */
    inbound: z.array(z.object({ from: z.string().optional(), subject: z.string().optional(), body: z.string() })).default([]),
    context: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    /** Prior recorded decisions the executor must respect (decision memory). */
    decisions: z.array(z.object({ id: z.string(), decided: z.string(), why: z.string().optional(), date: z.string().optional() })).default([]),
    caller: z.object({ id: z.string(), scope: Scope.default({ recipients: [], properties: [] }) }).optional(),
    /** The date the case is set on, so a due date can be judged. */
    today: z.string().optional(),
  }),
  /** Names from the suite's `tools` this case offers. Default: all of them. */
  tools: z.array(z.string()).optional(),
  expect: z.array(Assertion).min(1),
  /** The founder-approved reference output, where there is one. */
  reference: z.string().optional(),
  /** When the case comes from a run a person reviewed: their verdict, kept so a report can say whether it agrees. */
  reviewed: z.object({ label: z.enum(["approved unedited", "approved with edits", "rejected"]), by: z.string().optional(), words: z.string().optional() }).optional(),
})
export type CaseSpec = z.infer<typeof CaseSpec>

/**
 * Whether the completion rule covers a case (founder, 2026-11-10: new outputs only, a full task, not each one-line
 * daily-brief item; the 2026-10-01 runs are not scored on it).
 */
export function completionApplies(c: Pick<CaseSpec, "kind" | "input">, suite: Pick<SuiteSpec, "completion">): { applies: boolean; reason: string } {
  if (c.kind === "brief-item") return { applies: false, reason: "a one-line brief item" }
  if (c.input.today && c.input.today < suite.completion.since) return { applies: false, reason: `set on ${c.input.today}, before the rule (${suite.completion.since})` }
  return { applies: true, reason: "a full task" }
}

export interface Suite {
  spec: SuiteSpec
  cases: CaseSpec[]
  /** sha256 over suite.json and every case file, in path order: a result belongs to this version of the suite. */
  sha256: string
}

export type SuiteFiles = Record<string, string>

/** Parse a suite from its files (path → text). Every problem is named; a suite with any problem is refused. */
export function parseSuite(files: SuiteFiles): { ok: true; suite: Suite } | { ok: false; problems: string[] } {
  const problems: string[] = []
  const json = (path: string): unknown => {
    try { return JSON.parse(files[path]) } catch (e) { problems.push(`${path}: not JSON (${(e as Error).message})`); return undefined }
  }
  if (files["suite.json"] === undefined) return { ok: false, problems: ["no suite.json"] }
  const s = SuiteSpec.safeParse(json("suite.json"))
  if (!s.success) problems.push(...s.error.issues.map(i => `suite.json ${i.path.join(".")}: ${i.message}`))
  const cases: CaseSpec[] = []
  for (const path of Object.keys(files).filter(p => /^cases\/.+\.json$/.test(p)).sort()) {
    const raw = json(path)
    if (raw === undefined) continue
    const list = raw && typeof raw === "object" && Array.isArray((raw as { cases?: unknown }).cases) ? (raw as { cases: unknown[] }).cases : [raw]
    list.forEach((c, i) => {
      const r = CaseSpec.safeParse(c)
      if (r.success) cases.push(r.data)
      else problems.push(...r.error.issues.map(is => `${path}${list.length > 1 ? `[${i}]` : ""} ${is.path.join(".")}: ${is.message}`))
    })
  }
  if (!problems.length && s.success) {
    const seen = new Set<string>()
    const tools = new Set(s.data.tools.map(t => t.name))
    if (s.data.flag.tool && !tools.has(s.data.flag.tool)) problems.push(`suite.json flag.tool "${s.data.flag.tool}" is not in tools`)
    if (s.data.completion.tool && !tools.has(s.data.completion.tool)) problems.push(`suite.json completion.tool "${s.data.completion.tool}" is not in tools`)
    for (const p of s.data.flag.patterns) try { new RegExp(p, "i") } catch { problems.push(`suite.json flag pattern is not a regular expression: ${p}`) }
    for (const c of cases) {
      if (seen.has(c.id)) problems.push(`case id "${c.id}" appears twice`)
      seen.add(c.id)
      for (const t of c.tools ?? []) if (!tools.has(t)) problems.push(`case ${c.id}: tool "${t}" is not in the suite's tools`)
      for (const a of c.expect) {
        if ("tool" in a && a.tool !== undefined && !tools.has(a.tool)) problems.push(`case ${c.id}: assertion names unknown tool "${a.tool}"`)
        if (a.type === "matches" || a.type === "not_matches") try { new RegExp(a.pattern, a.flags) } catch { problems.push(`case ${c.id}: bad pattern ${a.pattern}`) }
        if (a.type === "field" && a.equals === undefined && a.oneOf === undefined) problems.push(`case ${c.id}: field assertion on ${a.path} needs equals or oneOf`)
        if (a.type === "completion") {
          const ca = completionApplies(c, s.data)
          if (!ca.applies) problems.push(`case ${c.id}: the completion rule does not apply to it (${ca.reason}); remove the completion check`)
        }
      }
    }
    if (!cases.length) problems.push("the suite has no cases")
  }
  if (problems.length || !s.success) return { ok: false, problems }
  return { ok: true, suite: { spec: s.data, cases, sha256: filesSha256(files) } }
}

export function filesSha256(files: Record<string, string>): string {
  const h = createHash("sha256")
  for (const p of Object.keys(files).sort()) h.update(`${p}\n${Buffer.byteLength(files[p])}\n`).update(files[p]).update("\n")
  return h.digest("hex")
}

/** Read a suite folder from disk: suite.json and cases/*.json only. */
export async function readSuiteFolder(dir: string): Promise<SuiteFiles> {
  const { readdir, readFile } = await import("node:fs/promises")
  const { join } = await import("node:path")
  const files: SuiteFiles = { "suite.json": await readFile(join(dir, "suite.json"), "utf8") }
  let names: string[] = []
  try { names = await readdir(join(dir, "cases")) } catch { /* no cases folder: parseSuite reports it */ }
  for (const n of names.filter(n => n.endsWith(".json")).sort()) files[`cases/${n}`] = await readFile(join(dir, "cases", n), "utf8")
  return files
}

/** Load and parse, throwing with every problem named. */
export async function loadSuite(dir: string): Promise<Suite> {
  const r = parseSuite(await readSuiteFolder(dir))
  if (!r.ok) throw new Error(`Suite refused (${dir}):\n- ${r.problems.join("\n- ")}`)
  return r.suite
}
