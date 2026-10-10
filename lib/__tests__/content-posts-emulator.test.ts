/**
 * Real Firestore query regression, never production. Start the Firestore
 * emulator, then run FIRESTORE_EMULATOR_HOST=127.0.0.1:8787
 * pnpm dlx tsx --test lib/__tests__/content-posts-emulator.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import admin from "firebase-admin"
import { createContentPost, getContentPostById, getContentPosts, invalidateCache } from "../firestore-crm"
import { CRM_COLLECTIONS } from "../../types/crm-types"

test("undated drafts survive create, reload and direct lookup; date ordering and archives are preserved", {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  // Do not accept a remote host or production project, even if local credentials
  // are present. The emulator owns this disposable demo project only.
  assert.match(process.env.FIRESTORE_EMULATOR_HOST!, /^(127\.0\.0\.1|localhost):\d+$/)
  assert.equal(admin.apps.length, 0)
  const app = admin.initializeApp({ projectId: "demo-crm-drafts" })
  const db = admin.firestore(app)
  db.settings({ ignoreUndefinedProperties: true })
  const collection = db.collection(CRM_COLLECTIONS.CONTENT_POSTS)
  const fixture = (title: string) => ({ user: "Test Producer", title, status: "to_do" as const, links: [], assets: [], social_platforms: [], date_created: "2026-10-09" })
  try {
    await db.recursiveDelete(collection)
    await Promise.all([
      collection.doc("dated-a").set({ ...fixture("Dated A"), date_to_post: "2026-10-11" }),
      collection.doc("dated-z").set({ ...fixture("Dated Z"), date_to_post: "2026-10-11" }),
      collection.doc("earlier").set({ ...fixture("Earlier"), date_to_post: "2026-10-10T12:00:00.000Z" }),
      collection.doc("null-date").set({ ...fixture("Null date"), date_to_post: null }),
      collection.doc("archived").set({ ...fixture("Archived"), archived: true }),
      collection.doc("archived-dated").set({ ...fixture("Archived dated"), date_to_post: "2026-12-01", archived: true }),
    ])
    const draft = await createContentPost({ ...fixture("Undated draft"), date_to_post: undefined })
    assert.equal(draft.date_to_post, undefined)
    // Demonstrate the actual bug: Firestore's old orderBy really omits it.
    const oldQuery = await collection.orderBy("date_to_post", "desc").get()
    assert.equal(oldQuery.docs.some(doc => doc.id === draft.id), false)

    invalidateCache(CRM_COLLECTIONS.CONTENT_POSTS)
    const posts = await getContentPosts()
    assert.deepEqual(posts.slice(0, 3).map(post => post.id), ["dated-z", "dated-a", "earlier"])
    assert.equal(posts.length, 5)
    assert.equal(posts.some(post => post.archived), false)
    assert.ok(posts.find(post => post.id === draft.id))
    assert.equal(posts.find(post => post.id === draft.id)?.date_to_post, undefined)
    assert.deepEqual(await getContentPosts(), posts, "cached reload keeps undated drafts")
    assert.equal((await getContentPostById(draft.id))?.title, "Undated draft")

    const scheduled = await createContentPost({ ...fixture("Chosen date"), date_to_post: "2026-10-12" })
    assert.equal((await collection.doc(scheduled.id).get()).data()?.date_to_post, "2026-10-12")
    assert.equal((await getContentPosts())[0].id, scheduled.id, "create invalidates the list cache")
  } finally {
    await db.recursiveDelete(collection)
    invalidateCache(CRM_COLLECTIONS.CONTENT_POSTS)
    await app.delete()
  }
})
