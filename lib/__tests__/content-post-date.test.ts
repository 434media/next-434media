/** Actual controlled form + save hook, with offline HTTP responses. */
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { act, createElement, type ReactNode } from "react"
import type { ContentPost } from "../../components/crm/types"
import type { useContentPostHandlers } from "../../hooks/useContentPostHandlers"

// Load React DOM only after the DOM exists, and install module fixtures before the page.
const load = createRequire(__filename)
const { JSDOM } = load("jsdom")
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = load("react-dom/client") as typeof import("react-dom/client")
function mockModule(path: string, exports: unknown) {
  const filename = load.resolve(path)
  load.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeModule
}
mockModule("../../hooks/useTeamMembers", { useTeamMembers: () => ({ members: [], isLoading: false }) })
mockModule("../../components/admin/DetailDrawer", { DetailDrawer: ({ open, children, footer }: { open: boolean; children: ReactNode; footer: ReactNode }) => open ? createElement("div", null, children, footer) : null })
mockModule("../../components/crm/GeneratePanel", { GeneratePanel: () => null })
mockModule("../../components/crm/AssetLibraryPicker", { AssetLibraryPicker: () => null })
const { ContentDetailDrawer } = load("../../components/crm/ContentDetailDrawer") as typeof import("../../components/crm/ContentDetailDrawer")
const { useContentPostHandlers: useHandlers } = load("../../hooks/useContentPostHandlers") as { useContentPostHandlers: typeof useContentPostHandlers }
after(() => dom.window.close())

test("date change survives rerenders and delayed asset upload, reaches save, and reopens from the saved record", async () => {
  const originalFetch = globalThis.fetch
  const post: ContentPost = { id: "draft", user: "Producer", title: "Test draft", status: "to_do", links: [], assets: [], social_platforms: [], date_created: "2026-10-10", created_at: "2026-10-10", updated_at: "2026-10-10" }
  let state!: ReturnType<typeof useHandlers>
  let saved!: ContentPost
  let finishUpload!: (value: Response) => void
  const upload = new Promise<Response>(resolve => { finishUpload = resolve })
  const setToast = () => {}
  globalThis.fetch = async (input, options) => {
    if (String(input) === "/api/upload/crm") return upload
    assert.equal(String(input), "/api/admin/crm/content-posts?id=draft")
    assert.equal(options?.method, "PUT")
    saved = { ...post, ...JSON.parse(String(options?.body)) }
    return new Response(JSON.stringify({ post: saved }))
  }
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  const Harness = () => {
    state = useHandlers({ setToast })
    return createElement(ContentDetailDrawer, { open: state.showContentPostForm, post: state.editingContentPost, isSaving: state.isSavingContentPost, onSave: state.handleSaveContentPost, onClose: () => state.setShowContentPostForm(false) })
  }
  try {
    await act(async () => root.render(createElement(Harness)))
    await act(async () => { state.setContentPosts([post]); state.handleOpenContentPost(post) })
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new dom.window.File(["image bytes"], "test.png", { type: "image/png" })] })
    await act(async () => fileInput.dispatchEvent(new dom.window.Event("change", { bubbles: true })))
    const dateInput = container.querySelector<HTMLInputElement>('#content-date-to-post')!
    assert.equal(container.querySelector('label[for="content-date-to-post"]')?.textContent, "Date to Post")
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(dateInput, "2026-10-12")
      dateInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
      dateInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }))
    })
    await act(async () => root.render(createElement(Harness)))
    assert.equal(dateInput.value, "2026-10-12", "controlled date survives a parent rerender")
    await act(async () => { finishUpload(new Response(JSON.stringify({ url: "https://example.test/upload.png" }))) })
    assert.equal(dateInput.value, "2026-10-12", "late upload does not overwrite the date")
    const saveButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "Save Changes")!
    await act(async () => saveButton.click())
    assert.equal(saved.date_to_post, "2026-10-12")
    assert.equal(saved.assets?.length, 1)
    assert.equal(state.showContentPostForm, false)
    await act(async () => state.handleOpenContentPost(state.contentPosts[0]))
    assert.equal(container.querySelector<HTMLInputElement>('#content-date-to-post')!.value, "2026-10-12")
  } finally {
    await act(async () => root.unmount())
    container.remove()
    globalThis.fetch = originalFetch
  }
})
