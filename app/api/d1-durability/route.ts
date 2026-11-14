import { NextResponse } from "next/server"
import { getRun, resumeHook, start } from "workflow/api"
import {
  D1_CONTROLS,
  D1_EVENTS,
  D1_RULES_VERSION,
  D1_RUNS,
  D1_SCOPES,
  type D1Approval,
  type D1Input,
  type D1Scope,
  currentDeploymentId,
  d1HookToken,
  d1Refusal,
} from "@/lib/d1/durability"
import { d1DurabilityRun } from "@/workflows/d1-durability"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * D1, the engine durability test. TEST BRANCH ONLY: never merged; refuses in Production and anywhere but a preview on
 * the staging store (lib/d1/durability.ts d1Refusal). Made-up data only.
 *
 * Every action is a GET with `?action=`, so the test can be driven through the Vercel connector's fetch of a protected
 * preview (it fetches, it does not post). The preview stays behind Vercel Authentication.
 *
 *   start-all                         start the four runs (one per scope) and seed each scope's controls
 *   status&runId=                     the Firestore record and events, plus the engine's view of the run
 *   controls&scope=&op=publish-rules  publish this deployment's rules version to the scope
 *   controls&scope=&op=kill|unkill    set or clear the scope's kill flag
 *   approve&runId=[&approved=false]   resume the run's hook
 *   cancel&runId=                     cancel the run in the engine (step 5 setup)
 *   rebuild&runId=                    rebuild the run from Firestore alone (read-only)
 *   close&runId= | restart&runId=     close the lost run, or restart it as a new run, from Firestore alone
 */
export async function GET(request: Request) {
  const refusal = d1Refusal()
  if (refusal) return json({ ok: false, error: refusal }, 403)

  const url = new URL(request.url)
  const action = url.searchParams.get("action") ?? "status"
  const runId = url.searchParams.get("runId")
  const { getDb } = await import("@/lib/firebase-admin")
  const db = getDb()
  const deploymentId = currentDeploymentId()

  try {
    switch (action) {
      case "start-all": {
        const started = []
        for (const scope of D1_SCOPES) {
          const controls = db.collection(D1_CONTROLS).doc(scope)
          if (!(await controls.get()).exists) {
            await controls.set({ scope, rules_version: D1_RULES_VERSION, kill: false, updated_at: iso(), deployment_id: deploymentId })
          }
          const input: D1Input = { scope, label: `D1 made-up approval (${scope})`, rulesVersionAtStart: D1_RULES_VERSION }
          const run = await start(d1DurabilityRun, [input])
          started.push({ scope, runId: run.runId, hookToken: d1HookToken(run.runId) })
        }
        return json({ ok: true, deploymentId, rulesVersion: D1_RULES_VERSION, startedAt: iso(), runs: started })
      }

      case "status": {
        if (!runId) {
          const runs = await db.collection(D1_RUNS).orderBy("started_at", "desc").limit(20).get()
          const controls = await db.collection(D1_CONTROLS).get()
          return json({
            ok: true,
            deploymentId,
            rulesVersion: D1_RULES_VERSION,
            runs: runs.docs.map((d) => ({ id: d.id, scope: d.get("scope"), status: d.get("status"), started_deployment_id: d.get("started_deployment_id") })),
            controls: controls.docs.map((d) => d.data()),
          })
        }
        const record = await readRecord(db, runId)
        let engine: Record<string, unknown>
        try {
          const run = getRun(runId)
          engine = { exists: await run.exists, status: await run.status }
        } catch (e) {
          engine = { error: message(e) }
        }
        return json({ ok: true, deploymentId, record, engine })
      }

      case "controls": {
        const scope = url.searchParams.get("scope") as D1Scope | null
        const op = url.searchParams.get("op")
        if (!scope || !D1_SCOPES.includes(scope)) return json({ ok: false, error: "unknown scope" }, 400)
        const ref = db.collection(D1_CONTROLS).doc(scope)
        if (op === "publish-rules") await ref.set({ scope, rules_version: D1_RULES_VERSION, updated_at: iso(), deployment_id: deploymentId }, { merge: true })
        else if (op === "kill" || op === "unkill") await ref.set({ scope, kill: op === "kill", updated_at: iso(), deployment_id: deploymentId }, { merge: true })
        else return json({ ok: false, error: "op must be publish-rules, kill or unkill" }, 400)
        return json({ ok: true, deploymentId, controls: (await ref.get()).data() })
      }

      case "approve": {
        if (!runId) return json({ ok: false, error: "runId required" }, 400)
        const payload: D1Approval = { approved: url.searchParams.get("approved") !== "false", by: "d1-test" }
        const resumed = await resumeHook(d1HookToken(runId), payload)
        await db.collection(D1_RUNS).doc(runId).collection(D1_EVENTS).doc("02a-approval-sent").set({
          step: "approval_sent",
          at: iso(),
          deployment_id: deploymentId,
          detail: payload,
        })
        return json({ ok: true, deploymentId, resumed: { runId: resumed.runId }, payload })
      }

      case "cancel": {
        if (!runId) return json({ ok: false, error: "runId required" }, 400)
        await getRun(runId).cancel()
        await db.collection(D1_RUNS).doc(runId).collection(D1_EVENTS).doc("02x-cancelled-in-engine").set({
          step: "cancelled_in_engine",
          at: iso(),
          deployment_id: deploymentId,
          detail: { why: "D1 step 5: lose the engine's state, then rebuild from Firestore alone" },
        })
        return json({ ok: true, deploymentId, cancelled: runId })
      }

      // Step 5. These three read Firestore only: no engine call, so they prove the record alone is enough.
      case "rebuild": {
        if (!runId) return json({ ok: false, error: "runId required" }, 400)
        return json({ ok: true, deploymentId, rebuilt: rebuildFrom(await readRecord(db, runId)) })
      }

      case "close":
      case "restart": {
        if (!runId) return json({ ok: false, error: "runId required" }, 400)
        const rebuilt = rebuildFrom(await readRecord(db, runId))
        if (!rebuilt.found) return json({ ok: false, error: "no record" }, 404)
        let restartedAs: string | null = null
        if (action === "restart") {
          const input = { ...(rebuilt.input as D1Input), restartOf: runId, rulesVersionAtStart: D1_RULES_VERSION }
          restartedAs = (await start(d1DurabilityRun, [input])).runId
        }
        const ref = db.collection(D1_RUNS).doc(runId)
        await ref.collection(D1_EVENTS).doc(`04-${action}d-from-firestore`).set({
          step: `${action}d_from_firestore`,
          at: iso(),
          deployment_id: deploymentId,
          detail: { rebuilt, restarted_as: restartedAs },
        })
        await ref.set({ status: action === "close" ? "closed_from_firestore" : "restarted_from_firestore", restarted_as: restartedAs, waiting_for: null, updated_at: iso() }, { merge: true })
        return json({ ok: true, deploymentId, rebuilt, restartedAs })
      }

      default:
        return json({ ok: false, error: `unknown action ${action}` }, 400)
    }
  } catch (error) {
    console.error("[GET /api/d1-durability]", action, error)
    return json({ ok: false, action, error: message(error) }, 500)
  }
}

type Db = ReturnType<typeof import("@/lib/firebase-admin").getDb>

async function readRecord(db: Db, runId: string) {
  const ref = db.collection(D1_RUNS).doc(runId)
  const [doc, events] = await Promise.all([ref.get(), ref.collection(D1_EVENTS).orderBy("at").get()])
  return { exists: doc.exists, run: doc.data() ?? null, events: events.docs.map((d) => ({ id: d.id, ...d.data() })) }
}

/** What the run had done and what it was waiting for, from the Firestore record alone. */
function rebuildFrom(record: Awaited<ReturnType<typeof readRecord>>) {
  if (!record.exists || !record.run) return { found: false as const }
  const run = record.run
  return {
    found: true as const,
    input: run.input ?? null,
    done: record.events.map((e) => ({ step: (e as Record<string, unknown>).step, at: (e as Record<string, unknown>).at })),
    waitingFor: run.waiting_for ?? null,
    hookToken: run.hook_token ?? null,
    draft: run.draft ?? null,
    rulesVersionAtStart: run.rules_version_at_start ?? null,
    startedDeploymentId: run.started_deployment_id ?? null,
    status: run.status ?? null,
    missing: ["input", "draft", "hook_token", "rules_version_at_start", "started_deployment_id", "started_at"].filter((k) => run[k] == null),
  }
}

function iso() {
  return new Date().toISOString()
}

function message(e: unknown) {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e)
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}
