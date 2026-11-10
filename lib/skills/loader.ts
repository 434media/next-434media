/**
 * The thin SKILL.md loader (434 build sequence V1 item 2): it lets the engine (the AI SDK through the Gateway) run a skill
 * written to the Agent Skills format. The AI SDK does not load SKILL.md itself; its uploadSkill() only forwards a bundle
 * to Anthropic or OpenAI to run in their container, and the Skills API bundle stays a packaging format (ruling R9).
 *
 * What it does, and only this:
 *  - parses SKILL.md's frontmatter and body from a map of the skill folder's files, wherever they came from (a checkout,
 *    the GitHub API, a build-time copy); it never fetches anything;
 *  - checks it against the Agent Skills specification (agentskills.io/specification, read 2026-11-10) and the size limits
 *    of the Skill Building Standard §7; a skill that fails is refused, never run on a guess;
 *  - fingerprints the folder (sha256 over every file), and refuses to run when the caller pins a different fingerprint;
 *  - runs it as a ToolLoopAgent: the body is the instructions, the folder's other text files are readable through one
 *    read_skill_file tool confined to the folder, and of the caller's tools only those the skill names in
 *    `allowed-tools` are offered. No `allowed-tools`, no caller tools. Scripts are listed, never run: a function on
 *    Vercel has no shell, and a skill that needs one runs elsewhere (engine comparison, "What would change it").
 *
 * It holds no skill, rule or value of its own. Business skills live in 434-context and never in this public repository
 * (Skill Building Standard §2); the tests run on an invented skill.
 */
import { createHash } from "node:crypto"
import { ToolLoopAgent, isStepCount, tool, type LanguageModel, type ToolSet } from "ai"
import { z } from "zod"

/** A skill folder as relative path → UTF-8 text. Binary files are left out by whoever builds the map. */
export type SkillFiles = Record<string, string>

export interface Skill {
  name: string
  description: string
  license?: string
  compatibility?: string
  metadata: Record<string, string>
  /** `allowed-tools`, split on whitespace. Undefined when the field is absent. */
  allowedTools?: string[]
  /** SKILL.md after the frontmatter. */
  body: string
  /** Readable files other than SKILL.md and scripts, sorted. */
  resources: string[]
  /** Files under scripts/, sorted. Listed for the reader; the engine never executes them. */
  scripts: string[]
  /** sha256 (hex) over every file's path and content, in path order. */
  sha256: string
}

export type ParseResult = { ok: true; skill: Skill } | { ok: false; problems: string[] }

// Agent Skills specification: name 1–64 of a-z 0-9 and hyphens, no leading, trailing or doubled hyphen; description
// 1–1024; compatibility at most 500. Skill Building Standard §7: SKILL.md body under 500 lines, 20 KB cap.
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const LIMITS = { name: 64, description: 1024, compatibility: 500, bodyLines: 500, skillMdBytes: 20 * 1024 } as const
const KNOWN = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"])

/**
 * The frontmatter subset the specification uses: `key: value` scalars (plain or quoted), `>` and `|` block scalars, and
 * one level of `metadata:` mapping. Anything else is reported as a problem rather than guessed at.
 */
export function parseFrontmatter(text: string): { fields: Record<string, string | Record<string, string>>; body: string; problems: string[] } {
  const problems: string[] = []
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n")
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src)
  if (!m) return { fields: {}, body: src, problems: ["SKILL.md must start with YAML frontmatter between --- lines"] }
  const fields: Record<string, string | Record<string, string>> = {}
  const lines = m[1].split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || /^\s*#/.test(line)) continue
    const kv = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/.exec(line)
    if (!kv) { problems.push(`frontmatter line ${i + 2} is not "key: value": ${line.slice(0, 60)}`); continue }
    const [, key, raw = ""] = kv
    if (key in fields) problems.push(`frontmatter key "${key}" appears twice`)
    const value = raw.trim()
    if (value === "" ) {
      // A nested mapping (metadata), one level deep.
      const map: Record<string, string> = {}
      while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1])) {
        const sub = /^[ \t]+([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(lines[++i])
        if (!sub) { problems.push(`frontmatter line ${i + 2} under "${key}" is not "key: value"`); continue }
        map[sub[1]] = scalar(sub[2], problems, i + 2)
      }
      fields[key] = map
    } else if (value === ">" || value === "|" || value === ">-" || value === "|-") {
      const block: string[] = []
      while (i + 1 < lines.length && (/^[ \t]+/.test(lines[i + 1]) || lines[i + 1] === "")) block.push(lines[++i].trim())
      fields[key] = (value.startsWith(">") ? block.join(" ").replace(/\s+/g, " ") : block.join("\n")).trim()
    } else {
      fields[key] = scalar(value, problems, i + 2)
    }
  }
  return { fields, body: src.slice(m[0].length), problems }
}

function scalar(raw: string, problems: string[], line: number): string {
  const v = raw.trim()
  if (/^"([^"\\]|\\.)*"$/.test(v)) {
    try { return JSON.parse(v) as string } catch { problems.push(`frontmatter line ${line}: bad double-quoted string`); return v }
  }
  if (/^'([^']|'')*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'")
  if (/^[[{]/.test(v)) problems.push(`frontmatter line ${line}: flow collections are not supported`)
  return v.replace(/\s+#.*$/, "")
}

/** Parse and check a skill folder. `folder` is its directory name, which `name` must match. */
export function parseSkill(files: SkillFiles, opts: { folder?: string } = {}): ParseResult {
  const md = files["SKILL.md"]
  if (md === undefined) return { ok: false, problems: ["no SKILL.md in the folder"] }
  const { fields, body, problems } = parseFrontmatter(md)
  const str = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string) : undefined)
  for (const k of Object.keys(fields)) if (!KNOWN.has(k)) problems.push(`unknown frontmatter field "${k}"`)
  for (const k of ["name", "description", "license", "compatibility", "allowed-tools"]) if (fields[k] !== undefined && typeof fields[k] !== "string") problems.push(`"${k}" must be a string`)
  if (fields.metadata !== undefined && typeof fields.metadata !== "object") problems.push(`"metadata" must be a mapping`)

  const name = str("name") ?? ""
  if (!name) problems.push(`"name" is required`)
  else {
    if (name.length > LIMITS.name || !NAME.test(name)) problems.push(`"name" must be 1–${LIMITS.name} lowercase letters, digits and single hyphens, not starting or ending with one`)
    if (opts.folder !== undefined && opts.folder !== name) problems.push(`"name" (${name}) must match its folder (${opts.folder})`)
  }
  const description = str("description") ?? ""
  if (!description.trim()) problems.push(`"description" is required`)
  else if (description.length > LIMITS.description) problems.push(`"description" is ${description.length} characters; the limit is ${LIMITS.description}`)
  const compatibility = str("compatibility")
  if (compatibility && compatibility.length > LIMITS.compatibility) problems.push(`"compatibility" is over ${LIMITS.compatibility} characters`)

  if (!body.trim()) problems.push("SKILL.md has no instructions after the frontmatter")
  if (body.split("\n").length > LIMITS.bodyLines) problems.push(`SKILL.md body is over ${LIMITS.bodyLines} lines`)
  if (Buffer.byteLength(md, "utf8") > LIMITS.skillMdBytes) problems.push(`SKILL.md is over the ${LIMITS.skillMdBytes / 1024} KB cap`)
  for (const p of Object.keys(files)) if (!safePath(p)) problems.push(`unsafe file path in the folder: ${p}`)

  if (problems.length) return { ok: false, problems }
  const paths = Object.keys(files).sort()
  const allowed = str("allowed-tools")
  return {
    ok: true,
    skill: {
      name,
      description,
      ...(str("license") ? { license: str("license") } : {}),
      ...(compatibility ? { compatibility } : {}),
      metadata: (fields.metadata as Record<string, string> | undefined) ?? {},
      ...(allowed !== undefined ? { allowedTools: allowed.split(/\s+/).filter(Boolean) } : {}),
      body: body.trim(),
      resources: paths.filter(p => p !== "SKILL.md" && !p.startsWith("scripts/")),
      scripts: paths.filter(p => p.startsWith("scripts/")),
      sha256: fingerprint(files),
    },
  }
}

/** A relative path inside the folder: no absolute path, no "..", no backslash, no empty segment. */
function safePath(p: string): boolean {
  return !!p && !p.startsWith("/") && !p.includes("\\") && !p.includes("\0") && p.split("/").every(s => s !== "" && s !== "." && s !== "..")
}

/** sha256 over each file's path and content in path order, length-prefixed so no two folders collide. */
export function fingerprint(files: SkillFiles): string {
  const h = createHash("sha256")
  for (const p of Object.keys(files).sort()) {
    const body = Buffer.from(files[p], "utf8")
    h.update(`${Buffer.byteLength(p)}:${p}\n${body.length}:`).update(body).update("\n")
  }
  return h.digest("hex")
}

/** Read a skill folder from disk into a SkillFiles map: text files only, bounded, symlinks not followed. */
export async function readSkillFolder(dir: string, opts: { maxFiles?: number; maxBytes?: number } = {}): Promise<SkillFiles> {
  const { readdir, readFile, lstat } = await import("node:fs/promises")
  const { join, relative, sep } = await import("node:path")
  const maxFiles = opts.maxFiles ?? 500, maxBytes = opts.maxBytes ?? 30 * 1024 * 1024 // Skills API bundle: under 30 MB (§7)
  const out: SkillFiles = {}
  let total = 0
  const walk = async (d: string) => {
    for (const entry of (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(d, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) { await walk(full); continue }
      if (!entry.isFile()) continue
      const size = (await lstat(full)).size
      total += size
      if (total > maxBytes) throw new Error(`skill folder ${dir} is over ${maxBytes} bytes`)
      const buf = await readFile(full)
      if (buf.includes(0)) continue // binary (an image, an archive): not text the model can read
      if (Object.keys(out).length >= maxFiles) throw new Error(`skill folder ${dir} has over ${maxFiles} files`)
      out[relative(dir, full).split(sep).join("/")] = buf.toString("utf8")
    }
  }
  await walk(dir)
  return out
}

/** The agent's instructions: the skill's body, then where its other files are and how to read them. */
export function skillInstructions(skill: Skill): string {
  const files = skill.resources.length
    ? `\n\n---\nThis skill's other files can be read with the read_skill_file tool, by these paths:\n${skill.resources.map(p => `- ${p}`).join("\n")}`
    : ""
  const scripts = skill.scripts.length
    ? `\n\nThe skill's scripts (${skill.scripts.join(", ")}) cannot be run here. Where a step needs one, stop and say which step and which script.`
    : ""
  return `${skill.body}${files}${scripts}`
}

/**
 * The tools a run gets: read_skill_file over the folder, plus those of `available` that the skill names in
 * `allowed-tools`. A named tool the caller did not offer is reported in `missing`; nothing else is added.
 */
export function skillTools(skill: Skill, files: SkillFiles, available: ToolSet = {}): { tools: ToolSet; missing: string[] } {
  const readable = new Set(skill.resources)
  const read_skill_file = tool({
    description: `Read one of the ${skill.name} skill's files by its path, as listed in the instructions.`,
    inputSchema: z.object({ path: z.string().describe("the file's path inside the skill, e.g. references/sop.md") }),
    execute: async ({ path }) => (readable.has(path) ? { path, content: files[path] } : { path, error: "No such file in this skill. Use a path from the list in the instructions." }),
  })
  const named = skill.allowedTools ?? []
  const tools: ToolSet = { read_skill_file }
  const missing: string[] = []
  for (const n of named) {
    if (n === "read_skill_file") continue
    if (Object.prototype.hasOwnProperty.call(available, n)) tools[n] = available[n]
    else missing.push(n)
  }
  return { tools, missing }
}

export interface SkillAgentOptions {
  files: SkillFiles
  /** The folder's name, which the skill's `name` must match. */
  folder?: string
  /** Refuse to run unless the folder's fingerprint is this one (a skill definition the runtime has not been told of). */
  expectedSha256?: string
  model: LanguageModel
  /** Tools the caller offers; the skill gets only those its `allowed-tools` names. */
  tools?: ToolSet
  /** Step cap for the loop. Default 20, the AI SDK's own default. */
  maxSteps?: number
  /** Output cap per step. Claude 5 thinks by default and this counts the thinking too (CLAUDE.md, "The token trap"). */
  maxOutputTokens?: number
  providerOptions?: Record<string, Record<string, unknown>>
}

/**
 * Load a skill and return an agent that runs it. Throws, with every problem named, when the skill fails its checks, its
 * fingerprint is not the pinned one, or it names a tool the caller did not offer. The Gateway's automatic caching is
 * on: an agent loop re-sends the skill's instructions every step, so each step after the first reads them from cache.
 */
export function skillAgent(opts: SkillAgentOptions): { agent: ToolLoopAgent<never, ToolSet>; skill: Skill } {
  const parsed = parseSkill(opts.files, { folder: opts.folder })
  if (!parsed.ok) throw new Error(`Skill refused: ${parsed.problems.join("; ")}`)
  const skill = parsed.skill
  if (opts.expectedSha256 && opts.expectedSha256 !== skill.sha256) throw new Error(`Skill refused: ${skill.name} is not the pinned version (fingerprint ${skill.sha256.slice(0, 12)}, expected ${opts.expectedSha256.slice(0, 12)})`)
  const { tools, missing } = skillTools(skill, opts.files, opts.tools)
  if (missing.length) throw new Error(`Skill refused: ${skill.name} needs tools this run does not offer: ${missing.join(", ")}`)
  const gateway = { ...(opts.providerOptions?.gateway ?? {}), caching: "auto" }
  const agent = new ToolLoopAgent({
    model: opts.model,
    instructions: skillInstructions(skill),
    tools,
    stopWhen: isStepCount(opts.maxSteps ?? 20),
    ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
    providerOptions: { ...(opts.providerOptions ?? {}), gateway } as never,
  })
  return { agent, skill }
}
