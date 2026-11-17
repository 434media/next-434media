import { BRAND } from "./brand"
import type { ModelCall } from "./model"
import type { RequestKind } from "./profile"
import type { Story } from "./store"
import { confirmPhoto, researchStories, storiesInFlight, type WorkerDeps } from "./worker"

/**
 * The morning story list (434 build sequence V1 item 0, "A daily story list for the MilCityUSA producer"; founder,
 * 2026-11-17). Each weekday morning the content engine's existing research job runs under the brand's published
 * profile and finds 3 to 5 story candidates, each with its primary source, research's one line on why it fits, and the
 * photo lead photo first found for it. The producer picks one and works it in Create as she does today: nothing here
 * drafts, designs, writes a post or changes a job. It runs inside withProfile() (the caller's), like every entry point.
 */
export const LIST_COUNT = 5
export const LIST_MIN = 3
/** Stories already sent in the last few lists: research is steered away from them, and their URLs are refused. */
export interface SentStories { titles: string[]; urls: string[] }
export interface ListedStory {
  title: string
  url: string
  publisher: string
  publishedAt?: string
  why: string
  /** The licensed photo photo first confirmed for the subject, or why none was found (or checked). */
  photo: { url: string; pageUrl: string; credit: string } | { none: string }
}
export interface StoryList { kind: RequestKind; stories: ListedStory[]; hold?: string; calls: ModelCall[] }

/** The kind the list researches: News where the brand has it (the everyday story), else its first researched kind. */
export function listKind(): RequestKind | null {
  const researched = BRAND.requestKinds.filter(k => k.kind !== "icymi" && BRAND.research.kinds[k.kind]).map(k => k.kind)
  return researched.includes("news") ? "news" : researched[0] ?? null
}

/**
 * Research once (and once more, steered away from what was dropped, as a job does), then photo first on each story
 * while the budget lasts. A story whose photo check runs out of time or finds nothing still goes on the list, with
 * that said: the producer finds video and photos herself today, so a lead is help, not a gate.
 */
export async function buildStoryList(deps: WorkerDeps, sent: SentStories, budgetMs: number): Promise<StoryList> {
  const started = deps.nowMs(), calls: ModelCall[] = []
  const kind = listKind()
  if (!kind) return { kind: "news", stories: [], hold: "the brand profile has no researched story kind", calls }
  const ai = deps.ai(c => calls.push(c))
  const [posts, seeds, inFlight] = await Promise.all([deps.content.recentPosts(), deps.seeds(), storiesInFlight(deps)])
  const titles = [...posts.map(p => p.title), ...sent.titles]
  const job = { kind, count: LIST_COUNT }
  let found = await researchStories(deps, ai, job, titles, seeds, [], sent.urls, inFlight, LIST_COUNT)
  if (!Array.isArray(found)) found = await researchStories(deps, ai, job, titles, seeds, found.tried ?? [], found.triedUrls ?? sent.urls, inFlight, LIST_COUNT)
  if (!Array.isArray(found)) return { kind, stories: [], hold: found.hold, calls }
  const stories: ListedStory[] = []
  for (const s of found) {
    const left = budgetMs - (deps.nowMs() - started)
    const photo = left < 30_000 ? { none: "not checked this morning (out of time)" } : await photoLead(deps, ai, s, kind)
    stories.push({ title: s.title, url: s.primaryUrl, publisher: s.publisher, ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}), why: s.why ?? "", photo })
  }
  return { kind, stories, calls }
}

async function photoLead(deps: WorkerDeps, ai: ReturnType<WorkerDeps["ai"]>, story: Story, kind: RequestKind): Promise<ListedStory["photo"]> {
  try {
    const r = await confirmPhoto(deps, ai, story, kind, "feed")
    if ("why" in r) return { none: `no licensed photo found: ${r.why}`.slice(0, 300) }
    const c = r.photo.candidate
    return { url: c.url, pageUrl: c.pageUrl, credit: c.credit }
  } catch (err) {
    return { none: `the photo check failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300) }
  }
}

/** "2026-11-18" → "Wednesday, November 18" (and the short form for the subject, "Wed, Nov 18"). */
export function readableDay(day: string, short = false): string {
  const d = new Date(`${day}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return day
  return new Intl.DateTimeFormat("en-US", short ? { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" } : { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(d)
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
/** MilCityUSA's own palette (06 Standards/Brand Profiles/MilCityUSA_Visual_Standard.md §2): navy frame, red numerals. */
const NAVY = "#2A304C"
const RED = "#ED2020"
const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"

/**
 * The email to the producer (founder, 2026-11-17: formatted like a briefing, not plain text). A navy header with the
 * brand and the day, one card per candidate (a red numeral, the outlet and date, the headline, why it fits, links to
 * the story and the photo lead), and one button to Create. `text` is the plain-text alternative for mail clients that
 * show no HTML. The profile version is kept in the run record, not shown to the producer.
 */
export function storyListEmail(list: Pick<StoryList, "stories" | "hold">, p: { brand: string; day: string; createUrl: string; versionId: string }): { subject: string; text: string; html: string } {
  const n = list.stories.length
  const longDay = readableDay(p.day)
  const shortDay = readableDay(p.day, true)
  const subject = n
    ? `${p.brand} story list · ${shortDay} · ${n} candidate${n === 1 ? "" : "s"}`
    : `${p.brand} story list · ${shortDay} · no candidates this morning`
  const lead = n
    ? `${n === 1 ? "One story" : `${n} stories`} from this morning's research. Pick one and work it in Create as usual; nothing has been drafted.`
    : `Research found no story to suggest this morning. Why: ${list.hold ?? "no candidates found"}.`

  const text = [
    `${p.brand} · Morning story list · ${longDay}`,
    "",
    lead,
    ...list.stories.flatMap((s, i) => [
      "",
      `${i + 1}. ${s.title}`,
      `   ${s.publisher}${s.publishedAt ? ` · ${s.publishedAt}` : ""}`,
      `   Why it fits: ${s.why || "research gave no reason"}`,
      `   Story: ${s.url}`,
      "pageUrl" in s.photo ? `   Photo lead: ${s.photo.pageUrl} (${s.photo.credit})` : `   Photo lead: none (${s.photo.none})`,
    ]),
    "",
    `Open Create: ${p.createUrl}`,
  ].join("\n")

  const link = (href: string, label: string) =>
    `<a href="${esc(href)}" target="_blank" rel="noopener" style="color:${NAVY};text-decoration:underline;font-weight:600;">${esc(label)}</a>`
  const card = (s: ListedStory, i: number) => `
<tr><td style="padding:0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #E5E5EA;border-left:4px solid ${NAVY};border-radius:6px;margin:0 0 14px;">
<tr><td width="44" valign="top" style="padding:16px 0 16px 16px;font-family:${FONT};font-size:24px;font-weight:900;line-height:1;color:${RED};">${i + 1}</td>
<td valign="top" style="padding:14px 16px 14px 8px;">
<div style="font-family:${FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777;margin:0 0 6px;">${esc(s.publisher)}${s.publishedAt ? ` · ${esc(s.publishedAt)}` : ""}</div>
<div style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.35;color:#1a1a1a;">${esc(s.title)}</div>
<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:#444;margin-top:6px;"><strong style="color:#1a1a1a;">Why it fits:</strong> ${esc(s.why || "research gave no reason")}</div>
<div style="font-family:${FONT};font-size:13px;line-height:1.6;margin-top:10px;">${link(s.url, "Read the story →")}&nbsp;&nbsp;·&nbsp;&nbsp;${
    "pageUrl" in s.photo
      ? `${link(s.photo.pageUrl, "Photo lead →")} <span style="color:#888;">${esc(s.photo.credit)}</span>`
      : `<span style="color:#888;">No photo lead (${esc(s.photo.none)})</span>`
  }</div>
</td></tr></table>
</td></tr>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F4F4F5;">${esc(n ? list.stories.map((s) => s.title).join(" · ") : lead)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F4F4F5" style="background:#F4F4F5;border-collapse:collapse;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF;border-collapse:collapse;border-radius:10px;overflow:hidden;">
<tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:20px 28px;">
<div style="font-family:${FONT};font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#FFFFFF;">${esc(p.brand)} · Morning story list</div>
<div style="font-family:${FONT};font-size:13px;color:#C9CCDA;margin-top:4px;">${esc(longDay)}</div>
</td></tr>
<tr><td bgcolor="${RED}" style="background:${RED};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 28px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:#333;">${esc(lead)}</td></tr>
${list.stories.map(card).join("")}
<tr><td align="left" style="padding:8px 28px 28px;">
<a href="${esc(p.createUrl)}" target="_blank" rel="noopener" style="display:inline-block;background:${NAVY};color:#FFFFFF;text-decoration:none;font-family:${FONT};font-size:14px;font-weight:700;padding:11px 20px;border-radius:999px;">Open Create →</a>
</td></tr>
<tr><td style="padding:0 28px 24px;"><div style="font-family:${FONT};font-size:12px;line-height:1.5;color:#999;border-top:1px solid #EEE;padding-top:14px;">Sent each weekday morning by the 434 MEDIA content engine. Reply to this email with feedback.</div></td></tr>
</table></td></tr></table></body></html>`

  return { subject, text, html }
}
