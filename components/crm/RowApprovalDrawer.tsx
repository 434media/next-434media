"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw, Download, Send } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { CONTENT_POST_STATUS_OPTIONS, SOCIAL_PLATFORM_OPTIONS, type ContentPost, type SocialPlatform } from "./types"
import { FORMAT_LABEL, isHandPosted, type CreateFormat } from "@/lib/content-pipeline/create-table"
import { approvalCovers, awaitingApproval, formatOf, frozen, goesOut, handPlatforms, platformsFor, publisherPlatforms, readiness, shownOf } from "@/lib/content-pipeline/row-approval"

/**
 * The approval drawer (plan v11.1 Step 3 item 2): a Create row's format variations side by side. The designs come from
 * the posts' saved exports; Open in Canva edits a design and Refresh from Canva re-exports it (never refills). Caption,
 * platforms and post date are edited here without touching a design; the title is generated, so it isn't shown as a
 * field. Approve & Schedule approves every variation that goes out together, bound to the exact files shown, from the
 * signed-in session; it stays disabled, with the reasons, until every design is attached and exported.
 */
interface BatchView { id: string; hash: string; revision: number; approval: { by: string; at: string } | null; revoked: boolean; claim: boolean; jobs: Record<"instagram" | "facebook", { status: string; permalink: string | null; blocker: string | null }> }
interface Variation { post: ContentPost; batch: BatchView | null }
interface RowView { variations: Variation[]; publisher: boolean }

const platformLabel = (p: string) => p === "youtube" ? "YouTube Shorts" : SOCIAL_PLATFORM_OPTIONS.find(o => o.value === p)?.label ?? p
const safeUrl = (u: string | null | undefined) => { try { const x = new URL(u ?? ""); return x.protocol === "https:" ? x.toString() : "" } catch { return "" } }
const titleOf = (p: ContentPost) => p.title.replace(/ · (Feed 4:5|Reels 9:16)/, "")

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
  const [handLinks, setHandLinks] = useState<Record<string, string>>({})

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
  useEffect(() => { if (open) { setView(null); void load() } }, [open, load])

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
  const publishable = variations.filter(v => v.batch?.approval && !v.batch.claim && (["instagram", "facebook"] as const).some(d => !["verified", "operator_confirmed"].includes(v.batch!.jobs[d].status)))
  // Stops at the first failure, so its error stays on screen.
  const publishAll = async () => { for (const v of publishable) if (!await call(`publish-${v.post.id}`, "POST", { action: "publish", postId: v.post.id, hash: v.batch!.hash })) return }

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
            {busy?.startsWith("publish") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish now to Instagram and Facebook
          </button>}
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
            onDetails={() => onOpenDetails(v.post.id)}
            handLink={p => handLinks[`${v.post.id}:${p}`] ?? ""} setHandLink={(p, u) => setHandLinks(s => ({ ...s, [`${v.post.id}:${p}`]: u }))}
            onHandPost={p => call(`hand-${v.post.id}-${p}`, "POST", { action: "hand-post", postId: v.post.id, platform: p, url: handLinks[`${v.post.id}:${p}`] ?? "", fingerprint: v.post.export_fingerprint })} />)}
        </div>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-neutral-800">Caption
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={7} maxLength={2200} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm leading-relaxed font-normal" />
          </label>
          {captionsDiffer && <p className="text-xs text-amber-700">The variations have different captions (shown on each card). Saving a caption here sets it on every variation that isn&apos;t out yet.</p>}
          <p className="text-xs text-neutral-500">Editing the caption never changes a design. Saving it after approval sends the row back for approval.</p>
          <label className="block text-sm font-medium text-neutral-800">Post date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block h-9 rounded border border-neutral-300 px-2 text-sm font-normal" />
          </label>
          <button type="button" disabled={!dirty || !!busy} onClick={save} className="inline-flex items-center gap-2 h-8 px-3 border border-neutral-300 rounded-md text-sm disabled:opacity-40">
            {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
          </button>
        </section>

        <section className="space-y-2 border-t border-neutral-200 pt-4">
          <h3 className="text-sm font-medium text-neutral-800">Attach a Canva design by link</h3>
          <div className="flex flex-wrap gap-2">
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://www.canva.com/design/…" className="flex-1 min-w-48 h-8 rounded border border-neutral-300 px-2 text-sm" />
            <select value={linkFormat} onChange={e => setLinkFormat(e.target.value as CreateFormat)} className="h-8 rounded border border-neutral-300 px-1 text-sm bg-white">
              <option value="feed">{FORMAT_LABEL.feed}</option><option value="reels">{FORMAT_LABEL.reels}</option>
            </select>
            <button type="button" disabled={!link.trim() || !!busy || dirty} onClick={async () => { if (await call("attach", "POST", { action: "attach", designLink: link, format: linkFormat })) setLink("") }} className="inline-flex items-center gap-1.5 h-8 px-3 border border-neutral-300 rounded-md text-sm disabled:opacity-40">
              {busy === "attach" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Attach
            </button>
          </div>
          <p className="text-xs text-neutral-500">The design is exported and added to this row as its own variation (or fills a variation that has no design yet).</p>
        </section>

        {pending.some(v => publisherPlatforms(v.post).length) && <div className="space-y-1 border-t border-neutral-200 pt-4">
          <label className="flex items-start gap-2 text-xs text-neutral-700"><input type="checkbox" className="mt-0.5" checked={ai} onChange={e => setAi(e.target.checked)} />These designs contain AI-generated media (adds Meta&apos;s AI label where the API supports it)</label>
          {ai && aiVideo && <label className="flex items-start gap-2 text-xs text-neutral-700 pl-5"><input type="checkbox" className="mt-0.5" checked={realistic} onChange={e => setRealistic(e.target.checked)} />The AI video is photorealistic or has realistic-sounding audio (Meta requires disclosure for these)</label>}
        </div>}
      </div>}
    </DetailDrawer>
  )
}

function VariationCard({ v, busy, dirty, showCaption, picked, onPick, onRefresh, onDetails, handLink, setHandLink, onHandPost }: {
  v: Variation; busy: string | null; dirty: boolean; showCaption: boolean; picked: SocialPlatform[]; onPick(next: SocialPlatform[]): void; onRefresh(): void; onDetails(): void
  handLink(p: string): string; setHandLink(p: string, url: string): void; onHandPost(p: string): void
}) {
  const { post, batch } = v
  const format = formatOf(post), status = CONTENT_POST_STATUS_OPTIONS.find(s => s.value === post.status)
  const why = awaitingApproval(post) ? readiness(post) : null, out = frozen(post)
  const canvaUrl = post.canva_design_id ? `https://www.canva.com/design/${encodeURIComponent(post.canva_design_id)}/edit` : ""
  const posted = (p: string) => post.hand_posts?.find(h => h.platform === p)
  return (
    <div className="rounded-md ring-1 ring-neutral-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{FORMAT_LABEL[format]}</p>
        {status && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: status.color }}>{status.label}</span>}
      </div>
      <div className={`grid gap-1 ${post.assets.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {post.assets.length ? post.assets.map((a, i) => a.kind === "video"
          ? <video key={a.url} src={safeUrl(a.url)} controls playsInline className="w-full max-h-80 rounded bg-neutral-100 object-contain" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={a.url} src={safeUrl(a.url)} alt={`${FORMAT_LABEL[format]} design, page ${i + 1}`} className="w-full max-h-80 rounded bg-neutral-100 object-contain" />)
          : <div className="h-40 rounded bg-neutral-100 grid place-items-center text-xs text-neutral-500">No design exported yet</div>}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {canvaUrl && <a href={canvaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><ExternalLink className="w-3.5 h-3.5" /> Open in Canva</a>}
        {post.canva_design_id && <button type="button" onClick={onRefresh} disabled={!!busy || dirty || out} title={dirty ? "Save your edits first" : out ? "Already out" : ""} className="inline-flex items-center gap-1 underline disabled:opacity-40">
          {busy === `refresh-${post.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh from Canva</button>}
        <button type="button" onClick={onDetails} className="underline text-neutral-500">All details</button>
      </div>
      <fieldset className="space-y-0.5">
        <legend className="text-xs font-medium text-neutral-700">Platforms</legend>
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
        <p className="text-xs font-medium text-neutral-700">Post by hand</p>
        <div className="flex flex-wrap gap-2 text-xs">{post.assets.map((a, i) => <a key={a.url} href={safeUrl(a.url)} download className="inline-flex items-center gap-1 underline"><Download className="w-3.5 h-3.5" /> {a.kind === "video" ? "Video" : `Page ${i + 1}`}</a>)}</div>
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
