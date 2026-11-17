/**
 * Offline. One work area for an arrival (V1 item 4, founder 2026-11-16): the edit that re-hashes a draft so the approval
 * binds the edited text; the arrival taken out of the People Inbox after an approved send; the Undo on a triage; and a
 * draft stored before this change, which must decide and send exactly as before. In-memory stores; nothing is sent.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { decideApproval, editDraft, closeArrivalAfterSend } from "../agent/review-server"
import { SEND_APPROVALS_COLLECTION, TEST_SINK_RECIPIENTS, sendApprovedEmail } from "../agent/send-email"
import { createTask, step } from "../agent/ledger-server"
import { newTask } from "../agent/ledger"
import { parseControls } from "../agent/controls"
import { REASON_CODES, arrivalActivityId, reviewItem, type StoredApproval } from "../agent/review"
import { approvalHash, assertIntact, decide, draftApproval, reviseDraft, type EmailPayload } from "../send-approval"
import { adaptContactForm } from "../core-model/adapters"
import { consentFromSource } from "../core-model/consent"
import { TRIAGE_UNDO_WINDOW_MS, triageActivity, undoTriage } from "../core-model/service"
import type { Activity } from "../../types/core-model"
import type { CoreView } from "../core-model/assemble"
import { filterViewFor } from "../core-model/view-filter"
import { inboxItems, waitingRows } from "../core-model/waiting"
import type { ContactFormSubmission } from "../firestore-contact-forms"
import { MemoryAgentDb } from "./helpers/agent-db"
import { FakeLeadPath, MemoryStore } from "./helpers/core-memory-store"

const NOW = "2026-11-16T12:00:00.000Z"
const HOUR = 3_600_000
const at = (ms = 0) => new Date(Date.parse(NOW) + ms).toISOString()
const SINK = TEST_SINK_RECIPIENTS[0]
const FOUNDER = "founder@434media.test"

function approval(id = "1"): StoredApproval {
  const a = draftApproval({
    id: `ap-${id}`,
    path: "intake_reply",
    taskId: `intake-${id}`,
    payload: { from: "434 Media <hello@send.434media.com>", to: [SINK], replyTo: "build@434media.com", subject: "Your production request", text: "Thanks for writing. Drafted text." },
    reviewReason: "First reply to a new contact",
    now: NOW,
  })
  return { ...a, routing: { outcome: "qualified" }, intake: { record: "record", nextOwner: "founder", due: "2026-11-19", returnCondition: "no reply" }, arrival: { formId: `form-${id}`, receivedAt: NOW } }
}

async function drafted(a = approval()) {
  const db = new MemoryAgentDb()
  await createTask(db, newTask({ id: a.taskId, property: "434", objective: "intake-reply", workflow: "w", budgetUsd: 1, lineage: { event: `contact_forms:${a.arrival!.formId}` }, now: NOW }), "system", NOW)
  await step(db, { taskId: a.taskId, at: at(1), decide: () => ({ fields: { kind: "run_started", actor: "system" }, to: "running" }) })
  await step(db, { taskId: a.taskId, at: at(2), decide: () => ({ fields: { kind: "draft_queued", actor: "system", refs: { approval: a.id }, hashes: { draft: a.hash } }, to: "awaiting_review", write: (tx) => tx.createDoc(SEND_APPROVALS_COLLECTION, a.id, a) }) })
  return { db, a }
}

const sendDeps = (db: MemoryAgentDb, sent: EmailPayload[]) => ({
  db,
  controls: async () => parseControls({ stopped: false, sends: { intake_reply: true } }),
  dispatch: async (p: EmailPayload) => (sent.push(p), { messageId: "re_1" }),
  now: () => at(2 * HOUR),
  runId: "run-x",
  actor: "founder",
})

// ── Edit before approve ─────────────────────────────────────────────────────────────────────────────────────────────

test("an edit re-hashes the draft over the same fields; the drafted text stays as a revision; the expiry does not move", () => {
  const a = approval()
  const e = reviseDraft(a, { text: "Thanks for writing. Edited text.", by: "founder", at: at(HOUR), shownHash: a.hash })
  assert.notEqual(e.hash, a.hash)
  assert.equal(e.hash, approvalHash(e))
  assert.doesNotThrow(() => assertIntact(e))
  assert.equal(e.payload.text, "Thanks for writing. Edited text.")
  assert.deepEqual({ ...e.payload, text: a.payload.text }, a.payload, "only the text changed")
  assert.equal(e.expiresAt, a.expiresAt)
  assert.equal(e.revisions?.length, 1)
  assert.deepEqual(e.revisions![0], { by: "founder", at: at(HOUR), fromHash: a.hash, toHash: e.hash, previousText: "Thanks for writing. Drafted text." })
})

test("an edit is refused on a stale hash, after a decision, after expiry, with nothing changed, or with no text", () => {
  const a = approval()
  const edit = (x: StoredApproval, over: Partial<{ text: string; at: string; shownHash: string }> = {}) =>
    reviseDraft(x, { text: "New text", by: "founder", at: at(HOUR), shownHash: x.hash, ...over })
  assert.throws(() => edit(a, { shownHash: "0".repeat(64) }), /changed since it was shown/)
  const approved = decide(a, { decision: "approved", by: "founder", at: at(HOUR), shownHash: a.hash, reasonCode: "as-drafted", reason: "fine" })
  assert.throws(() => edit(approved), /already has a decision/)
  assert.throws(() => edit(a, { at: at(80 * HOUR) }), /expired/)
  assert.throws(() => edit(a, { text: a.payload.text }), /Nothing changed/)
  assert.throws(() => edit(a, { text: "   " }), /text is required/)
})

test("after an edit, the decision must name the new hash; the approval binds the edited text, and that text is what sends", async () => {
  const { db, a } = await drafted()
  const edited = await editDraft({ approvalId: a.id, shownHash: a.hash, text: "Thanks for writing. Edited by the founder." }, at(HOUR), db)
  // The ledger records the edit as a re-queued draft, reason "edited", both hashes, no words.
  const last = db.entries(a.taskId).at(-1)!
  assert.deepEqual([last.kind, last.actor, last.reasonCode, last.hashes?.draft, last.hashes?.approval], ["draft_queued", "founder", "edited", edited.hash, a.hash])
  assert.ok(!JSON.stringify(db.entries(a.taskId)).includes("Edited by the founder"))
  assert.equal(db.task(a.taskId)!.state, "awaiting_review")
  // The hash he saw before the edit no longer decides anything.
  await assert.rejects(decideApproval({ approvalId: a.id, decision: "approved", shownHash: a.hash, reasonCode: "edited", reason: "edited" }, at(HOUR + 1), db), /changed since it was shown/)
  const out = await decideApproval({ approvalId: a.id, decision: "approved", shownHash: edited.hash, reasonCode: "edited", reason: "Softer close." }, at(HOUR + 2), db)
  assert.equal(out.approval?.hash, edited.hash)
  assert.equal(out.approval?.reasonCode, "edited")
  assert.ok(REASON_CODES.approve.some((r) => r.code === "edited"))
  const sent: EmailPayload[] = []
  const r = await sendApprovedEmail(a.id, sendDeps(db, sent))
  assert.equal(r.sent, true)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].text, "Thanks for writing. Edited by the founder.")
  // The drafted text is still on the record, as evidence.
  const stored = db.get<StoredApproval>(SEND_APPROVALS_COLLECTION, a.id)!
  assert.equal(stored.revisions?.[0].previousText, "Thanks for writing. Drafted text.")
  assert.equal(reviewItem(stored, at(3 * HOUR)).edits, 1)
})

test("an edit to a cancelled task is refused", async () => {
  const { db, a } = await drafted()
  await step(db, { taskId: a.taskId, at: at(3), decide: () => ({ fields: { kind: "cancelled", actor: "founder" }, to: "cancelled" }) })
  const t = db.task(a.taskId)!
  db.col("agent_tasks").set(a.taskId, { ...t, cancelled: true })
  await assert.rejects(editDraft({ approvalId: a.id, shownHash: a.hash, text: "New" }, at(HOUR), db), /cancelled/)
})

test("a draft stored before this change (no revisions) shows, decides and sends exactly as before", async () => {
  const { db, a } = await drafted()
  assert.equal(a.revisions, undefined)
  const item = reviewItem(a, at(HOUR))
  assert.equal(item.edits, 0)
  assert.equal(item.activityId, "contact_forms:form-1")
  assert.equal(item.hash, a.hash)
  await decideApproval({ approvalId: a.id, decision: "approved", shownHash: a.hash, reasonCode: "proof-run", reason: "Proof run." }, at(HOUR), db)
  const sent: EmailPayload[] = []
  assert.equal((await sendApprovedEmail(a.id, sendDeps(db, sent))).sent, true)
  assert.equal(sent[0].text, a.payload.text)
})

// ── The arrival leaves the inbox after a send ───────────────────────────────────────────────────────────────────────

function formArrival(formId = "form-1"): Activity {
  const sub = { id: formId, firstName: "Ana", lastName: "Reyes", company: "Alamo Labs", email: "ana@alamolabs.test", message: "We need a shoot.", source: "434Media", created_at: NOW } as ContactFormSubmission
  return adaptContactForm(sub, false).activities[0]
}

test("after an approved send or a hand-written reply, the arrival is saved as a contact (triaged)", async () => {
  const store = new MemoryStore()
  const a = approval()
  const activity = formArrival()
  assert.equal(arrivalActivityId(a), activity.id)
  const out = await closeArrivalAfterSend(a, {
    activity: async (id) => (id === activity.id ? activity : null),
    triage: async (act) => {
      await triageActivity(store, new FakeLeadPath(), { activity: act, decision: "save", actor: FOUNDER, founder: true }, [])
    },
  })
  assert.deepEqual(out, { closed: true, activityId: activity.id })
  const rec = store.triage.get(activity.id)!
  assert.equal(rec.decision, "save")
  assert.equal(rec.by, FOUNDER)
  assert.equal([...store.people.values()][0]?.lifecycle_stage, "contact")
  // "Write reply" (the reply route) names the arrival by its form id alone, and reaches the same Activity.
  assert.equal(arrivalActivityId({ arrival: { formId: "form-1" } }), activity.id)
})

test("closing an arrival already triaged, or not found, never throws; a failed triage is reported, not raised", async () => {
  const a = approval()
  const triaged = { ...formArrival(), triaged: true }
  let triageCalls = 0
  const ok = await closeArrivalAfterSend(a, { activity: async () => triaged, triage: async () => void triageCalls++ })
  assert.equal(ok.closed, true)
  assert.equal(triageCalls, 0)
  const missing = await closeArrivalAfterSend(a, { activity: async () => null, triage: async () => void triageCalls++ })
  assert.equal(missing.closed, false)
  const failed = await closeArrivalAfterSend(a, { activity: async () => formArrival(), triage: async () => { throw new Error("store down") } })
  assert.deepEqual(failed, { closed: false, reason: "store down" })
  const race = await closeArrivalAfterSend(a, { activity: async () => formArrival(), triage: async () => { throw new Error("This item has already been triaged.") } })
  assert.equal(race.closed, true)
  const none = await closeArrivalAfterSend({ arrival: undefined }, { activity: async () => formArrival(), triage: async () => void triageCalls++ })
  assert.equal(none.closed, false)
})

// ── Undo on triage ──────────────────────────────────────────────────────────────────────────────────────────────────

test("undo after an accidental Lead: the lead the triage created is removed, the person goes back, the arrival returns", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath("lead-7", true)
  const activity = formArrival()
  const r = await triageActivity(store, leads, { activity, decision: "promote", actor: FOUNDER, founder: true }, [])
  assert.equal(r.leadId, "lead-7")
  assert.equal(r.activityId, activity.id)
  const personId = r.person!.id
  assert.equal(store.people.get(personId)!.lifecycle_stage, "lead")
  const u = await undoTriage(store, leads, { activityId: activity.id, actor: FOUNDER, founder: true })
  assert.deepEqual(u, { decision: "promote", leadRemoved: true })
  assert.deepEqual(leads.removed, ["lead-7"])
  assert.equal(store.triage.has(activity.id), false, "the arrival is back in the inbox")
  assert.equal(store.people.get(personId)!.lifecycle_stage, "contact")
  // It can be triaged again, the right way.
  const again = await triageActivity(store, leads, { activity, decision: "save", actor: FOUNDER, founder: true }, [])
  assert.equal(again.person!.id, personId)
})

test("undo leaves a lead that already existed, and puts an existing person's stage back", async () => {
  const store = new MemoryStore()
  const existing = await store.createPerson({ name: "Ana Reyes", emails: ["ana@alamolabs.test"], phones: [], lifecycle_stage: "contact", roles: [], source: "web", consent: consentFromSource("web", NOW), relationship: "business", visibility: "business", legacy_refs: [] })
  store.emailIndex.set("ana@alamolabs.test", existing.id)
  const leads = new FakeLeadPath("lead-old", false)
  const activity = formArrival()
  await triageActivity(store, leads, { activity, decision: "promote", actor: FOUNDER, founder: true }, [])
  assert.equal(store.people.get(existing.id)!.lifecycle_stage, "lead")
  const u = await undoTriage(store, leads, { activityId: activity.id, actor: FOUNDER, founder: true })
  assert.equal(u.leadRemoved, false)
  assert.deepEqual(leads.removed, [])
  assert.equal(store.people.get(existing.id)!.lifecycle_stage, "contact")
})

test("undo of Personal on a phone arrival restores what the arrival proposed; dismiss and save undo too", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath()
  const phone: Activity = { id: "act-phone", type: "google_contact", source: "google_contacts", occurred_at: NOW, contact: { name: "Sam Ortiz", email: "sam@ortizfilms.test" }, summary: "New Google contact", triaged: false, relationship: "business", created_at: NOW }
  const r = await triageActivity(store, leads, { activity: phone, decision: "save", actor: FOUNDER, founder: true, relationship: "personal" }, [])
  assert.equal(r.person!.relationship, "personal")
  await undoTriage(store, leads, { activityId: phone.id, actor: FOUNDER, founder: true })
  const p = store.people.get(r.person!.id)!
  assert.deepEqual([p.relationship, p.visibility, p.lifecycle_stage], ["business", "business", "contact"])
  const form = formArrival("form-2")
  await triageActivity(store, leads, { activity: form, decision: "dismiss", actor: FOUNDER, founder: true }, [])
  assert.equal((await undoTriage(store, leads, { activityId: form.id, actor: FOUNDER, founder: true })).decision, "dismiss")
  assert.equal(store.triage.has(form.id), false)
})

test("undo is refused for someone else's decision, after the window, with nothing to undo, or on a record from before undo", async () => {
  const store = new MemoryStore()
  const leads = new FakeLeadPath()
  const activity = formArrival()
  await triageActivity(store, leads, { activity, decision: "save", actor: "staff@434media.test" }, [])
  await assert.rejects(undoTriage(store, leads, { activityId: activity.id, actor: "other@434media.test" }), /Only the person who decided/)
  const late = new Date(Date.parse(store.triage.get(activity.id)!.at) + TRIAGE_UNDO_WINDOW_MS + 1000).toISOString()
  await assert.rejects(undoTriage(store, leads, { activityId: activity.id, actor: "staff@434media.test", at: late }), /Too late/)
  await assert.rejects(undoTriage(store, leads, { activityId: "nope", actor: FOUNDER, founder: true }), /nothing to undo/)
  store.triage.set("old", { id: "old", decision: "save", by: FOUNDER, at: new Date().toISOString() })
  await assert.rejects(undoTriage(store, leads, { activityId: "old", actor: FOUNDER, founder: true }), /before undo existed/)
  // The founder may undo a staff member's decision within the window.
  assert.equal((await undoTriage(store, leads, { activityId: activity.id, actor: FOUNDER, founder: true })).decision, "save")
})

// ── Waiting on you: drafts and arrivals in one list ─────────────────────────────────────────────────────────────────

const viewOf = (activities: Activity[]): CoreView => ({ people: [], organizations: [], affiliations: [], activities })
const waitingDraft = (a: StoredApproval) => reviewItem(a, at(HOUR))

test("waiting on you: an arrival with a pending draft is one row, with its draft; other arrivals follow", () => {
  const withDraft = formArrival("form-1")
  const plain = { ...formArrival("form-9"), occurred_at: at(-HOUR) }
  const inbox = inboxItems(viewOf([withDraft, plain]))
  const rows = waitingRows([waitingDraft(approval("1"))], inbox)
  assert.deepEqual(rows.map((r) => r.kind), ["draft", "arrival"])
  assert.equal(rows.filter((r) => (r.kind === "draft" ? r.item?.activity.id : r.item.activity.id) === withDraft.id).length, 1, "never two rows")
  assert.equal(rows[0].kind === "draft" && rows[0].item?.activity.id, withDraft.id)
  // A decided draft is history, not waiting: the arrival is then its own row.
  const decidedDraft = waitingDraft(decide(approval("1"), { decision: "rejected", by: "founder", at: at(1), shownHash: approval("1").hash, reasonCode: "tone", reason: "no" }) as StoredApproval)
  assert.deepEqual(waitingRows([decidedDraft], inbox).map((r) => r.kind), ["arrival", "arrival"])
})

test("waiting on you: triaging an arrival there removes it from the Inbox and from the list", async () => {
  const store = new MemoryStore()
  const arrival = formArrival("form-9")
  const before = waitingRows([], inboxItems(viewOf([arrival])))
  assert.equal(before.length, 1)
  // The row's actions are the Inbox's own: the same triage, recorded once.
  await triageActivity(store, new FakeLeadPath(), { activity: arrival, decision: "save", actor: FOUNDER, founder: true }, [])
  const triaged = { ...arrival, triaged: store.triage.has(arrival.id) }
  const inbox = inboxItems(viewOf([triaged]))
  assert.equal(inbox.length, 0, "gone from the Inbox")
  assert.equal(waitingRows([], inbox).length, 0, "gone from Waiting on you")
})

test("waiting on you: a personal phone arrival reaches the founder only", () => {
  const phone: Activity = { id: "gc:people/c9", type: "google_contact", source: "google_contacts", occurred_at: NOW, contact: { name: "A Friend", phone: "210-555-0199" }, summary: "Added on the phone", relationship: "personal", visibility: "private", read_only: true, triaged: false, created_at: NOW }
  const view = viewOf([phone, formArrival("form-9")])
  for (const viewer of [{ role: "crm_only" as const }, { role: "full_admin" as const }, { role: "full_admin" as const, superAdmin: true }]) {
    const rows = waitingRows([], inboxItems(filterViewFor(view, viewer)))
    assert.ok(!rows.some((r) => r.kind === "arrival" && r.item.activity.id === phone.id), `hidden from ${JSON.stringify(viewer)}`)
    assert.equal(rows.length, 1)
  }
  const founderRows = waitingRows([], inboxItems(filterViewFor(view, { role: "full_admin", founder: true })))
  assert.ok(founderRows.some((r) => r.kind === "arrival" && r.item.activity.id === phone.id))
})
