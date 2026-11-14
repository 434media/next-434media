// The Google Contacts sync: the CRM is the system of record, Google is the pipe that feeds the founder's phone
// (spec, "The Google Contacts sync: the CRM is the master").
//
//   1. Import, once: every current contact is saved as a Person, `personal` unless it carries the "Business" label
//      (or its email already belongs to a business record here, which an import must never hide). Saved directly:
//      the import does not fill the inbox.
//   2. Then incremental: people.connections.list with the syncToken. A changed contact that is linked to a Person
//      is merged, latest edit wins, with whatever was overwritten kept in the Person's activity history. A new
//      contact waits in the inbox (`personal`, or `business` when labeled), and only a person's decision stores it.
//      An expired token means a full listing; only contacts changed since the last sync arrive from it, so a
//      dismissed contact comes back only if it was edited on the phone.
//   3. Write-back, only when the founder has switched it on (off by default): the CRM's edits are written to Google
//      with the etag; a stale etag is refused by Google, the contact is re-read, latest edit wins, and the write is
//      tried once more. Writes go only to contacts in the "434" group, which the CRM puts its saved contacts into.
//      Nothing is ever deleted in Google, and every write is logged.
//
// Every dependency is injected (lib/google-contacts/server.ts wires Firestore and the People API), so the rules are
// tested offline in lib/__tests__/google-contacts.test.ts.

import type { CohortLike } from "@/lib/prospecting/cohort-match"
import type { AddressBookField, GoogleLink, Person, Relationship } from "@/types/core-model"
import {
  changedFields,
  emptyAddressBook,
  mergeLatestEditWins,
  personFieldsFromBook,
  type FieldChange,
} from "@/lib/core-model/address-book"
import { normalizeEmail } from "@/lib/core-model/identity"
import { effectiveVisibility } from "@/lib/core-model/visibility"
import {
  DuplicateError,
  ensureAffiliation,
  ensureOrganization,
  recordArrival,
  type CoreStore,
  type NewPerson,
} from "@/lib/core-model/service"
import { GcError } from "./client"
import {
  contactFromBook,
  CRM_GROUP_NAME,
  fromGooglePerson,
  relationshipFromLabels,
  toGoogleUpdate,
  type GooglePerson,
  type MappedContact,
} from "./mapping"

export const SYNC_ACTOR = "google-contacts-sync"

export interface ContactGroup {
  resourceName: string
  name: string
  groupType?: string
}

/** The People API calls the sync makes (lib/google-contacts/client.ts, allow-listed; nothing deletes). */
export interface PeopleApi {
  list(opts: { pageToken?: string; syncToken?: string }): Promise<{ connections: GooglePerson[]; nextPageToken?: string; nextSyncToken?: string }>
  get(resourceName: string): Promise<GooglePerson>
  update(resourceName: string, body: Record<string, unknown>, updatePersonFields: string): Promise<GooglePerson>
  listGroups(): Promise<ContactGroup[]>
  createGroup(name: string): Promise<ContactGroup>
  addToGroup(groupResourceName: string, resourceNames: string[]): Promise<void>
}

/** A phone arrival waiting for a decision. Kept only until someone decides; a dismissal removes it. */
export interface PendingArrival {
  resource_name: string
  etag: string
  update_time?: string
  contact_source?: { id: string; etag: string }
  book: MappedContact["book"]
  groups: string[]
  relationship: Relationship
  arrived_at: string
}

export interface PendingStore {
  get(resourceName: string): Promise<PendingArrival | null>
  put(arrival: PendingArrival): Promise<void>
  remove(resourceName: string): Promise<void>
}

export type SyncPhase = "import" | "sync" | "resync"

export interface SyncState {
  phase: SyncPhase
  page_token?: string
  sync_token?: string
  /** When the last complete pass finished. A full resync takes as arrivals only contacts changed after it. */
  last_synced_at?: string
  /** The "434" contact group, once found or created. */
  group_resource_name?: string
  /** The switch. Off by default; only the founder turns it on. */
  write_back: boolean
  last_run_at?: string
  last_result?: SyncResult
}

export interface SyncStateStore {
  read(): Promise<SyncState>
  write(state: SyncState): Promise<void>
}

export interface WriteLogEntry {
  at: string
  op: "update_contact" | "create_group" | "add_to_group"
  person_id?: string
  /** For a group add, how many contacts; values are never logged. */
  count?: number
  fields?: string[]
  outcome: "ok" | "stale_etag" | "skipped" | "error"
  code?: string
}

export interface WriteLog {
  record(entry: WriteLogEntry): Promise<void>
}

export interface PeopleIndex {
  /** Kept for single lookups outside a run; a run uses its own index built once from `all()`. */
  byResourceName(resourceName: string): Promise<Person | null>
  /** Every stored Person, read once at the start of a run to build its indexes. */
  all(): Promise<Person[]>
  /** Every stored Person linked to a Google contact. */
  linked(): Promise<Person[]>
  /** Emails that already belong to a business record (stored or read from an old collection). */
  knownBusinessEmails(): Promise<Set<string>>
}

export interface SyncDeps {
  api: PeopleApi
  store: CoreStore
  people: PeopleIndex
  pending: PendingStore
  state: SyncStateStore
  log: WriteLog
  cohorts: CohortLike[]
  now(): string
  /**
   * ms budget for one run. Checked before every contact, so a run stops mid-page with time to save; the next run
   * re-reads that page and skips what is done. Keep it well under the caller's maxDuration.
   */
  budgetMs?: number
  nowMs?(): number
}

export interface SyncResult {
  phase: SyncPhase
  imported: number
  linked: number
  updated: number
  arrivals: number
  deleted_in_google: number
  skipped: number
  written: number
  stale_retries: number
  waiting_for_write_back: number
  /** People a cut-off run had created without their Google link, linked now instead of copied. */
  relinked: number
  errors: string[]
  done: boolean
  /** True when the run stopped on its time budget; the next run continues from the saved page. */
  stopped_on_budget: boolean
}

const emptyResult = (phase: SyncPhase): SyncResult => ({
  phase,
  imported: 0,
  linked: 0,
  updated: 0,
  arrivals: 0,
  deleted_in_google: 0,
  skipped: 0,
  written: 0,
  stale_retries: 0,
  waiting_for_write_back: 0,
  relinked: 0,
  errors: [],
  done: false,
  stopped_on_budget: false,
})

function linkOf(m: MappedContact, groupRn: string | undefined, now: string, prior?: GoogleLink): GoogleLink {
  return {
    resource_name: m.resource_name,
    etag: m.etag,
    contact_source: m.contact_source,
    update_time: m.update_time,
    snapshot: m.book,
    in_434_group: Boolean(prior?.in_434_group) || Boolean(groupRn && m.groups.includes(groupRn)),
    synced_at: now,
  }
}

const later = (a?: string, b?: string) => (Date.parse(a ?? "") || 0) > (Date.parse(b ?? "") || 0)

// ── Import ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The relationship an imported contact gets: business when labeled, or when its email is already business here. */
export function importRelationship(m: MappedContact, knownBusiness: ReadonlySet<string>): Relationship {
  if (relationshipFromLabels(m.book.labels) === "business") return "business"
  return m.book.emails.some((e) => knownBusiness.has(normalizeEmail(e.value))) ? "business" : "personal"
}

async function importOne(deps: SyncDeps, m: MappedContact, ctx: RunCtx): Promise<void> {
  if (m.deleted || !m.resource_name) return
  if (ctx.byRn.has(m.resource_name)) {
    // Already imported (an earlier run, or this page before a cut-off): treat it as a change, which is idempotent.
    await incoming(deps, m, "sync", ctx)
    return
  }
  const fields = personFieldsFromBook(m.book)
  if (!fields.name) {
    ctx.result.skipped++
    return
  }
  const now = deps.now()
  // An address already here: link the Google contact to that Person rather than make a second one.
  for (const email of fields.emails) {
    const found = await findByEmail(deps, ctx, email)
    if (!found) continue
    if (found.google) {
      // Two Google contacts share an address: the second waits in the inbox for the founder.
      await putArrival(deps, m, ctx)
      return
    }
    await linkExisting(deps, ctx, found, m, now)
    ctx.result.linked++
    return
  }
  // A Person a cut-off run created from this contact before it could link it (no email, so no address to match
  // on): link it now instead of making a copy.
  const orphan = takeOrphan(ctx, fields.name)
  if (orphan) {
    await linkExisting(deps, ctx, orphan, m, now)
    ctx.result.relinked++
    return
  }
  const relationship = importRelationship(m, ctx.knownBusiness)
  try {
    // The Google link is written with the Person in one write, so a run cut off here leaves no unlinked copy.
    const { person, activity } = await recordArrival(
      deps.store,
      {
        type: "google_contact",
        source: "google_contacts",
        occurred_at: m.update_time ?? now,
        contact: contactFromBook(m.book, fields.name),
        summary: "Imported from Google Contacts",
        created_by: SYNC_ACTOR,
        stage: "contact",
        relationship,
        allowPrivate: true,
        address_book: m.book,
        google: linkOf(m, ctx.groupRn, now),
      },
      deps.cohorts,
    )
    // A Person matched by email at the store (claimed after this run read its index) has no link yet: link it.
    indexPerson(ctx, person.google ? person : await deps.store.updatePerson(person.id, { address_book: person.address_book ?? m.book, google: linkOf(m, ctx.groupRn, now) }))
    // Saved directly: the import never fills the inbox.
    await deps.store.recordTriage({ id: activity.id, decision: "save", by: SYNC_ACTOR, at: now, person_id: person.id })
    ctx.result.imported++
  } catch (err) {
    if (err instanceof DuplicateError) {
      await putArrival(deps, m, ctx)
      return
    }
    throw err
  }
}

async function linkExisting(deps: SyncDeps, ctx: RunCtx, person: Person, m: MappedContact, now: string) {
  const updated = await deps.store.updatePerson(person.id, { address_book: person.address_book ?? m.book, google: linkOf(m, ctx.groupRn, now) })
  indexPerson(ctx, updated)
}

/** The run's indexes: who is linked to which contact, who holds which email, and unlinked sync-made People. */
function indexPerson(ctx: RunCtx, p: Person) {
  if (p.merged_into) return
  if (p.google?.resource_name) ctx.byRn.set(p.google.resource_name, p.id)
  for (const e of p.emails) if (!ctx.byEmail.has(e)) ctx.byEmail.set(e, p.id)
  if (!p.google && p.source === "google_contacts" && p.added_by === SYNC_ACTOR && p.emails.length === 0) {
    const k = p.name.trim().toLowerCase()
    ctx.orphans.set(k, [...(ctx.orphans.get(k) ?? []), p])
  }
}

function takeOrphan(ctx: RunCtx, name: string): Person | undefined {
  return ctx.orphans.get(name.trim().toLowerCase())?.shift()
}

async function findByEmail(deps: SyncDeps, ctx: RunCtx, email: string): Promise<Person | null> {
  const id = ctx.byEmail.get(normalizeEmail(email))
  return id ? deps.store.getPerson(id) : null
}

async function findLinked(deps: SyncDeps, ctx: RunCtx, resourceName: string): Promise<Person | null> {
  const id = ctx.byRn.get(resourceName)
  return id ? deps.store.getPerson(id) : null
}

// ── Incoming changes ────────────────────────────────────────────────────────────────────────────────────────────

async function putArrival(deps: SyncDeps, m: MappedContact, ctx: RunCtx) {
  const prior = await deps.pending.get(m.resource_name)
  await deps.pending.put({
    resource_name: m.resource_name,
    etag: m.etag,
    update_time: m.update_time,
    contact_source: m.contact_source,
    book: m.book,
    groups: m.groups,
    // Phone arrivals are personal unless labeled Business (fails safe).
    relationship: relationshipFromLabels(m.book.labels),
    arrived_at: prior?.arrived_at ?? deps.now(),
  })
  if (!prior) ctx.result.arrivals++
}

/** Write an address-book change to the Person's history, kept out of the inbox. */
async function recordChange(deps: SyncDeps, person: Person, summary: string, change: FieldChange[]) {
  const at = deps.now()
  const activity = await deps.store.createActivity({
    type: "address_book_change",
    source: "google_contacts",
    occurred_at: at,
    contact: { name: person.name },
    person_id: person.id,
    summary,
    // Firestore refuses `undefined`; a missing value is kept as null.
    change: change.map((c) => ({ ...c, before: c.before ?? null, after: c.after ?? null })),
    visibility: effectiveVisibility(person),
    created_by: SYNC_ACTOR,
  })
  await deps.store.recordTriage({ id: activity.id, decision: "save", by: SYNC_ACTOR, at, person_id: person.id })
}

/**
 * Merge a Google contact into its linked Person (latest edit wins). Returns the Person as stored after the merge.
 */
async function mergeIntoPerson(deps: SyncDeps, person: Person, m: MappedContact, ctx: RunCtx): Promise<Person> {
  const g = person.google as GoogleLink
  const crm = person.address_book ?? g.snapshot ?? emptyAddressBook()
  const r = mergeLatestEditWins({
    crm,
    snapshot: g.snapshot ?? emptyAddressBook(),
    google: m.book,
    crmEditedAt: person.address_book_edited_at,
    googleUpdatedAt: m.update_time,
  })
  // Unchanged since the last read (same etag, nothing to merge): no write. A page read again after a cut-off run
  // costs a lookup per contact, not a write.
  const groupNow = Boolean(g.in_434_group) || Boolean(ctx.groupRn && m.groups.includes(ctx.groupRn))
  if (g.etag === m.etag && !r.changes.length && groupNow === Boolean(g.in_434_group) && !g.deleted_at) return person
  const patch: Partial<NewPerson> = { address_book: r.book, google: linkOf(m, ctx.groupRn, deps.now(), g) }
  const googleWon = r.changes.filter((c) => c.winner === "google").map((c) => c.field)
  if (googleWon.length) {
    const f = personFieldsFromBook(r.book)
    if (googleWon.includes("name") && f.name) patch.name = f.name
    if (googleWon.includes("phones")) patch.phones = f.phones
    if (googleWon.includes("notes")) patch.notes = f.notes
    if (googleWon.includes("organizations")) patch.title = f.title
    if (googleWon.includes("emails")) patch.emails = Array.from(new Set([...person.emails, ...f.emails]))
  }
  let updated: Person
  try {
    updated = await deps.store.updatePerson(person.id, patch)
  } catch (err) {
    // An address in Google already belongs to another Person here: keep the Person's own list.
    if (!(err instanceof DuplicateError)) throw err
    const { emails: _e, ...rest } = patch
    updated = await deps.store.updatePerson(person.id, rest)
  }
  if (googleWon.includes("organizations")) {
    const org = r.book.organizations[0]
    if (org?.name) {
      const visibility = effectiveVisibility(updated) === "private" ? "private" : "business"
      const o = await ensureOrganization(deps.store, { name: org.name, byName: true, visibility }, deps.cohorts)
      if (o) await ensureAffiliation(deps.store, updated.id, o.id, "works_at", org.title)
    }
  }
  if (r.changes.length) {
    const winners = new Set(r.changes.map((c) => c.winner))
    const who = winners.size === 2 ? "phone and CRM" : winners.has("google") ? "phone" : "CRM"
    await recordChange(deps, updated, `Address book: ${r.changes.length} field${r.changes.length === 1 ? "" : "s"} changed (latest edit won: ${who})`, r.changes)
    ctx.result.updated++
  }
  return updated
}

async function incoming(deps: SyncDeps, m: MappedContact, mode: "sync" | "resync", ctx: RunCtx): Promise<void> {
  if (!m.resource_name) return
  const person = await findLinked(deps, ctx, m.resource_name)
  if (m.deleted) {
    // Never deleted here either: the Person is kept and marked; a waiting arrival is simply forgotten.
    if (person?.google && !person.google.deleted_at) {
      await deps.store.updatePerson(person.id, { google: { ...person.google, deleted_at: deps.now() } })
      await recordChange(deps, person, "Deleted in Google Contacts; kept here", [])
      ctx.result.deleted_in_google++
    }
    if (await deps.pending.get(m.resource_name)) await deps.pending.remove(m.resource_name)
    return
  }
  if (person?.google) {
    await mergeIntoPerson(deps, person, m, ctx)
    return
  }
  if (await deps.pending.get(m.resource_name)) {
    await putArrival(deps, m, ctx)
    return
  }
  if (mode === "resync" && !later(m.update_time, ctx.lastSyncedAt)) return
  if (!personFieldsFromBook(m.book).name) {
    ctx.result.skipped++
    return
  }
  await putArrival(deps, m, ctx)
}

// ── Write-back ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The fields this Person holds differently from Google's last copy: what write-back would send. */
export function pendingFields(person: Person): AddressBookField[] {
  if (!person.google || !person.address_book || person.google.deleted_at) return []
  return changedFields(person.address_book, person.google.snapshot)
}

/** Why a write to this Person's Google contact may not happen now, or null. */
export function writeRefusal(person: Person, state: Pick<SyncState, "write_back">): string | null {
  if (!state.write_back) return "write_back_off"
  if (!person.google || person.google.deleted_at) return "not_linked"
  if (!person.google.in_434_group) return "not_in_434_group"
  return null
}

async function pushOne(deps: SyncDeps, person: Person, ctx: RunCtx): Promise<void> {
  let current = person
  for (let attempt = 0; attempt < 2; attempt++) {
    const fields = pendingFields(current)
    if (!fields.length) return
    const refusal = writeRefusal(current, ctx.state)
    if (refusal) {
      if (refusal === "write_back_off") ctx.result.waiting_for_write_back++
      return
    }
    const g = current.google as GoogleLink
    const { body, updatePersonFields } = toGoogleUpdate(current.address_book!, fields, g)
    try {
      const resp = await deps.api.update(g.resource_name, body, updatePersonFields)
      await deps.log.record({ at: deps.now(), op: "update_contact", person_id: current.id, fields, outcome: "ok" })
      const m = fromGooglePerson(resp, ctx.groupNames)
      // Take Google's form of what was written (it may reformat a phone), so the copies agree and nothing loops.
      const book = { ...current.address_book!, labels: m.book.labels, photo_url: m.book.photo_url }
      for (const f of fields) (book as unknown as Record<string, unknown>)[f] = m.book[f]
      await deps.store.updatePerson(current.id, { address_book: book, google: { ...linkOf(m, ctx.groupRn, deps.now(), g), in_434_group: true } })
      ctx.result.written++
      return
    } catch (err) {
      const code = err instanceof GcError ? err.code : "error"
      await deps.log.record({ at: deps.now(), op: "update_contact", person_id: current.id, fields, outcome: code === "stale_etag" ? "stale_etag" : "error", code })
      if (code !== "stale_etag" || attempt > 0) {
        ctx.result.errors.push(`write ${code}`)
        return
      }
      // Stale copy: re-read, apply latest edit wins (keeping what is overwritten), then try once more.
      ctx.result.stale_retries++
      const fresh = fromGooglePerson(await deps.api.get(g.resource_name), ctx.groupNames)
      current = await mergeIntoPerson(deps, current, fresh, ctx)
    }
  }
}

/** Find or create the "434" group, then add every linked Person not yet in it. Add only; never remove. */
async function claimGroup(deps: SyncDeps, ctx: RunCtx): Promise<void> {
  if (!ctx.groupRn) {
    const created = await deps.api.createGroup(CRM_GROUP_NAME)
    await deps.log.record({ at: deps.now(), op: "create_group", outcome: "ok" })
    ctx.groupRn = created.resourceName
    ctx.state.group_resource_name = created.resourceName
  }
  const toAdd = (await deps.people.linked()).filter((p) => p.google && !p.google.in_434_group && !p.google.deleted_at)
  for (let i = 0; i < toAdd.length; i += 500) {
    const batch = toAdd.slice(i, i + 500)
    try {
      await deps.api.addToGroup(ctx.groupRn, batch.map((p) => p.google!.resource_name))
      await deps.log.record({ at: deps.now(), op: "add_to_group", count: batch.length, outcome: "ok" })
    } catch (err) {
      await deps.log.record({ at: deps.now(), op: "add_to_group", count: batch.length, outcome: "error", code: err instanceof GcError ? err.code : "error" })
      throw err
    }
    for (const p of batch) await deps.store.updatePerson(p.id, { google: { ...p.google!, in_434_group: true } })
  }
}

// ── One run ─────────────────────────────────────────────────────────────────────────────────────────────────────

interface RunCtx {
  state: SyncState
  result: SyncResult
  byRn: Map<string, string>
  byEmail: Map<string, string>
  orphans: Map<string, Person[]>
  groupRn?: string
  groupNames: Map<string, string>
  knownBusiness: Set<string>
  lastSyncedAt?: string
}

/**
 * One run of the sync, within the time budget: continue the import or the incremental sync from where the last run
 * stopped, then (only with write-back on) claim the "434" group and write the CRM's edits back.
 */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const nowMs = deps.nowMs ?? (() => Date.now())
  const started = nowMs()
  const budget = deps.budgetMs ?? 200_000
  const outOfTime = () => nowMs() - started >= budget
  const state = await deps.state.read()
  const result = emptyResult(state.phase)
  const groups = await deps.api.listGroups()
  const userGroups = groups.filter((g) => !g.groupType || g.groupType === "USER_CONTACT_GROUP")
  const crmGroup = userGroups.find((g) => g.name === CRM_GROUP_NAME)
  const ctx: RunCtx = {
    state,
    result,
    groupRn: crmGroup?.resourceName ?? state.group_resource_name,
    groupNames: new Map(userGroups.map((g) => [g.resourceName, g.name])),
    knownBusiness: state.phase === "import" ? await deps.people.knownBusinessEmails() : new Set(),
    lastSyncedAt: state.last_synced_at,
    byRn: new Map(),
    byEmail: new Map(),
    orphans: new Map(),
  }
  // One read of the stored people per run, instead of a query per contact.
  for (const p of await deps.people.all()) indexPerson(ctx, p)
  if (ctx.groupRn) state.group_resource_name = ctx.groupRn
  const save = async () => {
    state.last_run_at = deps.now()
    state.last_result = { ...result, phase: state.phase }
    await deps.state.write(state)
  }

  try {
    let more = true
    while (more && !outOfTime()) {
      const listing = state.phase === "sync" ? { syncToken: state.sync_token, pageToken: state.page_token } : { pageToken: state.page_token }
      let page: Awaited<ReturnType<PeopleApi["list"]>>
      try {
        page = await deps.api.list(listing)
      } catch (err) {
        if (err instanceof GcError && err.code === "expired_sync_token" && state.phase === "sync") {
          // Full resync: only contacts changed since the last complete pass become arrivals.
          state.phase = "resync"
          state.page_token = undefined
          state.sync_token = undefined
          continue
        }
        throw err
      }
      for (const raw of page.connections ?? []) {
        // Checked before every contact: a page is never allowed to outrun the budget. The page token is not moved,
        // so the next run reads this page again and skips the contacts already done (they are in the index).
        if (outOfTime()) {
          result.stopped_on_budget = true
          more = false
          break
        }
        const m = fromGooglePerson(raw, ctx.groupNames)
        if (state.phase === "import") await importOne(deps, m, ctx)
        else await incoming(deps, m, state.phase === "resync" ? "resync" : "sync", ctx)
      }
      if (result.stopped_on_budget) {
        await save()
        break
      }
      if (page.nextPageToken) {
        state.page_token = page.nextPageToken
      } else {
        state.page_token = undefined
        state.sync_token = page.nextSyncToken ?? state.sync_token
        state.phase = "sync"
        state.last_synced_at = deps.now()
        more = false
        result.done = true
      }
      await save()
    }

    if (state.write_back && result.done) {
      await claimGroup(deps, ctx)
      for (const p of await deps.people.linked()) {
        if (outOfTime()) break
        await pushOne(deps, p, ctx)
      }
    } else if (!state.write_back) {
      result.waiting_for_write_back = (await deps.people.linked()).filter((p) => pendingFields(p).length > 0).length
    }
  } catch (err) {
    result.errors.push(err instanceof GcError ? err.code : err instanceof Error ? err.name : "error")
    await save()
    throw err
  }
  await save()
  return result
}
