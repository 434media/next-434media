/**
 * Offline. The end-of-day content exceptions report (2026-11-17): posts past their day to post and not confirmed
 * Posted, grouped by the person assigned. Invented posts and names.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { chicagoDay, contentExceptions, exceptionsText } from "../content-exceptions"
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
