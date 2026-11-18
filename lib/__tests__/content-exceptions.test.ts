/**
 * Offline. The end-of-day content exceptions report (2026-11-17): posts past their day to post and not confirmed
 * Posted, grouped by the person assigned. Invented posts and names.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { APPROVAL_LIMIT_MS, chicagoDay, contentExceptions, exceptionsSubject, exceptionsText } from "../content-exceptions"
import { QUEUES } from "../queue-age"
import type { ContentPost } from "@/components/crm/types"

const post = (id: string, user: string, status: string, date: string, extra: Partial<ContentPost> = {}) =>
  ({ id, user, status, title: `Post ${id}`, date_to_post: date, links: [], assets: [], social_platforms: [], date_created: "", created_at: "", updated_at: "", ...extra }) as unknown as ContentPost

const TODAY = "2026-11-17"

test("approved or scheduled posts past their day are reported, by owner, newest first", () => {
  const out = contentExceptions([
    post("a", "Ana Ruiz", "approved", "2026-11-09"),
    post("b", "Ana Ruiz", "scheduled", "2026-11-13T00:00:00Z"),
    post("c", "Ben Cole", "approved", "2026-11-16"),
  ], TODAY)
  assert.deepEqual(out.map((g) => [g.owner, g.posts.map((p) => p.id)]), [["Ana Ruiz", ["b", "a"]], ["Ben Cole", ["c"]]])
})

test("posted, due today or later, archived, other statuses and pipeline cards are not reported", () => {
  const out = contentExceptions([
    post("p", "Ana Ruiz", "posted", "2026-11-09"),
    post("t", "Ana Ruiz", "approved", TODAY),
    post("f", "Ana Ruiz", "approved", "2026-11-20"),
    post("x", "Ana Ruiz", "approved", "2026-11-09", { archived: true }),
    post("d", "Ana Ruiz", "to_do", "2026-11-09"),
    post("o", "Ana Ruiz", "approved", "2026-11-09", { pipeline_outcome: { kind: "no_new_content" } as never }),
  ], TODAY)
  assert.deepEqual(out, [])
})

test("posts older than the lookback are counted, not listed; an owner with only old ones is not messaged", () => {
  const out = contentExceptions([post("old", "Ana Ruiz", "approved", "2026-10-01"), post("new", "Ana Ruiz", "approved", "2026-11-15"), post("old2", "Ben Cole", "approved", "2026-10-01")], TODAY)
  assert.deepEqual(out.map((g) => [g.owner, g.posts.length, g.older]), [["Ana Ruiz", 1, 1]])
})

test("the message names each post with its date and a link to open it", () => {
  const [g] = contentExceptions([post("a", "Ana Ruiz", "approved", "2026-11-09")], TODAY)
  const text = exceptionsText(g, "https://admin.test")
  assert.match(text, /^Hi Ana,/)
  assert.match(text, /Post a \(due 2026-11-09, still approved\): https:\/\/admin\.test\/admin\/content\?openContent=a/)
})

test("today is the Chicago day", () => {
  assert.equal(chicagoDay(Date.parse("2026-11-18T03:00:00Z")), "2026-11-17")
})

const NOW = Date.parse("2026-11-17T22:00:00Z")
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString()

test("the approval limit is the founder-review queue's", () => {
  assert.equal(APPROVAL_LIMIT_MS, QUEUES.find((q) => q.name === "founder-review")!.limitMs)
})

test("posts waiting for approval past the limit are listed by owner, longest waiting first; recent, archived and undated are not", () => {
  const out = contentExceptions([
    post("w1", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(30) }),
    post("w2", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(80) }),
    post("fresh", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(23) }),
    post("arch", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(80), archived: true }),
    post("nodate", "Ana Ruiz", "needs_approval", "", { updated_at: "" }),
  ], TODAY, NOW)
  assert.deepEqual(out.map((g) => [g.owner, g.posts.length, g.approvals.map((p) => p.id)]), [["Ana Ruiz", 0, ["w2", "w1"]]])
  assert.equal(out[0].approvals[0].waitingSince, "2026-11-14")
})

test("both kinds go in one message per owner, each under its own heading with its link", () => {
  const [g] = contentExceptions([
    post("a", "Ana Ruiz", "approved", "2026-11-09"),
    post("w", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(30) }),
  ], TODAY, NOW)
  const text = exceptionsText(g, "https://admin.test")
  assert.match(text, /confirmed Posted in the content tool:\n\n- Post a/)
  assert.match(text, /Waiting for approval for over a day:\n\n- Post w \(waiting since 2026-11-16\): https:\/\/admin\.test\/admin\/content\?openContent=w/)
  assert.equal(exceptionsSubject(g), "1 post to confirm as Posted, 1 waiting for approval over a day")
})

test("a message with only late approvals has no confirm section, and its subject says so", () => {
  const [g] = contentExceptions([post("w", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(30) }), post("v", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(40) })], TODAY, NOW)
  const text = exceptionsText(g, "https://admin.test")
  assert.doesNotMatch(text, /confirmed Posted/)
  assert.match(text, /^Hi Ana,\n\nWaiting for approval for over a day:/)
  assert.equal(exceptionsSubject(g), "2 posts waiting for approval over a day")
  assert.equal(exceptionsSubject({ ...g, owner: "" }, true), "2 posts waiting for approval over a day (assigned to no one)")
})

test("confirm-only subjects read as before, with the unassigned note", () => {
  const [g] = contentExceptions([post("a", "Ana Ruiz", "approved", "2026-11-09"), post("b", "Ana Ruiz", "approved", "2026-11-10")], TODAY, NOW)
  assert.equal(exceptionsSubject(g), "2 posts to confirm as Posted")
  assert.equal(exceptionsSubject(g, true), "2 posts to confirm as Posted (assigned to Ana Ruiz)")
})

test("nothing late of either kind means no messages", () => {
  assert.deepEqual(contentExceptions([post("fresh", "Ana Ruiz", "needs_approval", "", { updated_at: hoursAgo(2) })], TODAY, NOW), [])
})
