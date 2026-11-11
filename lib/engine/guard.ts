/**
 * The engine guard (434 build sequence V1 item 2, Foundation A). One place every language-model call passes through,
 * before it leaves for the Gateway and after it returns:
 *  - before: the model must be on the allow-list (lib/engine/models.ts), and, in Production, today's spend must be
 *    under the global and the property's daily cap (lib/engine/budget.ts). Either refusal throws, and no request is
 *    sent;
 *  - after: the call's tokens and cost are recorded against its task (lib/engine/cost-ledger.ts), whether it
 *    succeeded or not.
 *
 * How it reaches every call: the AI SDK resolves a model given by name ("anthropic/claude-…") through
 * `globalThis.AI_SDK_DEFAULT_PROVIDER`, falling back to the Gateway (ai 7, packages/ai/src/model/resolve-model.ts). The
 * guard installs itself there as the Gateway with this middleware on every language model, so the callers
 * (lib/ai-gateway-text.ts, the content pipeline, lead research, the skill loader, the exam's engine executor) need no
 * change. instrumentation.ts installs it when a server starts. Image, video and embedding models pass through as the
 * Gateway serves them; their rosters are curated in lib/ai-gateway-models.ts.
 *
 * Outside Production (previews, local runs) the budget is not read: previews have no Firestore (since 2026-11-02),
 * and the Gateway's own team budget still applies. The allow-list holds everywhere.
 */
import { gateway } from "@ai-sdk/gateway"
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai"
import { assertModelAllowed } from "./models"
import { assertWithinBudget, capsFromEnv, propertyKey, type DaySpend } from "./budget"
import { billedCostUsd, listCostUsd, livePrices, tokensOf, type PriceTable } from "./cost"
import { currentTask, UNTRACKED } from "./task-context"
import type { CallCostRecord } from "./cost-ledger"

export interface GuardDeps {
  /** Today's spend; omitted, the budget is not checked. */
  readSpend?: () => Promise<DaySpend>
  record: (rec: CallCostRecord) => Promise<void>
  prices: () => Promise<PriceTable | null>
  now?: () => Date
  env?: Record<string, string | undefined>
}

function servedBy(meta: unknown): string | undefined {
  const g = (meta as { gateway?: { routing?: Record<string, unknown> } } | undefined)?.gateway?.routing
  for (const k of ["finalProvider", "resolvedProvider", "provider"]) if (typeof g?.[k] === "string") return g[k] as string
  return undefined
}

/** The guard as AI SDK middleware. Exported for tests, which run it on the SDK's mock model. */
export function guardMiddleware(deps: GuardDeps): LanguageModelMiddleware {
  const now = deps.now ?? (() => new Date())

  async function before(modelId: string): Promise<void> {
    assertModelAllowed(modelId)
    if (!deps.readSpend) return
    const task = currentTask() ?? UNTRACKED
    assertWithinBudget(await deps.readSpend(), capsFromEnv(deps.env), task.property ? propertyKey(task.property) : undefined)
  }

  async function after(modelId: string, out: { usage?: unknown; providerMetadata?: unknown } | undefined, error?: unknown): Promise<void> {
    try {
      const task = currentTask() ?? UNTRACKED
      const tokens = tokensOf(out?.usage)
      const table = await deps.prices()
      const billedUsd = billedCostUsd(out?.providerMetadata)
      const listUsd = listCostUsd(table?.prices.get(modelId), tokens)
      const provider = servedBy(out?.providerMetadata)
      await deps.record({
        at: now().toISOString(),
        task: task.task,
        kind: task.kind,
        ...(task.property ? { property: task.property } : {}),
        ...(task.skill ? { skill: task.skill } : {}),
        model: modelId,
        ...(provider ? { provider } : {}),
        tokens,
        ...(billedUsd !== undefined ? { billedUsd } : {}),
        ...(listUsd !== undefined ? { listUsd, priceCheckedAt: table!.checkedAt } : {}),
        usd: billedUsd ?? listUsd ?? 0,
        ...(error ? { error: String((error as Error)?.message ?? error).slice(0, 300) } : {}),
      })
    } catch (e) {
      console.error("[engine:guard] Recording a call failed:", e)
    }
  }

  return {
    async wrapGenerate({ doGenerate, model }) {
      await before(model.modelId)
      try {
        const result = await doGenerate()
        await after(model.modelId, result as { usage?: unknown; providerMetadata?: unknown })
        return result
      } catch (e) {
        await after(model.modelId, undefined, e)
        throw e
      }
    },
    async wrapStream({ doStream, model }) {
      await before(model.modelId)
      const result = await doStream()
      let usage: unknown, providerMetadata: unknown, recorded = false
      const record = (error?: unknown) => {
        if (recorded) return
        recorded = true
        void after(model.modelId, { usage, providerMetadata }, error)
      }
      const tap = new TransformStream({
        transform(part, controller) {
          const p = part as { type?: string; usage?: unknown; providerMetadata?: unknown }
          if (p?.type === "finish") { usage = p.usage; providerMetadata = p.providerMetadata }
          controller.enqueue(part)
        },
        flush() { record() },
      })
      return { ...result, stream: result.stream.pipeThrough(tap) } as typeof result
    },
  }
}

/** The Gateway with the guard on every language model. Everything else is the Gateway's own. */
export function guardedGateway(deps: GuardDeps): typeof gateway {
  const middleware = guardMiddleware(deps)
  return new Proxy(gateway, {
    get(target, prop, receiver) {
      if (prop === "languageModel") return (id: string) => wrapLanguageModel({ model: target.languageModel(id), middleware })
      return Reflect.get(target, prop, receiver)
    },
    apply(target, _this, args: [string]) {
      return wrapLanguageModel({ model: target.languageModel(args[0]), middleware })
    },
  })
}

let installed = false

/** Installs the guard as the AI SDK's default provider, once per server instance. */
export async function installEngineGuard(): Promise<void> {
  if (installed) return
  const ledger = await import("./cost-ledger")
  const production = process.env.VERCEL_ENV === "production"
  globalThis.AI_SDK_DEFAULT_PROVIDER = guardedGateway({
    ...(production ? { readSpend: () => ledger.readDaySpend() } : {}),
    record: production ? ledger.recordCallCost : async (rec) => { console.info("[engine:cost]", JSON.stringify(rec)) },
    prices: () => livePrices(),
  })
  installed = true
}
