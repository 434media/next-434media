/**
 * The live wiring for the Ask panel (lib/ask/run.ts, confirm.ts, edits.ts): who is asking, the admin's data as they may
 * see it, the switch, the founder's pin of `admin-ask`, and models by slug through the guarded Gateway.
 *
 * Every read is the person's own: the core view through their visibility filter (lib/core-model/read.ts), opportunities
 * and tasks through the CRM section rule (lib/auth.ts canAccessSection), "waiting" drafts for the founder only, as the
 * People page shows them. Every write goes through an existing path: triage through the core service, a stage change
 * through the client updater (and its Won event) or the one edit service.
 *
 * Server only. Firestore is imported when called, never when this module loads.
 */
import { randomUUID } from "node:crypto"
import type { LanguageModel } from "ai"
import { canAccessSection, type RosterRecord, type User } from "../auth"
import { founderDecision, founderEmails } from "../founder-guard"
import { readAgentControls } from "../agent/controls"
import { firestoreAgentDb } from "../agent/ledger-server"
import { AGENT_TASKS_COLLECTION } from "../agent/ledger"
import { readPin } from "../agent/intake-server"
import type { Viewer } from "../core-model/read"
import { ASK_SKILL, askActor, askPermitted, revisionOf, ASK_OBJECTIVE, type StageProposal } from "./policy"
import { AskRefused } from "./edits"
import type { AskData, AskDeps, AskPerson, FindKind, TriageDecisionValue } from "./run"
import type { ConfirmDeps } from "./confirm"
import { askMonthlyCapUsd, askSpendOf } from "./limits"
import { parseRef } from "../record-refs"

const LIMIT = 10
const str = (v: unknown) => (typeof v === "string" ? v : "")
const has = (q: string, ...fields: unknown[]) => fields.some((f) => typeof f === "string" && f.toLowerCase().includes(q))

/** The one roster record for this address, with its id; null when there is none or more than one. */
async function rosterOf(email: string): Promise<{ id: string; record: RosterRecord } | null> {
  try {
    const { getDb } = await import("../firebase-admin")
    const snap = await getDb().collection("crm_team_members").where("email", "==", email.toLowerCase()).limit(2).get()
    return snap.size === 1 ? { id: snap.docs[0].id, record: snap.docs[0].data() as RosterRecord } : null
  } catch (e) {
    console.error("[ask] roster lookup failed; Ask not granted:", e instanceof Error ? e.message : e)
    return null
  }
}

export async function askPersonOf(session: User): Promise<{ person: AskPerson; viewer: Viewer }> {
  const founder = founderDecision(session, founderEmails()).allowed
  const roster = await rosterOf(session.email)
  const { viewerOf } = await import("../core-model/route-helpers")
  const viewer = await viewerOf(session)
  return {
    person: {
      email: session.email.toLowerCase(),
      role: session.role ?? "crm_only",
      founder,
      actor: askActor({ founder, memberId: roster?.id }),
      permitted: askPermitted({ founder, record: roster?.record ?? null }),
    },
    viewer,
  }
}

/** The admin's data as this person may see and change it. */
export function liveAskData(session: User, viewer: Viewer): AskData {
  const crm = canAccessSection(session, "crm")
  return {
    async context() {
      const [{ getOne }, ctx] = await Promise.all([import("../sor/read"), import("../connector-434/context")])
      let voice = null
      try {
        voice = ctx.brandVoiceOf((await getOne("policy_documents", ctx.BRAND_VOICE_KEY, "internal")).data)
      } catch (e) {
        console.error("[ask] brand voice read failed; answering without it:", e instanceof Error ? e.message : e)
      }
      const context = ctx.build434Context(voice)
      return ctx.contextProblems(context).length ? { ok: false, error: "The 434 context failed its content check." } : context
    },

    async waiting() {
      const { getVisibleCoreView, inboxItems } = await import("../core-model/read")
      const view = await getVisibleCoreView(viewer)
      const arrivals = inboxItems(view)
        .sort((a, b) => b.activity.occurred_at.localeCompare(a.activity.occurred_at))
        .slice(0, 25)
        .map((i) => ({
          activity_id: i.activity.id,
          from: i.person?.name || i.activity.contact.name || i.activity.contact.email || "Unknown",
          company: i.organization?.name || i.activity.contact.company || undefined,
          fit: i.organization?.icp_grade,
          summary: (i.activity.summary || i.activity.body || "").slice(0, 300),
          arrived: i.activity.occurred_at,
        }))
      let drafts: unknown[] = []
      if (viewer.founder) {
        const { readWaiting } = await import("../agent/review-server")
        drafts = (await readWaiting(viewer)).items
          .filter((d) => d.status === "pending")
          .slice(0, 25)
          .map((d) => ({ draft_id: d.id, subject: d.subject, waiting_since: d.createdAt, decide_in: "/admin/todo" }))
      }
      return { drafts, arrivals, note: "Drafts are decided in To do (/admin/todo); Ask never approves or sends them." }
    },

    async find(query, kinds: FindKind[]) {
      const q = query.trim().toLowerCase()
      const out: Record<string, unknown> = {}
      // A short reference (TSK-142, OPP-1045) is an exact lookup of that one record.
      const asRef = parseRef(query)
      if (asRef) {
        if (!crm) return { note: "References name tasks and opportunities, which this person cannot see." }
        if (asRef.type === "OPP") {
          const { getOpportunityByRef } = await import("../firestore-crm")
          const c = await getOpportunityByRef(asRef.ref)
          out.opportunities = c ? [{ id: c.id, ref: c.ref, name: c.title || c.company_name || c.name, company: c.company_name || c.name, stage: c.disposition ?? null, brand: c.brand, archived: c.is_archived || undefined, from_ref: c.from_ref }] : []
        } else if (asRef.type === "TSK") {
          const { getTaskByRef } = await import("../firestore-crm")
          const t = await getTaskByRef(asRef.ref)
          out.tasks = t ? [{ id: t.id, ref: t.ref, title: t.title, assigned_to: t.assigned_to, status: t.status, due_date: t.due_date || null }] : []
        } else {
          out.note = "Projections do not exist yet."
        }
        return out
      }
      if (kinds.includes("people") || kinds.includes("organizations")) {
        const { getVisibleCoreView } = await import("../core-model/read")
        const view = await getVisibleCoreView(viewer)
        if (kinds.includes("people")) {
          out.people = view.people.filter((p) => has(q, p.name, p.title, ...p.emails)).slice(0, LIMIT)
            .map((p) => ({ id: p.id, name: p.name, title: p.title, email: p.emails[0], stage: p.lifecycle_stage, stored: !p.read_only }))
        }
        if (kinds.includes("organizations")) {
          out.organizations = view.organizations.filter((o) => has(q, o.name, o.domain, o.industry)).slice(0, LIMIT)
            .map((o) => ({ id: o.id, name: o.name, domain: o.domain, fit: o.icp_grade }))
        }
      }
      if (crm && kinds.includes("opportunities")) {
        const { getClients } = await import("../firestore-crm")
        out.opportunities = (await getClients()).filter((c) => c.is_opportunity && !c.is_archived && has(q, c.name, c.company_name, c.title)).slice(0, LIMIT)
          .map((c) => ({ id: c.id, ref: c.ref, name: c.title || c.company_name || c.name, company: c.company_name || c.name, stage: c.disposition ?? null, brand: c.brand }))
      }
      if (crm && kinds.includes("tasks")) {
        const { getUnifiedTasks } = await import("../firestore-crm")
        out.tasks = (await getUnifiedTasks()).filter((t) => has(q, t.title, t.assigned_to, t.client_name)).slice(0, LIMIT)
          .map((t) => ({ id: t.id, ref: t.ref, title: t.title, assigned_to: t.assigned_to, status: t.status, due_date: t.due_date || null }))
      }
      return out
    },

    async resolveRef(ref: string) {
      const parsed = parseRef(ref)
      if (!crm || !parsed) return null
      if (parsed.type === "OPP") {
        const c = await (await import("../firestore-crm")).getOpportunityByRef(parsed.ref)
        return c && c.is_opportunity ? { kind: "opportunity" as const, id: c.id } : null
      }
      if (parsed.type === "TSK") {
        const t = await (await import("../firestore-crm")).getTaskByRef(parsed.ref)
        return t ? { kind: "task" as const, id: t.id } : null
      }
      return null
    },

    async triage(activityId: string, decision: TriageDecisionValue) {
      const [{ getVisibleCoreView }, { firestoreCoreStore, firestoreLeadPath }, { triageActivity }, { listIcpCohorts }, { pendingArrivals }] = await Promise.all([
        import("../core-model/read"),
        import("../core-model/firestore-store"),
        import("../core-model/service"),
        import("../firestore-icp-cohorts"),
        import("../google-contacts/server"),
      ])
      const view = await getVisibleCoreView(viewer)
      const activity = view.activities.find((a) => a.id === activityId)
      if (!activity) throw new AskRefused("That arrival was not found.", 404)
      const result = await triageActivity(firestoreCoreStore, firestoreLeadPath, { activity, decision, actor: session.email, founder: viewer.founder === true }, await listIcpCohorts(), pendingArrivals)
      const who = activity.contact.name || activity.contact.email || "Arrival"
      return { activityId: result.activityId ?? activity.id, label: `${who}: ${decision === "promote" ? "made a lead" : decision === "save" ? "saved as a contact" : "dismissed"}` }
    },

    async stageTarget(kind: StageProposal["kind"], id: string) {
      const { getDb } = await import("../firebase-admin")
      if (kind === "opportunity") {
        if (!crm) return null
        // Read fresh, never from a list cache: the Confirm's hash is bound to this read.
        const snap = await getDb().collection("crm_clients").doc(id).get()
        const d = snap.data()
        if (!snap.exists || !d || d.is_opportunity !== true) return null
        return { name: str(d.title) || str(d.company_name) || str(d.name) || id, from: typeof d.disposition === "string" ? d.disposition : null, revision: revisionOf(d.updated_at) }
      }
      const [{ getPerson }, { canSee }] = await Promise.all([import("../firestore-people"), import("../core-model/visibility")])
      const p = await getPerson(id)
      if (!p || !canSee(p, viewer)) return null
      return { name: p.name || p.emails[0] || id, from: p.lifecycle_stage ?? null, revision: revisionOf(p.updated_at) }
    },
  }
}

/** A stage change through the existing paths, after the Confirm's hash matched. */
export function liveApply(session: User, viewer: Viewer): ConfirmDeps["apply"] {
  return async (kind, id, to) => {
    if (kind === "opportunity") {
      const [{ getClientById, updateClient }, { afterClientUpdate }] = await Promise.all([import("../firestore-crm"), import("../opportunity-won")])
      const before = await getClientById(id)
      const client = await updateClient(id, { disposition: to as never })
      afterClientUpdate(before, client)
      return
    }
    const [{ getVisibleCoreView }, { firestoreCoreStore }, { editPersonRecord }, { listIcpCohorts }] = await Promise.all([
      import("../core-model/read"),
      import("../core-model/firestore-store"),
      import("../core-model/edit"),
      import("../firestore-icp-cohorts"),
    ])
    const view = await getVisibleCoreView(viewer)
    await editPersonRecord(firestoreCoreStore, view, id, { lifecycle_stage: to as never }, { viewer, actor: session.email, cohorts: await listIcpCohorts() })
  }
}

/** Ask turns this actor started on `day` (UTC), from the task registry. */
async function turnsToday(actor: string, day: string): Promise<number> {
  const { getDb } = await import("../firebase-admin")
  const snap = await getDb().collection(AGENT_TASKS_COLLECTION).where("requestedBy", "==", actor).limit(500).get()
  return snap.docs.filter((d) => {
    const t = d.data() as { objective?: string; createdAt?: string }
    return t.objective === ASK_OBJECTIVE && typeof t.createdAt === "string" && t.createdAt.startsWith(day)
  }).length
}

/** Ask's spend since the month's start, from the cost records (lib/engine/cost-ledger.ts). Throws when unreadable. */
export async function readAskMonthSpend(monthStart: string): Promise<number> {
  const { readCallCostsSince } = await import("../engine/cost-ledger")
  return askSpendOf(await readCallCostsSince(monthStart), monthStart)
}

export function liveAskDeps(session: User, viewer: Viewer): AskDeps {
  return {
    db: firestoreAgentDb(),
    controls: () => readAgentControls(),
    pin: () => readPin(ASK_SKILL),
    skillAt: async (commit) => (await import("../skills/source")).readSkillAt(ASK_SKILL, commit),
    turnsToday,
    monthSpend: readAskMonthSpend,
    monthlyCapUsd: askMonthlyCapUsd(),
    taskSpend: async (root) => (await import("../engine/cost-ledger")).readTaskSpend(root),
    // A slug resolves through the guarded Gateway, the AI SDK's default provider (instrumentation.ts).
    model: (slug) => slug as LanguageModel,
    data: liveAskData(session, viewer),
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
  }
}

export function liveConfirmDeps(session: User, viewer: Viewer): ConfirmDeps {
  return {
    db: firestoreAgentDb(),
    controls: () => readAgentControls(),
    data: liveAskData(session, viewer),
    apply: liveApply(session, viewer),
    now: () => new Date().toISOString(),
  }
}

/** After a task edit or its undo written in a ledger transaction: the CRM's list caches, which that write bypassed. */
export async function afterAskWrite(): Promise<void> {
  try {
    const [{ invalidateCache }, { invalidateActivities }, { invalidateCoreView }] = await Promise.all([import("../firestore-crm"), import("../firestore-activities"), import("../core-model/read")])
    invalidateCache()
    invalidateActivities()
    invalidateCoreView()
  } catch {
    /* a cache that stays 30 s old is not a failure */
  }
}
