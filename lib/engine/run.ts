/**
 * The one way a business skill run starts on the engine (434 build sequence V1 item 2, Foundation A). It puts the
 * three run-start controls in front of the loader, and refuses to start unless all three hold:
 *  1. **Protected config:** the skill folder's fingerprint and every rule file the run follows are pinned, and match;
 *     none is blank or a template (lib/engine/protected-config.ts).
 *  2. **Tool allow-list:** the skill's `allowed-tools`, then its autonomy level, the lower of the requested level and
 *     the catalog's ceiling; every tool must declare its class (lib/engine/tool-policy.ts). A draft run has no write,
 *     send or publish tool.
 *  3. **Cost per task:** the run executes inside its task (lib/engine/task-context.ts), so the guard records every
 *     model call against it and checks its property's budget (lib/engine/guard.ts).
 *
 * The model is checked against the allow-list by the guard on every call. No business run exists yet: Polí and the
 * proof slice (V1 item 4) are its first callers. The exam's executor runs the loader directly on mock tools.
 */
import type { LanguageModel, ToolSet } from "ai"
import { skillAgent, type SkillFiles } from "../skills/loader"
import { checkRunConfig } from "./protected-config"
import { withTask, type TaskContext } from "./task-context"
import type { AutonomyLevel, ToolDeclarations } from "./tool-policy"

export interface SkillRunOptions {
  skill: { files: SkillFiles; folder: string; sha256: string }
  /** Rule files the run follows besides the skill folder (a policy, a profile export), with their pinned sha256. */
  rules?: { files: Record<string, string>; pins: Record<string, string> }
  level: AutonomyLevel
  /** The skill's autonomy ceiling, from the catalog (03 Skills/skills-index.json). Required: no ceiling, no run. */
  ceiling: AutonomyLevel
  tools: ToolSet
  declarations: ToolDeclarations
  model: LanguageModel
  task: Omit<TaskContext, "skill">
  maxSteps?: number
  maxOutputTokens?: number
  providerOptions?: Record<string, Record<string, unknown>>
}

export class RunRefused extends Error {
  constructor(readonly problems: string[]) {
    super(`Run refused: ${problems.join("; ")}`)
    this.name = "RunRefused"
  }
}

export function startSkillRun(o: SkillRunOptions) {
  const problems: string[] = []
  if (!o.skill.sha256) problems.push("the skill's fingerprint is not pinned")
  if (!o.ceiling) problems.push("the skill has no autonomy ceiling")
  if (o.rules) {
    const check = checkRunConfig(o.rules.files, o.rules.pins)
    problems.push(...check.problems)
  }
  if (problems.length) throw new RunRefused(problems)
  let built
  try {
    built = skillAgent({
      files: o.skill.files,
      folder: o.skill.folder,
      expectedSha256: o.skill.sha256,
      model: o.model,
      tools: o.tools,
      autonomy: { level: o.level, ceiling: o.ceiling, declarations: o.declarations },
      ...(o.maxSteps ? { maxSteps: o.maxSteps } : {}),
      ...(o.maxOutputTokens ? { maxOutputTokens: o.maxOutputTokens } : {}),
      ...(o.providerOptions ? { providerOptions: o.providerOptions } : {}),
    })
  } catch (e) {
    throw new RunRefused([(e as Error).message])
  }
  const { agent, skill, level, refused } = built
  const ctx: TaskContext = { ...o.task, skill: skill.name }
  return {
    skill,
    level: level!,
    /** Tools the skill names that its level does not admit, with the reason; left out of the run. */
    refused,
    generate: (prompt: string) => withTask(ctx, () => agent.generate({ prompt })),
  }
}
