/**
 * Protected config by prevention, and the blank-config block (434 build sequence V1 item 2, Foundation A: "the runtime
 * cannot write rule files, policies or skill definitions, and their hashes are checked at run start. A blank-config
 * block: a run refuses to start on an empty rule file or one still holding a template").
 *
 * Prevention, in three parts:
 *  1. **No tool writes them.** PROTECTED_TARGETS names what a run may never write; the tool policy
 *     (lib/engine/tool-policy.ts) refuses any tool that declares one of them, whatever the level.
 *  2. **No path to them.** Skill definitions and policies live in 434-context, which the site holds no token to write
 *     (CLAUDE.md, "No backup token on the site"); brand profiles change only through Publish, which validates, and a
 *     signed-in person, never a run.
 *  3. **Checked at run start.** A run is given the files it will follow, with the sha256 each was released at
 *     (`pins`). checkRunConfig refuses the run when a file is missing, changed, blank or still a template.
 *
 * Pure: it reads nothing. The caller supplies the files and the pins.
 */
import { createHash } from "node:crypto"

/**
 * What a run never writes. Firestore collections by name; anything else by path prefix. `brand_profiles` is written
 * only by Publish and Restore (lib/firestore-brand-profiles.ts), signed in.
 */
export const PROTECTED_TARGETS = [
  "brand_profiles",
  "skills/",
  ".claude/",
  "03 Skills/",
  "06 Standards/",
  "00 Governing/",
  "CLAUDE.md",
  "AGENTS.md",
  "lib/engine/",
  "lib/skills/",
] as const

export function isProtectedTarget(target: string, list: readonly string[] = PROTECTED_TARGETS): boolean {
  const t = target.trim().replace(/^\/+/, "")
  return list.some((p) => (p.endsWith("/") ? t.startsWith(p) || t === p.slice(0, -1) : t === p || t.startsWith(`${p}/`)))
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/**
 * Marks of a file that is still a template. Each is something a finished rule file never carries:
 *  - an explicit template marker line (`TEMPLATE` or `<!-- TEMPLATE -->`), which a template file opens with;
 *  - "TODO"/"TBD"/"FILL IN" standing alone as a field's value.
 * Not marks: `{{schedule}}` and `{{unsubscribe}}` are merge tags finished outbound SOPs use on purpose, and
 * angle-bracket forms such as `<YYYY-MM-DD>` describe a format (both checked against 434-context's skills and
 * standards on 2026-11-11, which carry no mark).
 */
const TEMPLATE_MARKS: { re: RegExp; what: string }[] = [
  { re: /^\s*(?:<!--\s*)?TEMPLATE(?:\s*[:—-].*)?(?:\s*-->)?\s*$/m, what: "a TEMPLATE marker line" },
  { re: /^\s*(?:[-*]\s*)?[\w .-]{0,40}:\s*(?:TODO|TBD|FILL IN|REPLACE ME)\.?\s*$/im, what: "a TODO/TBD value" },
]

/** Why a file's text is blank or a template, or null when it is neither. */
export function blankOrTemplate(text: string): string | null {
  const body = text.replace(/^﻿/, "").replace(/^---\n[\s\S]*?\n---[ \t]*\n?/, "")
  const words = body.replace(/^#.*$/gm, "").replace(/<!--[\s\S]*?-->/g, "").trim()
  if (!words) return "blank (nothing beyond frontmatter, headings and comments)"
  for (const m of TEMPLATE_MARKS) if (m.re.test(body)) return `still a template (${m.what})`
  return null
}

export interface RunConfigCheck { ok: boolean; problems: string[] }

/**
 * The run-start check. `files` are the rule files the run will follow, by path; `pins` the sha256 each was released at.
 * Every pinned file must be present and unchanged, every file must be pinned, and none may be blank or a template.
 * An empty pin set is itself a refusal: a run with nothing pinned has nothing checked.
 */
export function checkRunConfig(files: Record<string, string>, pins: Record<string, string>): RunConfigCheck {
  const problems: string[] = []
  if (!Object.keys(pins).length) problems.push("no pins: a run must be given the sha256 of every rule file it follows")
  for (const [path, want] of Object.entries(pins)) {
    const text = files[path]
    if (text === undefined) { problems.push(`${path}: pinned but not supplied`); continue }
    const got = sha256(text)
    if (got !== want.toLowerCase()) problems.push(`${path}: changed since it was pinned (sha256 ${got.slice(0, 12)}, pinned ${want.slice(0, 12)})`)
  }
  for (const [path, text] of Object.entries(files)) {
    if (!(path in pins)) problems.push(`${path}: supplied but not pinned`)
    const why = blankOrTemplate(text)
    if (why) problems.push(`${path}: ${why}`)
  }
  return { ok: problems.length === 0, problems }
}
