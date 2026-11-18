/**
 * The Ask panel's Confirm (V1 item 4, Ask panel slice 1). A stage change is never made by the model: the run only
 * proposes it (lib/ask/run.ts propose_stage_change), and the person's Confirm carries it out here, only when the hash
 * they were shown still matches the record as it is now. A record changed since (another person moved the card, the
 * stage is no longer the one shown) makes the card stale, and nothing changes.
 *
 * The change goes through the existing paths (`apply`, wired in lib/ask/server.ts): an opportunity through the client
 * updater and its Won event, a person through the one edit service, so "a client never reverts" holds here as
 * everywhere. The ledger entry names the record and the hash; the edit service writes its own `record_edit` Activity.
 */
import { askOn, type AgentControls } from "../agent/controls"
import { LedgerRefused } from "../agent/ledger"
import { step, type AgentDb } from "../agent/ledger-server"
import { AskRefused } from "./edits"
import type { AskData, AskPerson } from "./run"
import { OPPORTUNITY_STAGES, PERSON_STAGES, proposalHash, stageMoveProblem, type StageProposal } from "./policy"

export interface ConfirmDeps {
  db: AgentDb
  controls: () => Promise<AgentControls>
  data: Pick<AskData, "stageTarget">
  apply: (kind: StageProposal["kind"], id: string, to: string) => Promise<void>
  now: () => string
}

export interface ConfirmInput {
  taskId: string
  kind: StageProposal["kind"]
  id: string
  to: string
  hash: string
}

export function parseConfirm(body: Record<string, unknown> | null): ConfirmInput | null {
  if (!body) return null
  const { taskId, kind, id, to, hash } = body
  if (typeof taskId !== "string" || !/^ask-[A-Za-z0-9-]{1,80}$/.test(taskId)) return null
  if (kind !== "opportunity" && kind !== "person") return null
  if (typeof id !== "string" || !id || id.length > 200) return null
  if (typeof to !== "string" || !([...OPPORTUNITY_STAGES, ...PERSON_STAGES] as string[]).includes(to)) return null
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return null
  return { taskId, kind, id, to, hash }
}

export async function confirmStageChange(i: ConfirmInput, person: AskPerson, deps: ConfirmDeps): Promise<{ name: string; from: string | null; to: string }> {
  if (!askOn(await deps.controls())) throw new AskRefused("Ask is switched off.", 409)
  if (!person.permitted || !person.actor) throw new AskRefused("Ask isn't turned on for you.", 403)
  const target = await deps.data.stageTarget(i.kind, i.id)
  if (!target) throw new AskRefused("That record was not found.", 404)
  const now = proposalHash({ kind: i.kind, id: i.id, from: target.from, to: i.to, revision: target.revision })
  if (now !== i.hash) throw new AskRefused("This card is out of date: the record changed after it was shown. Ask again to see it as it is now.", 409)
  const problem = stageMoveProblem(i.kind, target.from, i.to)
  if (problem) throw new AskRefused(problem, 409)

  // The turn the card came from must be this person's (or the founder confirms it).
  await deps.db.run(async (tx) => {
    const t = await tx.getTask(i.taskId)
    if (!t || t.objective !== "ask") throw new AskRefused("This card is not from an Ask turn.", 404)
    if (t.requestedBy !== person.actor && !person.founder) throw new AskRefused("Only the person who asked can confirm this card.", 403)
  })

  await deps.apply(i.kind, i.id, i.to)
  try {
    await step(deps.db, {
      taskId: i.taskId,
      at: deps.now(),
      decide: () => ({ fields: { kind: "edit_applied", actor: person.actor!, refs: { record: i.id }, hashes: { approval: i.hash }, reasonCode: `stage-${i.kind}` } }),
    })
  } catch (e) {
    // The change is made; a ledger write that fails is logged loudly rather than reported as a failed confirm.
    console.error(`[ask:confirm] the change to ${i.kind} ${i.id} was made but its ledger entry failed:`, e instanceof LedgerRefused ? e.message : e)
  }
  return { name: target.name, from: target.from, to: i.to }
}
