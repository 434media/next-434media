import type { Placement, RequestKind, SeriesKey } from "./series"
import type { MediaCandidate } from "./sources"
import type { ModelCall } from "./model"

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
  createdAt: string
  updatedAt?: string
}

export interface Story {
  title: string
  primaryUrl: string
  publisher: string
  publishedAt?: string
  /** Sourced one-sentence "what changed, its consequence, why now" — Breaking only. */
  whyNow?: string
  sourceText: string
  sourceTitle: string
  /** Pages that fill what the primary source leaves out (for DT101, the maker and its headquarters); their text follows the primary's in sourceText. */
  supporting?: { url: string; title: string }[]
  /** For ICYMI: the published MCU posts this roundup covers. */
  roundup?: { postId: string; title: string; caption: string; publishedUrl?: string }[]
}
export interface FrameCopy { series: SeriesKey; fields: Record<string, string>; mediaQuery?: string }
export interface ChosenMedia extends Pick<MediaCandidate, "url" | "pageUrl" | "license" | "creator" | "credit" | "usGovernment" | "date"> { title: string; note?: string; /** Zoom applied before the Canva fill, as fractions of the photo. */ crop?: CropBox }
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
}

export const WORKING: readonly DraftStatus[] = ["queued", "writing", "media", "designing", "reviewing", "posting"]

/** Attempts per job or draft before it is closed with a notice instead of retried forever. */
export const MAX_ATTEMPTS = 4
/** A crop as fractions (0–1) of the photo, from its top-left corner (lib/canva-create.ts CropBox). */
export interface CropBox { x: number; y: number; width: number; height: number }
