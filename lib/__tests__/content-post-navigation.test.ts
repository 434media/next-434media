/** React DOM regression tests. Run: pnpm dlx tsx --test lib/__tests__/content-post-navigation.test.ts */
import { after, afterEach, test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { act, createElement, type ReactNode } from "react"
import type { ContentPost } from "../../components/crm/types"
import type { useContentPostHandlers } from "../../hooks/useContentPostHandlers"

// Load React DOM only after the DOM exists, and install module fixtures before the page.
const load = createRequire(__filename)
const { JSDOM } = load("jsdom")
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/admin/content" })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = load("react-dom/client") as typeof import("react-dom/client")
const originalFetch = globalThis.fetch
const roots: ReturnType<typeof createRoot>[] = []
const fixture = (id: string): ContentPost => ({ id, user: "Producer", title: id, status: "to_do", links: [], assets: [], social_platforms: [], date_created: "2026-10-10", created_at: "2026-10-10", updated_at: "2026-10-10" })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const deferred = () => {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(r => { resolve = r })
  return { promise, resolve }
}
async function mount(component: () => ReactNode) {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => root.render(createElement(component)))
  return root
}
afterEach(async () => {
  await act(async () => { for (const root of roots.splice(0)) root.unmount() })
  document.body.innerHTML = ""
  globalThis.fetch = originalFetch
})
after(() => dom.window.close())

test("notification ID lookup uses the single-record endpoint for empty and stale lists", async () => {
  const { useContentPostHandlers: useHandlers } = load("../../hooks/useContentPostHandlers") as { useContentPostHandlers: typeof useContentPostHandlers }
  let state!: ReturnType<typeof useHandlers>
  const toasts: unknown[] = []
  const setToast = (value: unknown) => { toasts.push(value) }
  await mount(() => { state = useHandlers({ setToast }); return null })
  const urls: string[] = []
  globalThis.fetch = async input => { urls.push(String(input)); return response({ post: fixture("missing/id") }) }
  for (const list of [[], [fixture("stale")]]) {
    await act(async () => state.setContentPosts(list))
    await act(async () => state.handleOpenContentPostFromNotification("missing/id"))
    assert.equal(state.editingContentPost?.id, "missing/id")
    assert.equal(state.showContentPostForm, true)
  }
  assert.deepEqual(urls, ["/api/admin/crm/content-posts?id=missing%2Fid", "/api/admin/crm/content-posts?id=missing%2Fid"])
  assert.deepEqual(toasts, [])
})

test("late notification responses cannot beat a newer open, Close, create or unmount", async () => {
  const { useContentPostHandlers: useHandlers } = load("../../hooks/useContentPostHandlers") as { useContentPostHandlers: typeof useContentPostHandlers }
  let state!: ReturnType<typeof useHandlers>
  const toasts: unknown[] = []
  const setToast = (value: unknown) => { toasts.push(value) }
  const root = await mount(() => { state = useHandlers({ setToast }); return null })
  for (const action of ["newer", "close", "create", "unmount"]) {
    const pending = deferred()
    let signal: AbortSignal | undefined
    globalThis.fetch = async (_input, options) => { signal = options?.signal ?? undefined; return pending.promise }
    let opening!: Promise<void>
    await act(async () => { opening = state.handleOpenContentPostFromNotification("late") })
    await act(async () => {
      if (action === "newer") state.handleOpenContentPost(fixture("newer"))
      if (action === "close") { state.cancelPendingContentPostOpen(); state.setShowContentPostForm(false); state.setEditingContentPost(null) }
      if (action === "create") state.handleAddContentPost()
      if (action === "unmount") { root.unmount(); roots.splice(roots.indexOf(root), 1) }
    })
    assert.equal(signal?.aborted, true)
    // Deliberately ignore abort in the transport to prove the identity guard.
    await act(async () => { pending.resolve(response({ post: fixture("late") })); await opening })
    assert.notEqual(state.editingContentPost?.id, "late")
    if (action === "close") assert.equal(state.showContentPostForm, false)
  }
  assert.deepEqual(toasts, [])
})

test("missing, archived and mismatched records report an error without opening", async () => {
  const { useContentPostHandlers: useHandlers } = load("../../hooks/useContentPostHandlers") as { useContentPostHandlers: typeof useContentPostHandlers }
  let state!: ReturnType<typeof useHandlers>
  const toasts: unknown[] = []
  const setToast = (value: unknown) => { toasts.push(value) }
  await mount(() => { state = useHandlers({ setToast }); return null })
  for (const result of [response({}, 404), response({ post: { ...fixture("target"), archived: true } }), response({ post: fixture("wrong") }), response({}, 403)]) {
    globalThis.fetch = async () => result
    await act(async () => state.handleOpenContentPostFromNotification("target"))
    assert.equal(state.showContentPostForm, false)
  }
  assert.equal(toasts.length, 4)
})

// Exercise the actual page's URL effect and close/save guards. Only visual
// children and the Next router are replaced; the production hook is retained.
let params = new URLSearchParams()
let drawer!: { open: boolean; post: ContentPost | null; onClose: () => void; onSave: (post: Partial<ContentPost>) => Promise<void>; onDelete: (id: string) => Promise<void> }
let board!: { onOpenPost: (post: ContentPost) => void; onAddPost: () => void; onMovePost: (id: string, status: ContentPost["status"]) => Promise<void> }
const replacements: string[] = []
const router = { replace: (url: string) => { replacements.push(url) } }
function mockModule(path: string, exports: unknown) {
  const filename = load.resolve(path)
  load.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule
}
mockModule("next/navigation", { useSearchParams: () => params, useRouter: () => router, usePathname: () => "/admin/content" })
mockModule("../../components/AdminRoleGuard", { AdminRoleGuard: ({ children }: { children: ReactNode }) => children })
mockModule("../../components/crm", {
  Toast: () => null,
  SocialCalendarView: (props: typeof board) => { board = props; return null },
  ContentDetailDrawer: (props: typeof drawer) => { drawer = props; return null },
})
const ContentPage = load("../../app/admin/content/page").default

test("deep link opens with an empty board; Close and save survive list refresh before URL replacement", async () => {
  params = new URLSearchParams("openContent=undated")
  replacements.length = 0
  globalThis.fetch = async (input, options) => {
    if (String(input) === "/api/auth/session") return response({ authenticated: false })
    if (options?.method === "PUT") return response({ post: fixture("undated") })
    if (String(input).includes("?id=")) return response({ post: fixture("undated") })
    return response({ posts: [] })
  }
  const root = await mount(ContentPage)
  assert.equal(drawer.post?.id, "undated")
  assert.equal(drawer.open, true)
  await act(async () => drawer.onClose())
  assert.equal(drawer.open, false)
  assert.equal(replacements.at(-1), "/admin/content")
  await act(async () => root.render(createElement(ContentPage)))
  assert.equal(drawer.open, false)
  // Apply the pending URL replacement, then revisit via browser Forward.
  params = new URLSearchParams()
  await act(async () => root.render(createElement(ContentPage)))
  params = new URLSearchParams("openContent=undated")
  await act(async () => root.render(createElement(ContentPage)))
  assert.equal(drawer.open, true)
  await act(async () => drawer.onSave({ title: "Updated", date_to_post: "2026-10-12" }))
  assert.equal(drawer.open, false, "post-save reload cannot reopen the old URL")
})

test("new URL and Back cancel old deep-link responses, even when fetch ignores abort", async () => {
  const pending = deferred()
  params = new URLSearchParams("openContent=old")
  globalThis.fetch = async input => {
    if (String(input) === "/api/auth/session") return response({ authenticated: false })
    if (String(input).includes("id=old")) return pending.promise
    if (String(input).includes("id=new")) return response({ post: fixture("new") })
    return response({ posts: [fixture("unrelated")] })
  }
  const root = await mount(ContentPage)
  params = new URLSearchParams("openContent=new")
  await act(async () => root.render(createElement(ContentPage)))
  assert.equal(drawer.post?.id, "new")
  params = new URLSearchParams()
  await act(async () => root.render(createElement(ContentPage)))
  await act(async () => { pending.resolve(response({ post: fixture("old") })) })
  assert.equal(drawer.open, false)
  assert.equal(drawer.post, null)
})

test("successful delete clears the deep link and does not fetch or reopen the deleted record", async () => {
  params = new URLSearchParams("openContent=deleted")
  replacements.length = 0
  let deleted = false
  let readsAfterDelete = 0
  globalThis.fetch = async (input, options) => {
    if (String(input) === "/api/auth/session") return response({ authenticated: false })
    if (options?.method === "DELETE") { deleted = true; return response({ success: true }) }
    if (String(input).includes("?id=")) {
      if (deleted) readsAfterDelete++
      // Even a stale successful ID response must not reopen the drawer.
      return response({ post: fixture("deleted") })
    }
    return response({ posts: deleted ? [] : [fixture("deleted")] })
  }
  await mount(ContentPage)
  assert.equal(drawer.open, true)
  await act(async () => drawer.onDelete("deleted"))
  assert.equal(drawer.open, false)
  assert.equal(drawer.post, null)
  assert.equal(readsAfterDelete, 0)
  assert.equal(replacements.at(-1), "/admin/content")
})

for (const choice of ["open", "create"]) {
  test(`direct ${choice} beats a stale URL when an in-flight board move refreshes the list`, async () => {
    params = new URLSearchParams("openContent=missing")
    const lookup = deferred()
    const move = deferred()
    let lookups = 0
    globalThis.fetch = async (input, options) => {
      if (String(input) === "/api/auth/session") return response({ authenticated: false })
      if (options?.method === "PUT") return move.promise
      if (String(input).includes("?id=missing")) { lookups++; return lookup.promise }
      return response({ posts: [fixture("newer")] })
    }
    await mount(ContentPage)
    let moving!: Promise<void>
    await act(async () => { moving = board.onMovePost("newer", "in_progress") })
    await act(async () => {
      if (choice === "open") board.onOpenPost(fixture("newer"))
      else board.onAddPost()
    })
    const beforeRefresh = lookups
    // The router deliberately still exposes the old URL here.
    await act(async () => { move.resolve(response({ post: { ...fixture("newer"), status: "in_progress" } })); await moving })
    assert.equal(lookups, beforeRefresh, "stale URL must not launch another winning lookup")
    await act(async () => { lookup.resolve(response({ post: fixture("missing") })) })
    assert.equal(drawer.open, true)
    assert.equal(drawer.post?.id ?? null, choice === "open" ? "newer" : null)
  })
}
