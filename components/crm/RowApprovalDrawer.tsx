"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, ImageUp, Link2, Loader2, Maximize2, RefreshCw, Download, Send, Undo2, Upload } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { HelpTip } from "@/components/admin/HelpTip"
import { DesignPreview } from "./DesignPreview"
import { CanvaChoice } from "./CreateTable"
import { isCanvaLink, mediaFromCanva, mediaFromFile, type MediaResult } from "./row-media"
import { CONTENT_POST_STATUS_OPTIONS, SOCIAL_PLATFORM_OPTIONS, type ContentPost, type CreateText, type SocialPlatform } from "./types"
import { CREATE_ROWS_STORE_KEY, FORMAT_LABEL, isHandPosted, type CreateFormat, type CreateRow, type RowMedia } from "@/lib/content-pipeline/create-table"
import { approvalCovers, awaitingApproval, formatOf, frozen, futureDated, goesOut, handPlatforms, isApproved, parsePages, platformsFor, publisherPlatforms, readiness, shownOf } from "@/lib/content-pipeline/row-approval"

/**
 * The approval drawer (plan v11.1 Step 3 item 2): a Create row's format variations side by side. The designs come from
 * the posts' saved exports; Open in Canva edits a design and Refresh from Canva re-exports it (never refills). Caption,
 * platforms and post date are edited here without touching a design; the title is generated, so it isn't shown as a
 * field. Approve & Schedule approves every variation that goes out together, bound to the exact files shown, from the
 * signed-in session; it stays disabled, with the reasons, until every design is attached and exported.
 *
 * Step 3 part 2: Refresh all re-exports every design that can still change; attach by link takes a canva.link share
 * link and can fill each format from chosen pages of one design; Publish now asks before posting a post dated after
 * today (scheduling is Step 5); Send back to Review withdraws an approval before anything goes out.
 *
 * Step 3 part 3: clicking a design opens it full size in a Preview, for review only; the card stays the same size.
 *
 * Step 3 part 4: Replace media swaps the photo or video in every size (a new file, or a Canva design link the app
 * exports): each template is filled again with the same card text, the posts stay in Review and the new files void any
 * approval. Attach by link is now "One-off", collapsed, for the rare finished post made outside the templates. (?) tips
 * explain the controls.
 */
interface BatchView { id: string; hash: string; revision: number; approval: { by: string; at: string } | null; revoked: boolean; claim: boolean; jobs: Record<"instagram" | "facebook", { status: string; permalink: string | null; blocker: string | null }> }
interface Variation { post: ContentPost; batch: BatchView | null }
interface RowView { variations: Variation[]; publisher: boolean }

const platformLabel = (p: string) => p === "youtube" ? "YouTube Shorts" : SOCIAL_PLATFORM_OPTIONS.find(o => o.value === p)?.label ?? p
const safeUrl = (u: string | null | undefined) => { try { const x = new URL(u ?? ""); return x.protocol === "https:" ? x.toString() : "" } catch { return "" } }
const titleOf = (p: ContentPost) => p.title.replace(/ · (Feed 4:5|Reels 9:16)/, "")
/** A variation the Run job filled from a template (Replace media re-fills it); one attached by link is a One-off. */
const fromTemplate = (p: ContentPost) => !!p.create_row_id && !!p.intake?.requestId && !p.intake.requestId.includes(":link:")
/** The browser's own copy of a row's card text, for a row made before the server kept it. */
function browserCardText(rowId: string): CreateText | undefined {
  try {
    const r = (JSON.parse(localStorage.getItem(CREATE_ROWS_STORE_KEY) ?? "[]") as CreateRow[]).find(x => x.id === rowId)
    return r ? { brand: r.brand, kind: r.kind, headline: r.headline, subHeadline: r.subHeadline, fields: r.fields } : undefined
  } catch { return undefined }
}

export function RowApprovalDrawer({ rowId, open, onClose, onChanged, onOpenDetails }: { rowId: string | null; open: boolean; onClose(): void; onChanged(): void; onOpenDetails(postId: string): void }) {
  const [view, setView] = useState<RowView | null>(null)
  const [error, setError] = useState("")
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [date, setDate] = useState("")
  const [platforms, setPlatforms] = useState<Record<string, SocialPlatform[]>>({})
  const [ai, setAi] = useState(false)
  const [realistic, setRealistic] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [link, setLink] = useState("")
  const [linkFormat, setLinkFormat] = useState<CreateFormat>("feed")
  const [linkPages, setLinkPages] = useState<Record<CreateFormat, string>>({ feed: "", reels: "" })
  const [handLinks, setHandLinks] = useState<Record<string, string>>({})
  const [oneOff, setOneOff] = useState(false)
  const [newMedia, setNewMedia] = useState<RowMedia | null>(null)
  const [mediaNote, setMediaNote] = useState<{ busy: boolean; text: string; error?: boolean } | null>(null)
  const [canvaLink, setCanvaLink] = useState("")
  const [pendingCanva, setPendingCanva] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  const take = useCallback((v: RowView) => {
    setView(v)
    const first = v.variations[0]?.post
    setCaption(first?.social_copy ?? "")
    setDate(first?.date_to_post ?? "")
    setPlatforms(Object.fromEntries(v.variations.map(x => [x.post.id, [...(x.post.social_platforms ?? [])]])))
    setReviewed(false)
  }, [])

  const load = useCallback(async () => {
    if (!rowId) return
    setError(""); setProblems([])
    try {
      const r = await fetch(`/api/admin/content/rows/${encodeURIComponent(rowId)}`, { credentials: "include", cache: "no-store" })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Could not read the row")
      take(data)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the row") }
  }, [rowId, take])
  useEffect(() => { if (open) { setView(null); setOneOff(false); setNewMedia(null); setMediaNote(null); setCanvaLink(""); setPendingCanva(""); void load() } }, [open, load])

  const call = async (label: string, method: "PATCH" | "POST", body: Record<string, unknown>) => {
    if (!rowId || busy) return
    setBusy(label); setError(""); setProblems([])
    try {
      const r = await fetch(`/api/admin/content/rows/${encodeURIComponent(rowId)}`, { method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const data = await r.json()
      if (data.variations) take(data)
      if (!r.ok) { setProblems(Array.isArray(data.problems) ? data.problems : []); throw new Error(data.error || "That didn't work") }
      if (Array.isArray(data.holds) && data.holds.length) setProblems(data.holds)
      onChanged()
      return data
    } catch (e) { setError(e instanceof Error ? e.message : "That didn't work") } finally { setBusy(null) }
  }

  const variations = useMemo(() => view?.variations ?? [], [view])
  const first = variations[0]?.post
  const captionChanged = !!first && caption !== (first.social_copy ?? ""), dateChanged = !!first && date !== (first.date_to_post ?? "")
  const changedPlatforms = Object.fromEntries(variations.filter(v => [...(platforms[v.post.id] ?? [])].sort().join() !== [...(v.post.social_platforms ?? [])].sort().join()).map(v => [v.post.id, platforms[v.post.id]]))
  const dirty = captionChanged || dateChanged || Object.keys(changedPlatforms).length > 0
  // Only what changed is sent, so a platform edit never rewrites a variation's own caption or date.
  const save = () => call("save", "PATCH", { ...(captionChanged ? { caption } : {}), ...(dateChanged ? { date } : {}), ...(Object.keys(changedPlatforms).length ? { platforms: changedPlatforms } : {}) })
  const captionsDiffer = new Set(variations.filter(v => !frozen(v.post)).map(v => v.post.social_copy ?? "")).size > 1
  const pending = variations.filter(v => awaitingApproval(v.post))
  const aiVideo = pending.some(v => publisherPlatforms(v.post).length && v.post.assets.some(a => a.kind === "video"))
  const blockers = [
    ...(dirty ? ["Save your edits first"] : []),
    ...(!pending.length && variations.length ? ["Nothing in this row is waiting for approval"] : []),
    ...pending.flatMap(v => { const why = readiness(v.post); return why ? [`${FORMAT_LABEL[formatOf(v.post)]}: ${why}`] : [] }),
    ...(pending.some(v => publisherPlatforms(v.post).length) && view && !view.publisher ? ["The publisher works on the live site only"] : []),
  ]
  // The approval binds everything shown for each variation: its files, caption, date and platforms.
  const approve = () => call("approve", "POST", { action: "approve", aiGenerated: ai, ...(ai && aiVideo ? { aiRealisticMedia: realistic } : {}), shown: Object.fromEntries(pending.map(v => [v.post.id, shownOf(v.post)])) })
  const publishable = variations.filter(v => v.batch?.approval && !v.batch.revoked && !v.batch.claim && (["instagram", "facebook"] as const).some(d => !["verified", "operator_confirmed"].includes(v.batch!.jobs[d].status)))
  // Publish now posts at once. Until scheduled publishing (Step 5), a post dated after today is published only after a
  // confirmation; the server refuses it without one.
  const early = publishable.filter(v => futureDated(v.post))
  const publishAll = async () => {
    if (early.length && !window.confirm(`This post is dated ${early[0].post.date_to_post}. Publish now posts it to Instagram and Facebook today, not on that date (scheduling on a date isn't built yet). Publish it now?`)) return
    // Stops at the first failure, so its error stays on screen.
    for (const v of publishable) if (!await call(`publish-${v.post.id}`, "POST", { action: "publish", postId: v.post.id, hash: v.batch!.hash, ...(early.length ? { early: true } : {}) })) return
  }
  // Refresh all: every design that can still change, one after another (a 9:16 MP4 render can take minutes).
  const refreshable = variations.filter(v => v.post.canva_design_id && !frozen(v.post))
  const refreshAll = async () => { for (const v of refreshable) if (!await call(`refresh-${v.post.id}`, "POST", { action: "refresh", postId: v.post.id })) return }
  // Pages per format, when one design fills several formats; a typed value that isn't page numbers blocks Attach.
  const pageEntries = (["feed", "reels"] as const).filter(f => linkPages[f].trim()).map(f => [f, parsePages(linkPages[f])] as const)
  const badPages = pageEntries.some(([, p]) => !p)
  const attach = async () => {
    const pages = Object.fromEntries(pageEntries)
    if (await call("attach", "POST", { action: "attach", designLink: link, format: linkFormat, ...(pageEntries.length ? { pages } : {}) })) { setLink(""); setLinkPages({ feed: "", reels: "" }) }
  }
  // Replace media: the new file or Canva export lands first; then every template-made size is filled again with it.
  const templated = variations.filter(v => fromTemplate(v.post))
  const replaceable = templated.length > 0 && !templated.some(v => frozen(v.post))
  const takeMedia = async (text: string, get: () => Promise<MediaResult>) => {
    setNewMedia(null); setMediaNote({ busy: true, text })
    try { const r = await get(); setNewMedia(r.media); setMediaNote({ busy: false, text: `${r.message} ${r.media.name}` }) }
    catch (e) { setMediaNote({ busy: false, text: e instanceof Error ? e.message : "That media could not be used", error: true }) }
  }
  const pasteCanva = () => { const u = canvaLink.trim(); if (!u) return; if (!isCanvaLink(u)) { setMediaNote({ busy: false, text: "Paste a Canva design link (canva.com/design/… or canva.link/…), or choose a file", error: true }); return } setCanvaLink(""); setPendingCanva(u) }
  const replaceMedia = async () => {
    if (!newMedia || !rowId) return
    if (variations.some(v => isApproved(v.post) && fromTemplate(v.post)) && !window.confirm("Replacing the media sends the approved sizes back to Review; they need approving again. Replace it?")) return
    const text = templated.find(v => v.post.create_text)?.post.create_text ?? browserCardText(rowId)
    if (await call("replace", "POST", { action: "replace-media", media: newMedia, ...(text ? { text } : {}) })) { setNewMedia(null); setMediaNote(null) }
  }
  const sendBack = async (postId: string) => {
    if (!rowId || busy) return
    setBusy(`back-${postId}`); setError(""); setProblems([])
    try {
      const r = await fetch(`/api/admin/content/posts/${encodeURIComponent(postId)}/send-back`, { method: "POST", credentials: "include" })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || "Could not send it back to Review")
      onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send it back to Review") } finally { setBusy(null); void load() }
  }

  return (
    <DetailDrawer open={open} onClose={onClose} width="xl" closeOnOverlayClick={!dirty}
      title={first ? titleOf(first) : "Approval"}
      subtitle={variations.length ? `${variations.length} variation${variations.length > 1 ? "s" : ""} from one Create row` : undefined}
      footer={view && <div className="flex flex-col gap-2">
        {blockers.length > 0 && pending.length > 0 && <ul className="text-xs text-amber-700 list-disc pl-4">{blockers.map(b => <li key={b}>{b}</li>)}</ul>}
        {pending.length > 0 && <label className="flex items-start gap-2 text-xs text-neutral-700"><input type="checkbox" className="mt-0.5" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I checked every design, the caption, platforms and date. Approving lets these exact files go out from their public links.</label>}
        <div className="flex flex-wrap items-center gap-2">
          {pending.length > 0 && <button type="button" onClick={approve} disabled={!!busy || blockers.length > 0 || !reviewed} className="inline-flex items-center gap-2 h-9 px-4 bg-neutral-900 text-white rounded-md disabled:opacity-40 text-sm font-medium">
            {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve &amp; Schedule
          </button>}
          {publishable.length > 0 && view.publisher && <button type="button" onClick={publishAll} disabled={!!busy} className="inline-flex items-center gap-2 h-9 px-4 border border-neutral-300 rounded-md disabled:opacity-40 text-sm font-medium">
            {busy?.startsWith("publish") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {early.length ? "Publish now, before its date" : "Publish now to Instagram and Facebook"}
          </button>}
          {refreshable.length > 1 && <button type="button" onClick={refreshAll} disabled={!!busy || dirty} title={dirty ? "Save your edits first" : "Re-export every design from Canva"} className="inline-flex items-center gap-2 h-9 px-3 border border-neutral-300 rounded-md disabled:opacity-40 text-sm">
            {busy?.startsWith("refresh") ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh all from Canva
          </button>}
          {refreshable.length > 1 && <HelpTip label="Refresh all from Canva">After editing designs in Canva, this pulls the latest version of every size. It never re-fills a template.</HelpTip>}
        </div>
      </div>}>
      {!view && !error && <p className="text-sm text-neutral-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading the row…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {problems.length > 0 && <ul role="status" className="mt-1 text-xs text-red-700 list-disc pl-4">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
      {view && <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {variations.map(v => <VariationCard key={v.post.id} v={v} busy={busy} dirty={dirty} showCaption={captionsDiffer} picked={platforms[v.post.id] ?? []}
            onPick={next => setPlatforms(s => ({ ...s, [v.post.id]: next }))}
            onRefresh={() => call(`refresh-${v.post.id}`, "POST", { action: "refresh", postId: v.post.id })}
            onSendBack={() => sendBack(v.post.id)}
            onDetails={() => onOpenDetails(v.post.id)}
            handLink={p => handLinks[`${v.post.id}:${p}`] ?? ""} setHandLink={(p, u) => setHandLinks(s => ({ ...s, [`${v.post.id}:${p}`]: u }))}
            onHandPost={p => call(`hand-${v.post.id}-${p}`, "POST", { action: "hand-post", postId: v.post.id, platform: p, url: handLinks[`${v.post.id}:${p}`] ?? "", fingerprint: v.post.export_fingerprint })} />)}
        </div>

        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-800"><label htmlFor="row-caption">Caption</label>
            <HelpTip label="Caption">Editing the caption never changes a design. Saving it after approval sends the row back for approval.</HelpTip></div>
          <textarea id="row-caption" value={caption} onChange={e => setCaption(e.target.value)} rows={7} maxLength={2200} className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm leading-relaxed font-normal" />
          {captionsDiffer && <p className="text-xs text-amber-700">The variations have different captions (shown on each card). Saving a caption here sets it on every variation that isn&apos;t out yet.</p>}
          <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-800"><label htmlFor="row-date">Post date</label>
            <HelpTip label="Post date">The day the post goes out. It doesn&apos;t change the date printed on the card.</HelpTip></div>
          <input id="row-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="block h-9 rounded border border-neutral-300 px-2 text-sm font-normal" />
          <button type="button" disabled={!dirty || !!busy} onClick={save} className="inline-flex items-center gap-2 h-8 px-3 border border-neutral-300 rounded-md text-sm disabled:opacity-40">
            {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
          </button>
        </section>

        {templated.length > 0 && <section className="space-y-2 border-t border-neutral-200 pt-4" aria-labelledby="replace-media">
          <div className="flex items-center gap-1.5"><h3 id="replace-media" className="text-sm font-medium text-neutral-800">Replace media</h3>
            <HelpTip label="Replace media">Swap the photo or video in every size. The app fills each template again with the same text; the posts stay in Review and need approving again.</HelpTip></div>
          {!replaceable && <p className="text-xs text-neutral-500">A size is already out or publishing, so its media can&apos;t change.</p>}
          {replaceable && <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!!busy || mediaNote?.busy} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 h-8 px-3 border border-neutral-300 rounded-md text-sm disabled:opacity-40"><Upload className="w-4 h-4" /> Choose a file</button>
              <input ref={fileInput} type="file" aria-label="New photo or video" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff,video/mp4,video/quicktime,video/x-m4v,video/webm" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void takeMedia(`Uploading ${f.name}…`, () => mediaFromFile(f)) }} />
              {!pendingCanva && <input value={canvaLink} disabled={!!busy || mediaNote?.busy} onChange={e => setCanvaLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pasteCanva() }} onBlur={pasteCanva} aria-label="Canva design link for the new media" placeholder="or paste a Canva design link" className="flex-1 min-w-48 h-8 rounded border border-neutral-300 px-2 text-sm" />}
            </div>
            {pendingCanva && <div className="text-xs"><CanvaChoice disabled={!!busy} onCancel={() => setPendingCanva("")} onPick={as => { const u = pendingCanva; setPendingCanva(""); void takeMedia(`Exporting the Canva design as ${as === "video" ? "MP4" : "JPG"}…`, () => mediaFromCanva(u, as)) }} /></div>}
            {mediaNote && <p role="status" className={`text-xs inline-flex items-center gap-1.5 ${mediaNote.error ? "text-red-700" : "text-neutral-600"}`}>{mediaNote.busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{mediaNote.text}</p>}
            {newMedia && <div className="flex items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a Blob thumbnail in the admin, not page content */}
              {newMedia.kind === "image" ? <img src={safeUrl(newMedia.url)} alt="The new photo" className="h-24 w-24 object-cover rounded border border-neutral-200" /> : <video src={safeUrl(newMedia.url)} muted playsInline controls className="h-24 w-40 object-cover rounded border border-neutral-200 bg-black" />}
              <button type="button" disabled={!!busy || dirty} title={dirty ? "Save your edits first" : ""} onClick={replaceMedia} className="inline-flex items-center gap-2 h-9 px-3 bg-neutral-900 text-white rounded-md disabled:opacity-40 text-sm font-medium">
                {busy === "replace" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />} {busy === "replace" ? "Filling every size…" : `Replace in ${templated.length > 1 ? `all ${templated.length} sizes` : "this size"}`}
              </button>
            </div>}
          </>}
        </section>}

        <section className="space-y-2 border-t border-neutral-200 pt-4">
          <div className="flex items-center gap-1.5">
            <button type="button" aria-expanded={oneOff} aria-controls="one-off-attach" onClick={() => setOneOff(v => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-neutral-800">
              {oneOff ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} One-off
            </button>
            <HelpTip label="One-off">Rare: attach a finished design made outside the templates, by its Canva link. Everyday changes use Replace media or Open in Canva.</HelpTip>
          </div>
          {oneOff && <div id="one-off-attach" className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input value={link} onChange={e => setLink(e.target.value)} aria-label="Canva design link" placeholder="https://www.canva.com/design/… or https://canva.link/…" className="flex-1 min-w-48 h-8 rounded border border-neutral-300 px-2 text-sm" />
              <select value={linkFormat} aria-label="Size" disabled={pageEntries.length > 0} onChange={e => setLinkFormat(e.target.value as CreateFormat)} className="h-8 rounded border border-neutral-300 px-1 text-sm bg-white disabled:opacity-40">
                <option value="feed">{FORMAT_LABEL.feed}</option><option value="reels">{FORMAT_LABEL.reels}</option>
              </select>
              <button type="button" disabled={!link.trim() || !!busy || dirty || badPages} onClick={attach} className="inline-flex items-center gap-1.5 h-8 px-3 border border-neutral-300 rounded-md text-sm disabled:opacity-40">
                {busy === "attach" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Attach
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-700">
              {(["feed", "reels"] as const).map(f => <label key={f} className="inline-flex items-center gap-1.5">{FORMAT_LABEL[f]} from page
                <input value={linkPages[f]} onChange={e => setLinkPages(s => ({ ...s, [f]: e.target.value }))} placeholder="e.g. 2" className={`w-20 h-7 rounded border px-1.5 ${linkPages[f].trim() && !parsePages(linkPages[f]) ? "border-red-400" : "border-neutral-300"}`} />
              </label>)}
              <HelpTip label="Pages">For a design with several pages or sizes: the page that fills each size. Leave empty for a one-page design.</HelpTip>
            </div>
          </div>}
        </section>

        {pending.some(v => publisherPlatforms(v.post).length) && <div className="space-y-1 border-t border-neutral-200 pt-4">
          <label className="flex items-start gap-2 text-xs text-neutral-700"><input type="checkbox" className="mt-0.5" checked={ai} onChange={e => setAi(e.target.checked)} />These designs contain AI-generated media (adds Meta&apos;s AI label where the API supports it)<HelpTip label="AI-generated media">Tick this if any photo, video or voice in the designs was made with AI, so the post carries Meta&apos;s AI label where it can.</HelpTip></label>
          {ai && aiVideo && <label className="flex items-start gap-2 text-xs text-neutral-700 pl-5"><input type="checkbox" className="mt-0.5" checked={realistic} onChange={e => setRealistic(e.target.checked)} />The AI video is photorealistic or has realistic-sounding audio (Meta requires disclosure for these)</label>}
        </div>}
      </div>}
    </DetailDrawer>
  )
}

function VariationCard({ v, busy, dirty, showCaption, picked, onPick, onRefresh, onSendBack, onDetails, handLink, setHandLink, onHandPost }: {
  v: Variation; busy: string | null; dirty: boolean; showCaption: boolean; picked: SocialPlatform[]; onPick(next: SocialPlatform[]): void; onRefresh(): void; onSendBack(): void; onDetails(): void
  handLink(p: string): string; setHandLink(p: string, url: string): void; onHandPost(p: string): void
}) {
  const { post, batch } = v
  const format = formatOf(post), status = CONTENT_POST_STATUS_OPTIONS.find(s => s.value === post.status)
  const why = awaitingApproval(post) ? readiness(post) : null, out = frozen(post)
  const canvaUrl = post.canva_design_id ? `https://www.canva.com/design/${encodeURIComponent(post.canva_design_id)}/edit` : ""
  const posted = (p: string) => post.hand_posts?.find(h => h.platform === p)
  const [preview, setPreview] = useState<number | null>(null)
  return (
    <div className="rounded-md ring-1 ring-neutral-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium inline-flex items-center gap-1.5">{FORMAT_LABEL[format]}<HelpTip label={FORMAT_LABEL[format]}>{format === "feed" ? "The 4:5 design, for the Instagram and Facebook feeds and LinkedIn." : "The 9:16 design, for Reels, TikTok and YouTube Shorts."}{fromTemplate(post) ? "" : " This one was attached by link (One-off)."}</HelpTip></p>
        {status && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: status.color }}>{status.label}</span>}
      </div>
      <div className={`grid gap-1 ${post.assets.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {post.assets.length ? post.assets.map((a, i) => a.kind === "video"
          // The video keeps its own controls on the card, so Preview is a corner button rather than the whole video.
          ? <div key={a.url} className="relative">
              <video src={safeUrl(a.url)} controls playsInline className="w-full max-h-80 rounded bg-neutral-100 object-contain" />
              <button type="button" onClick={() => setPreview(i)} aria-label={`Preview ${FORMAT_LABEL[format]} video`} title="Preview" className="absolute top-1 right-1 grid place-items-center h-7 w-7 rounded bg-black/55 text-white hover:bg-black/75"><Maximize2 className="w-3.5 h-3.5" /></button>
            </div>
          : <button key={a.url} type="button" onClick={() => setPreview(i)} aria-label={`Preview ${FORMAT_LABEL[format]} design, page ${i + 1}`} title="Preview" className="group relative block w-full self-start rounded cursor-zoom-in focus-visible:outline-2 focus-visible:outline-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={safeUrl(a.url)} alt={`${FORMAT_LABEL[format]} design, page ${i + 1}`} className="w-full max-h-80 rounded bg-neutral-100 object-contain" />
              <span aria-hidden="true" className="absolute top-1 right-1 grid place-items-center h-7 w-7 rounded bg-black/55 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 className="w-3.5 h-3.5" /></span>
            </button>)
          : <div className="h-40 rounded bg-neutral-100 grid place-items-center text-xs text-neutral-500">No design exported yet</div>}
      </div>
      <DesignPreview assets={post.assets} index={preview} label={FORMAT_LABEL[format]} onIndex={setPreview} onClose={() => setPreview(null)} />
      <div className="flex flex-wrap gap-2 text-xs">
        {canvaUrl && <a href={canvaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><ExternalLink className="w-3.5 h-3.5" /> Open in Canva</a>}
        {post.canva_design_id && <button type="button" onClick={onRefresh} disabled={!!busy || dirty || out} title={dirty ? "Save your edits first" : out ? "Already out" : ""} className="inline-flex items-center gap-1 underline disabled:opacity-40">
          {busy === `refresh-${post.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh from Canva</button>}
        {post.canva_design_id && <HelpTip label="Refresh from Canva">Pulls this design again after you edit it in Canva. The text and media you set there are what goes out.</HelpTip>}
        {isApproved(post) && !out && <button type="button" onClick={onSendBack} disabled={!!busy} title="Withdraw the approval; nothing has gone out" className="inline-flex items-center gap-1 underline disabled:opacity-40">
          {busy === `back-${post.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Send back to Review</button>}
        <button type="button" onClick={onDetails} className="underline text-neutral-500">All details</button>
      </div>
      <fieldset className="space-y-0.5">
        <legend className="text-xs font-medium text-neutral-700 inline-flex items-center gap-1.5">Platforms<HelpTip label="Platforms">Where this size goes. Untick all and it stays in Review. Save changes to keep them.</HelpTip></legend>
        {platformsFor(format).map(p => (
          <label key={p} className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" disabled={out} checked={picked.includes(p)} onChange={e => onPick(e.target.checked ? [...picked, p] : picked.filter(x => x !== p))} />
            {platformLabel(p)}{isHandPosted(p) && <span className="text-neutral-400">· posted by hand</span>}
          </label>
        ))}
        {!goesOut(post) && <p className="text-xs text-neutral-500">No platforms ticked: this variation stays in Review and isn&apos;t approved with the row.</p>}
      </fieldset>
      {showCaption && <p className="text-xs text-neutral-600 whitespace-pre-wrap line-clamp-4 border-l-2 border-neutral-200 pl-2">{post.social_copy || "No caption"}</p>}
      {why && <p className="text-xs text-amber-700">{why}</p>}
      {batch && <div className="text-xs space-y-0.5">
        {batch.approval && <p className="text-neutral-600">Approved by {batch.approval.by} · version {batch.hash.slice(0, 12)}</p>}
        {(["instagram", "facebook"] as const).map(d => <p key={d}>{d === "instagram" ? "Instagram" : "Facebook"}: {batch.jobs[d].status}{batch.jobs[d].permalink && <> · <a className="underline" href={safeUrl(batch.jobs[d].permalink)} target="_blank" rel="noreferrer">live post</a></>}{batch.jobs[d].blocker && <span className="text-amber-700"> · {batch.jobs[d].blocker}</span>}</p>)}
      </div>}
      {approvalCovers(post) && handPlatforms(post).length > 0 && <div className="space-y-1.5 border-t border-neutral-100 pt-2">
        <p className="text-xs font-medium text-neutral-700 inline-flex items-center gap-1.5">Post by hand<HelpTip label="Post by hand">Download the files, post them yourself, then paste each live post&apos;s link and Record it.</HelpTip></p>
        <div className="flex flex-wrap gap-2 text-xs">{post.assets.map((a, i) => <a key={a.url} href={safeUrl(a.url) && `${safeUrl(a.url)}?download=1`} download className="inline-flex items-center gap-1 underline"><Download className="w-3.5 h-3.5" /> {a.kind === "video" ? "Video" : `Page ${i + 1}`}</a>)}</div>
        {handPlatforms(post).map(p => posted(p)
          ? <p key={p} className="text-xs">{platformLabel(p)}: <a className="underline" href={safeUrl(posted(p)!.url)} target="_blank" rel="noreferrer">live post</a></p>
          : <div key={p} className="flex gap-1">
              <input value={handLink(p)} onChange={e => setHandLink(p, e.target.value)} placeholder={`${platformLabel(p)} post link`} className="flex-1 h-7 rounded border border-neutral-300 px-1.5 text-xs" />
              <button type="button" disabled={!handLink(p).trim() || !!busy || dirty} onClick={() => onHandPost(p)} className="h-7 px-2 border border-neutral-300 rounded text-xs disabled:opacity-40">Record</button>
            </div>)}
      </div>}
    </div>
  )
}
