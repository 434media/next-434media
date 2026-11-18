/**
 * One Ask panel turn (V1 item 4, Ask panel slice 1): a question in, an answer out, with any edits it applied (each with
 * an Undo) and any stage changes it proposed (each with a hash-bound Confirm).
 *
 * In order, refusing at the first that fails:
 *  1. money and sends are refused before anything else, with a link (lib/ask/policy.ts classifyAsk), at no cost;
 *  2. the switch (lib/agent/controls.ts askOn), then the person's permission (askPermitted), then the month's spend
 *     cap (lib/ask/limits.ts), then today's turn cap;
 *  3. the founder's pin of `admin-ask` and the skill at it (fingerprint checked by the loader);
 *  4. a task in the ledger, requested by the person (`requestedBy`), so cost lands per task and the turn is on record;
 *  5. the run on the engine (lib/engine/run.ts), at the `approval` level under the catalog's ceiling, with exactly the
 *     tools the connector registry offers this person (lib/connector-434/tools.ts toolsFor). A ceiling that does not
 *     admit the write tools refuses the turn rather than running without them.
 *
 * Everything outside is injected (`AskDeps`), so the tests run on an invented skill, a scripted model and in-memory
 * stores.
 */
import { tool, type LanguageModel, type ToolSet } from "ai"
import { z } from "zod"
import { askOn, type AgentControls } from "../agent/controls"
import { newTask } from "../agent/ledger"
import { checkBudget, createTask, step, type AgentDb } from "../agent/ledger-server"
import type { SkillPin } from "../agent/intake"
import { RunRefused, startSkillRun } from "../engine/run"
import type { SkillFiles } from "../skills/loader"
import { ASK_SKILL, toolsFor } from "../connector-434/tools"
import { AskRefused, applyTaskEdit, recordTriage, TASK_STATUSES, type TaskPatch } from "./edits"
import {
  ASK_DAILY_TURNS,
  ASK_DECLARATIONS,
  ASK_MAX_OUTPUT_TOKENS,
  ASK_MAX_STEPS,
  ASK_OBJECTIVE,
  ASK_TURN_BUDGET_USD,
  ASK_WORKFLOW,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_STAGES,
  PERSON_STAGES,
  UNDO_WINDOW_MS,
  classifyAsk,
  proposalHash,
  renderAskPrompt,
  stageMoveProblem,
  type AskMessage,
  type AskRefusal,
  type StageProposal,
} from "./policy"
import { ASK_MODEL, askCapMessage, monthStartOf } from "./limits"

/** Writes one turn may make. A request for more is done in more turns, each with its own Undo. */
export const ASK_EDITS_PER_TURN = 5

export interface AskPerson {
  email: string
  role: string
  founder: boolean
  /** The ledger's actor ("founder" or "member:<id>"), or null when the person has no roster id. */
  actor: string | null
  /** askPermitted's answer for this person. */
  permitted: boolean
}

export type TriageDecisionValue = "promote" | "save" | "dismiss"

/** The admin's data, read and written as this person (their view filter and section rules). */
export interface AskData {
  context(): Promise<unknown>
  waiting(): Promise<unknown>
  find(query: string, kinds: FindKind[]): Promise<unknown>
  /** Triage through the core service, as this person. Returns the activity id the undo names. */
  triage(activityId: string, decision: TriageDecisionValue): Promise<{ activityId: string; label: string }>
  /** The record a stage change would move, as this person may see it; null when they cannot. */
  stageTarget(kind: StageProposal["kind"], id: string): Promise<{ name: string; from: string | null; revision: string } | null>
}

export const FIND_KINDS = ["people", "organizations", "opportunities", "tasks"] as const
export type FindKind = (typeof FIND_KINDS)[number]

export interface AskDeps {
  db: AgentDb
  controls: () => Promise<AgentControls>
  pin: () => Promise<SkillPin | null>
  skillAt: (commit: string) => Promise<SkillFiles>
  /** Ask turns this actor started today (UTC). Throwing refuses the turn. */
  turnsToday: (actor: string, day: string) => Promise<number>
  /** Ask's spend, in US dollars, since `monthStart` (all people). Throwing refuses the turn. */
  monthSpend: (monthStart: string) => Promise<number>
  /** The monthly cap in force (lib/ask/limits.ts askMonthlyCapUsd). */
  monthlyCapUsd: number
  taskSpend: (root: string) => Promise<number>
  model: (slug: string) => LanguageModel
  data: AskData
  now: () => string
  newId: () => string
}

export interface AskEdit {
  kind: "task" | "triage"
  /** What Undo names: the `record_edit` Activity for a task, the arrival for a triage. */
  id: string
  label: string
  undoUntil: string
}

export interface AskProposal extends StageProposal {
  hash: string
  label: string
}

export type AskOutcome =
  | { ok: true; taskId: string; answer: string; edits: AskEdit[]; proposals: AskProposal[]; truncated?: boolean }
  | { ok: false; code: string; message: string; link?: AskRefusal["link"] }

const OFF_LINK = { href: "/admin/agents", label: "Open Agents" }

export async function runAskTurn(input: { question: string; history: AskMessage[]; page?: string }, person: AskPerson, deps: AskDeps): Promise<AskOutcome> {
  const question = input.question.trim()
  if (!question) return { ok: false, code: "empty", message: "Ask a question." }
  const refusal = classifyAsk(question)
  if (refusal) return { ok: false, code: `refused-${refusal.kind}`, message: refusal.message, link: refusal.link }

  if (!askOn(await deps.controls())) return { ok: false, code: "off", message: "Ask is switched off.", ...(person.founder ? { link: OFF_LINK } : {}) }
  if (!person.permitted || !person.actor) return { ok: false, code: "not-permitted", message: "Ask isn't turned on for you. The founder grants it." }
  const actor = person.actor
  const caller = { email: person.email, role: person.role, skills: [ASK_SKILL] }
  const offered = toolsFor(caller).map((t) => t.name)

  const now = deps.now()
  // The month's cap, before anything is created or called: at or over it, nothing runs and nothing is spent.
  try {
    if ((await deps.monthSpend(monthStartOf(now))) >= deps.monthlyCapUsd) return { ok: false, code: "monthly-cap", message: askCapMessage(deps.monthlyCapUsd), ...(person.founder ? { link: OFF_LINK } : {}) }
  } catch {
    return { ok: false, code: "cap-unreadable", message: "This month's Ask spend could not be checked, so nothing ran. Try again." }
  }
  try {
    if ((await deps.turnsToday(actor, now.slice(0, 10))) >= ASK_DAILY_TURNS) return { ok: false, code: "daily-cap", message: `That's ${ASK_DAILY_TURNS} questions today, the daily limit. It resets at midnight UTC.` }
  } catch {
    return { ok: false, code: "cap-unreadable", message: "Today's limit could not be checked, so nothing ran. Try again." }
  }

  const pin = await deps.pin()
  if (!pin || pin.skill !== ASK_SKILL || !/^[a-f0-9]{40}$/.test(pin.commit) || !/^[a-f0-9]{64}$/.test(pin.sha256)) {
    return { ok: false, code: "not-pinned", message: "The Ask skill isn't pinned yet.", ...(person.founder ? { link: OFF_LINK } : {}) }
  }
  let files: SkillFiles
  try {
    files = await deps.skillAt(pin.commit)
  } catch {
    return { ok: false, code: "skill-unreadable", message: "The Ask skill could not be read. Nothing ran." }
  }

  // The turn's task: on record before any model call, so its cost and every change it makes are attributed.
  const uid = deps.newId()
  const taskId = `ask-${uid}`
  await createTask(
    deps.db,
    newTask({ id: taskId, property: "434", objective: ASK_OBJECTIVE, workflow: ASK_WORKFLOW, budgetUsd: ASK_TURN_BUDGET_USD, lineage: { event: `ask:${uid}` }, requestedBy: actor, pins: { skill: pin.sha256, commit: pin.commit, catalog: pin.catalogSha256 }, now }),
    actor,
    now,
  )
  const task = (await step(deps.db, { taskId, at: deps.now(), decide: () => ({ fields: { kind: "run_started", actor: `skill:${ASK_SKILL}`, refs: { run: taskId } }, to: "running" }) })).task
  const fail = async (code: string, message: string): Promise<AskOutcome> => {
    try {
      await step(deps.db, { taskId, at: deps.now(), decide: () => ({ fields: { kind: "run_refused", actor: "system", reasonCode: code }, to: "failed" }) })
    } catch (e) {
      console.error(`[ask] could not record the refusal for ${taskId}:`, e instanceof Error ? e.message : e)
    }
    return { ok: false, code, message }
  }

  const budget = await checkBudget(deps.db, task, deps.taskSpend)
  if (!budget.ok) return fail(budget.code, "The turn's budget could not be confirmed, so nothing ran.")

  const edits: AskEdit[] = []
  const proposals: AskProposal[] = []
  const tools = askTools({ person, actor, taskId, deps, edits, proposals })
  const runTools: ToolSet = Object.fromEntries(Object.entries(tools).filter(([name]) => offered.includes(name)))

  let answer = ""
  let truncated = false
  let costUsd: number | undefined
  try {
    const run = startSkillRun({
      skill: { files, folder: ASK_SKILL, sha256: pin.sha256 },
      level: "approval",
      ceiling: pin.ceiling as never,
      tools: runTools,
      declarations: ASK_DECLARATIONS,
      // Always Haiku (lib/ask/limits.ts), whatever the pin or the catalog names: the founder's cost decision.
      model: deps.model(ASK_MODEL),
      task: { task: taskId, kind: `skill:${ASK_SKILL}`, property: "434" },
      maxSteps: ASK_MAX_STEPS,
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
      providerOptions: { anthropic: { output_config: { effort: "low" } } },
    })
    if (run.refused.length) return fail("tools-refused", "Ask is not set up to make changes at its current level. Nothing ran.")
    const out = await run.generate(renderAskPrompt({ question, history: input.history, today: now.slice(0, 10), page: input.page, founder: person.founder }))
    answer = out.text.trim()
    truncated = out.finishReason === "length"
    costUsd = gatewayCost(out.steps)
  } catch (e) {
    if (e instanceof RunRefused) return fail("run-refused", "Ask could not start. Nothing ran.")
    console.error(`[ask] ${taskId}:`, e instanceof Error ? e.message : e)
    return fail("run-error", edits.length ? "Ask stopped partway. The changes it made are listed with their Undo." : "Ask stopped before answering. Try again.")
  }

  await step(deps.db, { taskId, at: deps.now(), decide: () => ({ fields: { kind: "run_finished", actor: `skill:${ASK_SKILL}`, ...(costUsd !== undefined ? { costUsd } : {}), ...(truncated ? { reasonCode: "truncated" } : {}) }, to: "done" }) })
  return { ok: true, taskId, answer: answer || (edits.length || proposals.length ? "Done." : "I don't have an answer for that."), edits, proposals, ...(truncated ? { truncated } : {}) }
}

/** The run's tools, one per registry entry. Each returns `{ ok: false, error }` to the model instead of throwing. */
function askTools(c: { person: AskPerson; actor: string; taskId: string; deps: AskDeps; edits: AskEdit[]; proposals: AskProposal[] }): ToolSet {
  const { deps, edits, proposals } = c
  const guard = async <T,>(fn: () => Promise<T>) => {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof AskRefused) return { ok: false, error: e.message }
      const status = (e as { status?: unknown })?.status
      if (typeof status === "number" && status < 500 && e instanceof Error) return { ok: false, error: e.message }
      console.error(`[ask] tool error in ${c.taskId}:`, e instanceof Error ? e.message : e)
      return { ok: false, error: "That could not be done." }
    }
  }
  const undoUntil = () => new Date(Date.parse(deps.now()) + UNDO_WINDOW_MS).toISOString()
  const writesLeft = () => {
    if (edits.length >= ASK_EDITS_PER_TURN) throw new AskRefused(`One question makes at most ${ASK_EDITS_PER_TURN} changes. Ask again for the rest.`)
  }
  return {
    get_434_context: tool({
      description: "434 MEDIA's approved company definition and descriptors, the motto, its offers by name, its properties and the brand voice. Public, brand-level content, with no figures.",
      inputSchema: z.object({}),
      execute: () => guard(() => deps.data.context()),
    }),
    whats_waiting: tool({
      description: "What is waiting on the person asking: drafts waiting for a decision and untriaged inbox arrivals they may see.",
      inputSchema: z.object({}),
      execute: () => guard(() => deps.data.waiting()),
    }),
    find: tool({
      description: "Find people, organizations, opportunities and tasks by words in a name, company, email, title or task title. Only what the person asking may see.",
      inputSchema: z.object({
        query: z.string().min(1).max(200),
        kinds: z.array(z.enum(FIND_KINDS)).optional().describe("which kinds of record to search; all when omitted"),
      }),
      execute: ({ query, kinds }) => guard(() => deps.data.find(query, kinds?.length ? kinds : [...FIND_KINDS])),
    }),
    triage_arrival: tool({
      description: "Decide one untriaged inbox arrival by its activity id: promote (make a lead), save (keep as a contact) or dismiss. Applies at once with a two-minute Undo.",
      inputSchema: z.object({ activity_id: z.string().min(1).max(200), decision: z.enum(["promote", "save", "dismiss"]) }),
      execute: ({ activity_id, decision }) =>
        guard(async () => {
          writesLeft()
          const done = await deps.data.triage(activity_id, decision)
          await recordTriage(deps.db, { turnTaskId: c.taskId, activityId: done.activityId, actor: c.actor, now: deps.now(), decision })
          edits.push({ kind: "triage", id: done.activityId, label: done.label, undoUntil: undoUntil() })
          return { ok: true, applied: done.label, undo: "The person has Undo for two minutes." }
        }),
    }),
    update_task: tool({
      description: "Change one task's due date (YYYY-MM-DD), status or assignee, by its task id. Applies at once with a two-minute Undo.",
      inputSchema: z.object({
        task_id: z.string().min(1).max(200),
        due_date: z.string().optional(),
        status: z.enum(TASK_STATUSES).optional(),
        assigned_to: z.string().max(100).optional(),
      }),
      execute: ({ task_id, ...patch }) =>
        guard(async () => {
          writesLeft()
          const applied = await applyTaskEdit({ db: deps.db, turnTaskId: c.taskId, n: edits.length + 1, taskId: task_id, patch: patch as TaskPatch, by: c.person.email, actor: c.actor, now: deps.now() })
          const label = `${applied.title}: ${applied.changes.map((x) => `${x.field.replace(/_/g, " ")} ${fmt(x.before)} → ${fmt(x.after)}`).join(", ")}`
          edits.push({ kind: "task", id: applied.activityId, label, undoUntil: undoUntil() })
          return { ok: true, applied: label, undo: "The person has Undo for two minutes." }
        }),
    }),
    propose_stage_change: tool({
      description: "Propose moving an opportunity's stage (discovery, proposal, closed_won, closed_lost) or a person's lifecycle stage (contact, lead, customer). Changes nothing: the person sees a Confirm card.",
      inputSchema: z.object({ kind: z.enum(["opportunity", "person"]), id: z.string().min(1).max(200), to: z.enum([...OPPORTUNITY_STAGES, ...PERSON_STAGES]) }),
      execute: ({ kind, id, to }) =>
        guard(async () => {
          const target = await deps.data.stageTarget(kind, id)
          if (!target) return { ok: false, error: "That record was not found." }
          const problem = stageMoveProblem(kind, target.from, to)
          if (problem) return { ok: false, error: problem }
          const p: StageProposal = { kind, id, name: target.name, from: target.from, to, revision: target.revision }
          const name = (v: string | null) => (v === null ? "none" : kind === "opportunity" ? OPPORTUNITY_STAGE_LABEL[v as keyof typeof OPPORTUNITY_STAGE_LABEL] ?? v : v)
          proposals.push({ ...p, hash: proposalHash(p), label: `${target.name}: ${name(target.from)} → ${name(to)}` })
          return { ok: true, proposed: "A Confirm card is shown to the person. Nothing has changed yet; say so." }
        }),
    }),
  }
}

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "none" : String(v).replace(/_/g, " "))

/** The Gateway's billed cost, summed over the run's steps; undefined when none reported one. */
function gatewayCost(steps: { providerMetadata?: unknown }[]): number | undefined {
  let total = 0, seen = false
  for (const s of steps) {
    const c = (s.providerMetadata as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost
    const n = typeof c === "string" ? Number(c) : typeof c === "number" ? c : NaN
    if (Number.isFinite(n)) { total += n; seen = true }
  }
  return seen ? total : undefined
}
