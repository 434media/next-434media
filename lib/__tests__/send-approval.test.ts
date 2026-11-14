/** Offline. The shared approval core (lib/send-approval.ts), and the owned-Meta publisher's hash staying what it was. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  ApprovalBlocked,
  DEFAULT_APPROVAL_TTL_MS,
  abortBeforeDispatch,
  approvalHash,
  approvalStatus,
  assertSendable,
  canonicalJson,
  claimSend,
  decide,
  draftApproval,
  markOutcomeUnknown,
  recordIntent,
  recordReceipt,
  type SendApproval,
} from "../send-approval"
import { canonicalJson as metaCanonicalJson, draftBatch, manifestHash, type MetaManifest } from "../owned-meta-publisher"

// ── The Meta hash is byte-for-byte what it was ──────────────────────────────────────────────────────────────────────
// The implementation as it stood in lib/owned-meta-publisher.ts before the move (main at 5c8285d), copied verbatim.
function legacyCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(legacyCanonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${legacyCanonicalJson(v)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}
const legacyManifestHash = (value: MetaManifest) => createHash("sha256").update(legacyCanonicalJson(value)).digest("hex")

const SHA = "a".repeat(64)
function metaManifest(format: MetaManifest["format"], over: Partial<MetaManifest> = {}): MetaManifest {
  const asset = { name: "one.png", url: "https://store.public.blob.vercel-storage.com/content-posts/12345678-1234-1234-1234-123456789abc.png", sha256: SHA, size: 10, mime: "image/jpeg" as const, width: 1080, height: 1350, provenance: { source: "test", templateRevision: "v1", generator: "none", metadata: "unverified" as const } }
  const assets = format === "carousel" ? [asset, { ...asset, name: "two.png" }] : format === "video" ? [{ ...asset, mime: "video/mp4" as const, duration: 5, width: 1080, height: 1920 }] : [asset]
  return {
    schema: 1, revision: 3, brand: "milcity", format, assets,
    captions: { instagram: "Caption with “quotes”, an accent é and a line\nbreak", facebook: "FB" },
    destinations: { appId: "1", pageId: "2", instagramId: "3", apiVersion: "v26.0" },
    placements: { instagram: format === "video" ? "reels" : "feed", facebook: format === "video" ? "reels" : "feed" },
    instagramShareToFeed: false, aiGenerated: format === "video", ...(format === "video" ? { aiRealisticMedia: false } : {}), publicHostingApproved: true, ...over,
  }
}

test("the Meta manifest hash and its canonical form are unchanged by the move", () => {
  for (const m of [metaManifest("still"), metaManifest("carousel"), metaManifest("video"), metaManifest("still", { aiRealisticMedia: undefined })]) {
    assert.equal(manifestHash(m), legacyManifestHash(m))
    assert.equal(metaCanonicalJson(m), legacyCanonicalJson(m))
    assert.equal(draftBatch("b", m).hash, legacyManifestHash(m))
  }
  // The publisher re-exports the core's function: one implementation, not two.
  assert.equal(metaCanonicalJson, canonicalJson)
  // A fixed value pins the form itself: keys sorted, undefined dropped, arrays kept in order.
  assert.equal(canonicalJson({ b: 1, a: { d: [2, "x"], c: undefined }, e: null }), '{"a":{"d":[2,"x"]},"b":1,"e":null}')
})

// ── The approval core ───────────────────────────────────────────────────────────────────────────────────────────────
const NOW = "2026-11-14T12:00:00.000Z"
const later = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString()
const payload = { from: "434 Media <hello@send.434media.com>", to: ["sink@example.test"], replyTo: "ops@434media.com", subject: "Your production inquiry", text: "Thanks for writing to us." }
const draft = (over: Partial<Parameters<typeof draftApproval>[0]> = {}) => draftApproval({ id: "ap-1", path: "intake_reply", taskId: "task-1", payload, reviewReason: "First reply to a new client", now: NOW, ...over })
const approve = (a: SendApproval, at = later(60_000)) => decide(a, { decision: "approved", by: "founder", at, shownHash: a.hash, reasonCode: "as-drafted", reason: "Reads right; send it." })

test("the hash binds the path, task, payload, schedule and expiry, and nothing else", () => {
  const a = draft()
  assert.equal(a.hash, approvalHash(a))
  assert.equal(a.expiresAt, later(DEFAULT_APPROVAL_TTL_MS))
  const variants: SendApproval[] = [
    { ...a, taskId: "task-2" },
    { ...a, payload: { ...a.payload, text: a.payload.text + " " } },
    { ...a, payload: { ...a.payload, to: ["other@example.test"] } },
    { ...a, payload: { ...a.payload, subject: "Re: changed" } },
    { ...a, payload: { ...a.payload, replyTo: undefined } },
    { ...a, sendAt: later(1000) },
    { ...a, expiresAt: later(DEFAULT_APPROVAL_TTL_MS * 2) },
  ]
  for (const v of variants) assert.notEqual(approvalHash(v), a.hash)
  const otherReason: SendApproval = { ...a, reviewReason: "different" }
  assert.equal(approvalHash(otherReason), a.hash)
})

test("a draft is refused without a sender, recipient, subject or text, with an unknown path, or a schedule past expiry", () => {
  for (const p of [{ ...payload, from: "" }, { ...payload, to: [] }, { ...payload, subject: " " }, { ...payload, text: "" }]) assert.throws(() => draft({ payload: p }), ApprovalBlocked)
  assert.throws(() => draft({ path: "broadcast" as never }), /Unknown send path/)
  assert.throws(() => draft({ sendAt: later(DEFAULT_APPROVAL_TTL_MS + 1) }), /expire/)
  assert.throws(() => draft({ ttlMs: 0 }), /expire/)
})

test("a decision is written once, on the hash shown, before expiry, with a reason", () => {
  const a = draft()
  assert.throws(() => decide(a, { decision: "approved", by: "founder", at: later(1), shownHash: "0".repeat(64), reasonCode: "as-drafted", reason: "ok" }), /changed since it was shown/)
  assert.throws(() => decide(a, { decision: "approved", by: "founder", at: later(1), shownHash: a.hash, reasonCode: "as-drafted", reason: "  " }), /reason is required/)
  assert.throws(() => decide(a, { decision: "approved", by: "founder", at: later(1), shownHash: a.hash, reasonCode: "Not A Code", reason: "ok" }), /reason code/)
  assert.throws(() => decide(a, { decision: "approved", by: "", at: later(1), shownHash: a.hash, reasonCode: "as-drafted", reason: "ok" }), /signed-in/)
  assert.throws(() => approve(a, later(DEFAULT_APPROVAL_TTL_MS)), /expired/)
  const approved = approve(a)
  assert.equal(approved.approval?.hash, a.hash)
  assert.throws(() => approve(approved), /already has a decision/)
  assert.throws(() => decide(approved, { decision: "rejected", by: "founder", at: later(2), shownHash: a.hash, reasonCode: "tone", reason: "no" }), /already has a decision/)
  // An edit after drafting is caught however it is made.
  const edited = { ...a, payload: { ...a.payload, text: "changed" } }
  assert.throws(() => approve(edited), /changed since it was hashed/)
})

test("only an approved, unexpired, unconsumed, hash-matched draft whose time has come is sendable", () => {
  const a = draft()
  assert.throws(() => assertSendable(a, later(1)), /not been approved/)
  const rejected = decide(a, { decision: "rejected", by: "founder", at: later(1), shownHash: a.hash, reasonCode: "tone", reason: "Too formal." })
  assert.throws(() => assertSendable(rejected, later(2)), /rejected/)
  const ok = approve(a)
  assert.doesNotThrow(() => assertSendable(ok, later(120_000)))
  assert.throws(() => assertSendable(ok, later(DEFAULT_APPROVAL_TTL_MS)), /expired/)
  assert.throws(() => assertSendable({ ...ok, payload: { ...ok.payload, text: "swapped after approval" } }, later(120_000)), /changed since it was hashed/)
  assert.throws(() => assertSendable({ ...ok, approval: { ...ok.approval!, hash: "f".repeat(64) } }, later(120_000)), /different draft/)
  const scheduled = approve(draft({ sendAt: later(3_600_000) }))
  assert.throws(() => assertSendable(scheduled, later(120_000)), /scheduled for later/)
  assert.equal(approvalStatus(scheduled, later(120_000)), "scheduled")
  assert.doesNotThrow(() => assertSendable(scheduled, later(3_600_000)))
})

test("claim, intent, receipt: one run, one send, then consumed; an intent is never followed by a second send", () => {
  const ok = approve(draft())
  const t = later(120_000)
  const claimed = claimSend(ok, "run-a", t)
  assert.throws(() => claimSend(claimed, "run-b", t), /Another run/)
  assert.throws(() => recordIntent(claimed, "run-b", t), /claim changed/)
  const intent = recordIntent(claimed, "run-a", t)
  assert.equal(approvalStatus(intent, t), "sending")
  assert.throws(() => assertSendable(intent, t), /already attempted/)
  assert.throws(() => recordReceipt(intent, "run-b", "m-1", t), /No matching intent/)
  const sent = recordReceipt(intent, "run-a", "m-1", t)
  assert.deepEqual(sent.consumed, { at: t, runId: "run-a" })
  assert.equal(approvalStatus(sent, t), "sent")
  assert.throws(() => claimSend({ ...sent, claim: null }, "run-c", t), /has been used/)
  assert.throws(() => recordReceipt(sent, "run-a", "m-2", t), /already recorded/)
})

test("a stop after the intent spends the approval; a lost provider answer needs a person; neither can send again", () => {
  const t = later(120_000)
  const intent = recordIntent(claimSend(approve(draft()), "run-a", t), "run-a", t)
  const aborted = abortBeforeDispatch(intent, "run-a", t, "stopped")
  assert.equal(approvalStatus(aborted, t), "stopped")
  assert.throws(() => claimSend({ ...aborted, claim: null }, "run-b", t), /already attempted/)
  const unknown = markOutcomeUnknown(intent, "run-a", t, "timeout")
  assert.equal(approvalStatus(unknown, t), "needs_reconciliation")
  assert.throws(() => claimSend({ ...unknown, claim: null }, "run-b", t), /already attempted/)
})

test("status reads pending, rejected and expired", () => {
  const a = draft()
  assert.equal(approvalStatus(a, later(1)), "pending")
  assert.equal(approvalStatus(a, later(DEFAULT_APPROVAL_TTL_MS)), "expired")
  assert.equal(approvalStatus(decide(a, { decision: "rejected", by: "founder", at: later(1), shownHash: a.hash, reasonCode: "routing", reason: "Route to the partner." }), later(2)), "rejected")
})
