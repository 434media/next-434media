/**
 * Offline. Unsubscribe links survive a rotation of UNSUBSCRIBE_SECRET: a link signed with the old secret still verifies
 * while UNSUBSCRIBE_SECRET_PREVIOUS holds it, new links are signed with the new secret only, and nothing else verifies.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { signUnsubscribe, verifyUnsubscribe } from "../unsubscribe-token"

function withSecrets<T>(current: string, previous: string | undefined, fn: () => T): T {
  const saved = { c: process.env.UNSUBSCRIBE_SECRET, p: process.env.UNSUBSCRIBE_SECRET_PREVIOUS }
  process.env.UNSUBSCRIBE_SECRET = current
  if (previous === undefined) delete process.env.UNSUBSCRIBE_SECRET_PREVIOUS
  else process.env.UNSUBSCRIBE_SECRET_PREVIOUS = previous
  try {
    return fn()
  } finally {
    if (saved.c === undefined) delete process.env.UNSUBSCRIBE_SECRET
    else process.env.UNSUBSCRIBE_SECRET = saved.c
    if (saved.p === undefined) delete process.env.UNSUBSCRIBE_SECRET_PREVIOUS
    else process.env.UNSUBSCRIBE_SECRET_PREVIOUS = saved.p
  }
}

const email = "Reader@Example.com "

test("a link signed before rotation verifies while the old secret is UNSUBSCRIBE_SECRET_PREVIOUS", () => {
  const oldToken = withSecrets("old-secret", undefined, () => signUnsubscribe(email))
  assert.equal(withSecrets("new-secret", "old-secret", () => verifyUnsubscribe(email, oldToken)), true)
  assert.equal(withSecrets("new-secret", undefined, () => verifyUnsubscribe(email, oldToken)), false)
})

test("new links are signed with the current secret only", () => {
  const fresh = withSecrets("new-secret", "old-secret", () => signUnsubscribe(email))
  assert.equal(fresh, withSecrets("new-secret", undefined, () => signUnsubscribe(email)))
  assert.equal(withSecrets("new-secret", undefined, () => verifyUnsubscribe(email, fresh)), true)
})

test("a wrong, empty or wrong-length token never verifies", () => {
  withSecrets("new-secret", "old-secret", () => {
    const other = signUnsubscribe("someone@else.com")
    assert.equal(verifyUnsubscribe(email, other), false)
    assert.equal(verifyUnsubscribe(email, ""), false)
    assert.equal(verifyUnsubscribe(email, "abc"), false)
    assert.equal(verifyUnsubscribe("", signUnsubscribe(email)), false)
  })
})
