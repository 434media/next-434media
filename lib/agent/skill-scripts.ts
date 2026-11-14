/**
 * Runs a skill's own scripts (434 build sequence V1 item 4, the proof slice; founder decision D2, 2026-11-14: "approve
 * ... the sandbox package").
 *
 * A Vercel function has no shell, and intake's Steps 4 and 5 are Python scripts (`intake_gate.py`, `scan_reply.py`)
 * whose comparison SKILL.md forbids redoing by hand. So the run gets one tool, `run_skill_script`, that runs the
 * pinned script in a Vercel Sandbox (a Firecracker microVM):
 *  - the sandbox holds a copy of the pinned skill folder and nothing else: no secret, no environment variable, no
 *    repository;
 *  - its network is `deny-all`, so a script cannot reach anything;
 *  - only a file under the folder's `scripts/` can be run, by `python3`, with arguments passed as a list (never a
 *    shell line); the run's input is written to a file the arguments can name;
 *  - one sandbox per run, created on the first call, not persistent, stopped when the run ends, and capped in time.
 *
 * The tool's class is `read`: it computes and returns JSON; it changes nothing. Its output is data for the model, as
 * every tool result is.
 *
 * The comparison logic stays in 434-context and runs exactly as tested there. Nothing is ported into this repository.
 */
import { tool } from "ai"
import { z } from "zod"
import type { SkillFiles } from "../skills/loader"
import type { ToolDeclaration } from "../engine/tool-policy"

export const SCRIPT_TOOL = "run_skill_script"
export const SCRIPT_TOOL_DECLARATION: ToolDeclaration = { class: "read" }

/** Where the folder is written inside the sandbox, and the one input file. */
const ROOT = "/vercel/sandbox/skill"
const INPUT = "input.txt"
const LIMITS = { args: 12, argChars: 200, inputChars: 200_000, outputChars: 60_000, commandMs: 60_000, sandboxMs: 10 * 60_000 } as const

/** What the tool needs of a sandbox: the subset of @vercel/sandbox's Sandbox it uses. Injectable for tests. */
export interface ScriptSandbox {
  writeFiles(files: { path: string; content: string | Uint8Array }[]): Promise<unknown>
  runCommand(params: { cmd: string; args: string[]; cwd: string }): Promise<{ exitCode: number; stdout(): Promise<string>; stderr(): Promise<string> }>
  stop(): Promise<unknown>
}

export type SandboxFactory = () => Promise<ScriptSandbox>

/** The live sandbox: Python 3.13, no network, not persistent, a hard time cap. Auth is the function's OIDC token. */
export const vercelSandbox: SandboxFactory = async () => {
  const { Sandbox } = await import("@vercel/sandbox")
  const sandbox = await Sandbox.create({ runtime: "python3.13", networkPolicy: "deny-all", persistent: false, timeout: LIMITS.sandboxMs })
  return {
    writeFiles: (files) => sandbox.writeFiles(files),
    runCommand: async ({ cmd, args, cwd }) => {
      const r = await sandbox.runCommand({ cmd, args, cwd, signal: AbortSignal.timeout(LIMITS.commandMs) })
      return { exitCode: r.exitCode, stdout: () => r.stdout(), stderr: () => r.stderr() }
    },
    stop: () => sandbox.stop(),
  }
}

/** Null when the script and arguments may run; otherwise why not. */
export function scriptRefusal(files: SkillFiles, script: string, args: string[]): string | null {
  if (!/^scripts\/[A-Za-z0-9_-]+\.py$/.test(script)) return "Only a Python file directly under scripts/ can be run."
  if (!(script in files)) return `No script ${script} in this skill.`
  if (args.length > LIMITS.args) return `At most ${LIMITS.args} arguments.`
  for (const a of args) {
    if (typeof a !== "string" || a.length > LIMITS.argChars) return "Each argument is a short string."
    if (/[\0\r\n]/.test(a)) return "An argument cannot contain a control character."
    if (a.startsWith("/") || a.split("/").includes("..")) return "An argument cannot name a path outside the skill folder."
  }
  return null
}

const clip = (s: string) => (s.length > LIMITS.outputChars ? `${s.slice(0, LIMITS.outputChars)}\n[cut at ${LIMITS.outputChars} characters]` : s)

/**
 * The tool, for one run, and a `close` the caller runs when the run ends (in `finally`). The sandbox is created on the
 * first call and reused for the rest of the run.
 */
export function skillScriptTool(files: SkillFiles, factory: SandboxFactory = vercelSandbox) {
  let box: Promise<ScriptSandbox> | null = null
  const calls: { script: string; exitCode: number | null }[] = []
  const open = () =>
    (box ??= (async () => {
      const sb = await factory()
      await sb.writeFiles(Object.entries(files).map(([path, content]) => ({ path: `${ROOT}/${path}`, content })))
      return sb
    })())

  const run_skill_script = tool({
    description:
      "Run one of this skill's scripts, exactly as its instructions say, and return what it prints. " +
      `Pass the script's path (e.g. scripts/intake_gate.py) and its arguments as a list. To give it input, put the text in "input" and name the file ${INPUT} in the arguments where the script expects a file. ` +
      "The script runs with no network, on the skill's own data.",
    inputSchema: z.object({
      script: z.string().describe("the script's path inside the skill, e.g. scripts/intake_gate.py"),
      args: z.array(z.string()).default([]).describe(`the arguments, one per item; use ${INPUT} to refer to the input`),
      input: z.string().optional().describe(`text written to ${INPUT} before the script runs (JSON, a reply to scan, ...)`),
    }),
    execute: async ({ script, args, input }) => {
      const why = scriptRefusal(files, script, args)
      if (why) return { ok: false, error: why }
      if (input !== undefined && input.length > LIMITS.inputChars) return { ok: false, error: `The input is over ${LIMITS.inputChars} characters.` }
      try {
        const sb = await open()
        await sb.writeFiles([{ path: `${ROOT}/${INPUT}`, content: input ?? "" }])
        const r = await sb.runCommand({ cmd: "python3", args: [script, ...args], cwd: ROOT })
        calls.push({ script, exitCode: r.exitCode })
        return { ok: r.exitCode === 0, exitCode: r.exitCode, stdout: clip(await r.stdout()), stderr: clip(await r.stderr()) }
      } catch (e) {
        calls.push({ script, exitCode: null })
        return { ok: false, error: `The script could not be run: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}` }
      }
    },
  })

  return {
    tool: run_skill_script,
    calls,
    async close() {
      if (!box) return
      try {
        await (await box).stop()
      } catch (e) {
        console.error("[agent:scripts] Stopping the sandbox failed:", e)
      }
    },
  }
}
