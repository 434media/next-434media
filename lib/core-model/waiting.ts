// "Waiting on you" (one work area, founder 2026-11-16): one list per signed-in person over records that already
// exist, never a store of its own. Pure, so it is tested without Firestore.
//
//  - the pending agent drafts (crm_send_approvals), which only the founder reads;
//  - the untriaged inbox arrivals the viewer may see (the Inbox, after the visibility filter).
//
// One row per arrival: an arrival with a pending draft is one "draft" row carrying the arrival, never two rows.

import type { InboxItem } from "@/types/core-model"
import { inboxOf, type CoreView } from "./assemble"

/** The inbox: untriaged activities with their Person and Organization (fit and grade). */
export function inboxItems(view: CoreView): InboxItem[] {
  const people = new Map(view.people.map((p) => [p.id, p]))
  const orgs = new Map(view.organizations.map((o) => [o.id, o]))
  return inboxOf(view).map((activity) => ({
    activity,
    person: activity.person_id ? people.get(activity.person_id) : undefined,
    organization: activity.organization_id ? orgs.get(activity.organization_id) : undefined,
  }))
}

/** The least of a draft this view needs (lib/agent/review.ts ReviewItem satisfies it). */
export interface WaitingDraft {
  id: string
  status: string
  createdAt: string
  activityId?: string
}

export type WaitingRow<D extends WaitingDraft> =
  | { kind: "draft"; key: string; draft: D; item?: InboxItem }
  | { kind: "arrival"; key: string; item: InboxItem }

/**
 * Pending drafts first, oldest first, each with its arrival when the viewer's inbox holds it; then every other
 * arrival, newest first. `inbox` must already be the viewer's filtered inbox, so a personal arrival reaches only the
 * founder, as in the Inbox.
 */
export function waitingRows<D extends WaitingDraft>(drafts: D[], inbox: InboxItem[]): WaitingRow<D>[] {
  const byActivity = new Map(inbox.map((i) => [i.activity.id, i]))
  const pending = drafts.filter((d) => d.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const claimed = new Set<string>()
  const rows: WaitingRow<D>[] = []
  for (const d of pending) {
    const item = d.activityId && !claimed.has(d.activityId) ? byActivity.get(d.activityId) : undefined
    if (item) claimed.add(item.activity.id)
    rows.push({ kind: "draft", key: `draft:${d.id}`, draft: d, ...(item ? { item } : {}) })
  }
  const rest = inbox
    .filter((i) => !claimed.has(i.activity.id))
    .sort((a, b) => b.activity.occurred_at.localeCompare(a.activity.occurred_at))
  for (const item of rest) rows.push({ kind: "arrival", key: `arrival:${item.activity.id}`, item })
  return rows
}
