/**
 * Offline. The posted date given on "Mark as posted" or a correction (2026-11-17: two News posts marked a week late
 * were dated the day of the click, and the ICYMI left them out of their week).
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { postedDateFrom } from "../content-post-guards"

const NOW = Date.parse("2026-11-17T15:00:00Z")

test("a calendar day lands at noon UTC on that day", () => {
  assert.deepEqual(postedDateFrom("2026-11-09", NOW), { at: "2026-11-09T12:00:00.000Z" })
})

test("a full ISO time is kept", () => {
  assert.deepEqual(postedDateFrom("2026-11-10T18:30:00Z", NOW), { at: "2026-11-10T18:30:00.000Z" })
})

test("unreadable, too old, future or blank dates are refused", () => {
  for (const bad of ["soon", "2019-12-31", "2026-11-20", "", 42]) assert.ok("error" in postedDateFrom(bad, NOW), String(bad))
})
