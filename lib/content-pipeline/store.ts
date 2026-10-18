import type { Placement, RequestKind, SeriesKey } from "./series"
import type { MediaCandidate } from "./sources"
import type { ModelCall } from "./model"
import type { PipelineMedia } from "@/components/crm/types"

/**
 * Durable pipeline work, so a Generate request survives interruptions without anyone asking again. A JOB is one
 * request ("5 News posts"); it researches once and opens one DRAFT per story (an ICYMI roundup is one draft with six
 * frames). Each draft moves through its steps under a lease; the run that started the job and the scheduled check
 * (app/api/cron/content-pipeline) pick up anything due. Every external effect is keyed so a resumed step returns the
 * earlier result instead of repeating it: Canva designs by draft/version/frame, content posts by draft/version.
 * Moved from the pilot's Slack MCU skill (lib/slack/mcu/store.ts at b36e7be); the Slack thread is replaced by the
 * Admin board. The Firestore implementation is lib/firestore-content-pipeline.ts.
 */
export interface RequestRef { actorEmail: string; actorName: string }

export type JobStatus = "researching" | "drafting" | "done" | "held" | "failed"
export interface McuJob {
  id: string
  /** The property generated for (properties.ts id, e.g. "milcity"). Older jobs have none and were MilCityUSA. */
  property?: string
  kind: RequestKind
  count: number
  topic?: string
  placement: Placement
  request: RequestRef
  status: JobStatus
  drafts: string[]
  note?: string
  /** Set when the "N drafts ready" alert went out, so it goes out once. */
  notifiedAt?: string
  /** The "no new content" card in Review (a crm_content_posts id) when the job found nothing usable. */
  noContentPostId?: string
  /** Who confirmed "no new content", and when (the card's close action). */
  closedAt?: string
  closedBy?: string
  createdAt: string
  updatedAt?: string
}

export interface Story {
  title: string
  primaryUrl: string
  publisher: string
  publishedAt?: string
  /**
   * News dated by an outlet's report (founder, 2026-10-18): the report's date, which the card prints. The outlet is
   * never cited; its URL is kept for the reviewer only (reviewNotes), never on the post's links.
   */
  reportedAt?: string
  datedBy?: { url: string; publishedAt: string }
  /** Primary pages that refused the fetch and were read through the search tool's extracted text instead. */
  readViaSearch?: string[]
  /** Sourced one-sentence "what changed, its consequence, why now" — Breaking only. */
  whyNow?: string
  sourceText: string
  sourceTitle: string
  /** Pages that fill what the primary source leaves out (for DT101, the maker and its headquarters); their text follows the primary's in sourceText. */
  supporting?: { url: string; title: string }[]
  /** For ICYMI: the published MCU posts this roundup covers. */
  /** media: the photo the post recorded when the pipeline wrote it (pipeline_media), never read from its editable links. */
  roundup?: { postId: string; title: string; caption: string; publishedUrl?: string; media?: PipelineMedia }[]
}
export interface FrameCopy { series: SeriesKey; fields: Record<string, string>; mediaQuery?: string }
export interface ChosenMedia extends Pick<MediaCandidate, "url" | "pageUrl" | "license" | "creator" | "credit" | "usGovernment" | "date" | "rightsNote"> { title: string; note?: string; /** Zoom applied before the Canva fill, as fractions of the photo. */ crop?: CropBox }
export interface FrameDesign { templateId: string; designId: string; editUrl: string; viewUrl: string; previewUrls: string[] }

/** posting: the review step passed and the draft is being written to the board as a content post. */
export type DraftStatus = "queued" | "writing" | "media" | "designing" | "reviewing" | "posting" | "in_review" | "held" | "failed"
export interface McuDraft {
  id: string
  jobId: string
  kind: RequestKind
  placement: Placement
  request: RequestRef
  status: DraftStatus
  version: number
  /** The requester's optional Generate instruction, copied from the job; the writer gets it as proactive direction. */
  direction?: string
  story: Story
  frames: FrameCopy[]
  caption?: string
  media: (ChosenMedia | null)[]
  designs: FrameDesign[]
  qa: string[]
  notices: string[]
  /** Subjects the skill replaced on its own because the source could not support the post. */
  rejected?: string[]
  autoReplaced?: number
  /** Photos the artwork check turned down for this draft (item pages); the media step skips them. */
  avoidMedia?: string[]
  /** How many times the artwork check sent the draft back for a different photo. */
  mediaRetries?: number
  holdReason?: string
  error?: string
  /** The content post on the Admin board (crm_content_posts) this draft became. */
  postId?: string
  /** Every model call as served, for the routing evidence and the quality gate. */
  calls?: (ModelCall & { at: string })[]
  history: { at: string; event: string }[]
  createdAt: string
  updatedAt: string
}

export interface McuStore {
  createJob(job: McuJob): Promise<{ created: boolean; job: McuJob }>
  getJob(id: string): Promise<McuJob | null>
  saveJob(job: McuJob): Promise<void>
  createDraft(draft: McuDraft): Promise<void>
  getDraft(id: string): Promise<McuDraft | null>
  saveDraft(draft: McuDraft): Promise<void>
  /** Take the lease on a due job or draft: the attempt number, or 0 when it is not due or another run holds it. */
  claim(kind: "job" | "draft", id: string, nowMs: number, leaseMs: number): Promise<number>
  release(kind: "job" | "draft", id: string, due: boolean): Promise<void>
  /** After a failed step: keep the attempt count and hold the lease until untilMs, so the retry waits. */
  backoff(kind: "job" | "draft", id: string, untilMs: number): Promise<void>
  /** Ids with work to do whose lease is free, oldest first. */
  due(nowMs: number, limit: number): Promise<{ kind: "job" | "draft"; id: string }[]>
  /**
   * The highest draft number already used under a prefix (MCU-NEWS-20261016-), here or by the pilot, so new drafts
   * (MCU-NEWS-20261016-01, -02, …) never repeat an id that already names a design or a post.
   */
  highestDraftNumber(prefix: string): Promise<number>
  /**
   * Stories of drafts opened since sinceIso, by any job: the repeat-story check before they reach the board. Gate
   * round 1 (2026-10-17) drafted Anduril's Steelfin in two concurrent jobs and the Army's NGC2 awards twice in one.
   */
  recentStories(sinceIso: string): Promise<{ draftId: string; jobId: string; title: string; primaryUrl: string }[]>
}

export const WORKING: readonly DraftStatus[] = ["queued", "writing", "media", "designing", "reviewing", "posting"]

/** Attempts per job or draft before it is closed with a notice instead of retried forever. */
export const MAX_ATTEMPTS = 4
/** A crop as fractions (0–1) of the photo, from its top-left corner (lib/canva-create.ts CropBox). */
export interface CropBox { x: number; y: number; width: number; height: number }
