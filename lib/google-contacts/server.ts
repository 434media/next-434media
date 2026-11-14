import "server-only"
import { createHash } from "node:crypto"
import { getDb } from "@/lib/firebase-admin"
import { CRM_COLLECTIONS } from "@/types/crm-types"
import type { Activity, Person } from "@/types/core-model"
import { listPeople, findPersonByResourceName } from "@/lib/firestore-people"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { getCoreView, invalidateCoreView } from "@/lib/core-model/read"
import { normalizeAddressBook, personFieldsFromBook } from "@/lib/core-model/address-book"
import { stripUndefined, toIsoString } from "@/lib/core-model/firestore-util"
import type { PendingArrivals } from "@/lib/core-model/service"
import {
  GcError,
  gcClientFromEnv,
  peopleRequest,
  connectionInfo,
  type GcClient,
  type GcDeps,
  type GcTokenStore,
} from "./client"
import { contactFromBook, PERSON_FIELDS, type GooglePerson } from "./mapping"
import {
  runSync,
  pendingFields,
  type ContactGroup,
  type PeopleApi,
  type PendingArrival,
  type PendingStore,
  type SyncResult,
  type SyncState,
  type SyncStateStore,
  type WriteLog,
} from "./sync"

/**
 * Wiring for the Google Contacts sync: the token store, the connect state, the People API behind the client's
 * allow-list, the waiting arrivals, the sync state (with the write-back switch) and the write log. Callers are the
 * founder-only routes under app/api/admin/core/google-contacts and the cron. Production only: previews have no
 * Firestore.
 *
 * Firestore:
 *   crm_meta/google_contacts_connection          the sealed refresh token (GOOGLE_CONTACTS_TOKEN_KEY)
 *   crm_meta/google_contacts_pending/states/*    connect state: single use, ten minutes, bound to the founder
 *   crm_meta/google_contacts_sync                phase, tokens, the "434" group, `write_back` (off by default)
 *   crm_meta/google_contacts_lock                one run at a time
 *   crm_google_contact_arrivals/*                phone arrivals waiting for a decision, removed on any decision
 *   crm_google_contact_writes/*                  every write to Google
 */

const META = "crm_meta"
const CONNECTION = "google_contacts_connection"
const PENDING_STATES = "google_contacts_pending"
const SYNC_STATE = "google_contacts_sync"
const LOCK = "google_contacts_lock"

export type GcSetup = { ok: true; client: GcClient } | { ok: false; missing: string[] }

export function gcSetup(): GcSetup {
  const r = gcClientFromEnv(process.env)
  return "client" in r ? { ok: true, client: r.client } : { ok: false, missing: r.missing }
}

function tokenStore(): GcTokenStore {
  const ref = () => getDb().collection(META).doc(CONNECTION)
  return {
    async read() {
      const d = (await ref().get()).data()
      return d && typeof d.sealed === "string" && Number.isSafeInteger(d.version)
        ? { version: d.version, sealed: d.sealed, connectedBy: String(d.connectedBy || ""), connectedAt: String(d.connectedAt || "") }
        : null
    },
    async write(expectedVersion, record) {
      const db = getDb()
      return db.runTransaction(async (tx) => {
        const current = (await tx.get(ref())).data()
        if ((current?.version ?? null) !== expectedVersion) return false
        tx.set(ref(), record)
        return true
      })
    },
    async remove() {
      await ref().delete()
    },
  }
}

export function gcDeps(client: GcClient): GcDeps {
  return { client, store: tokenStore(), fetcher: fetch, nowMs: () => Date.now(), log: (line) => console.error(line) }
}

// ── Connect state ───────────────────────────────────────────────────────────────────────────────────────────────

const hash = (v: string) => createHash("sha256").update(v).digest("hex")

export async function saveConnectState(state: string, by: string, nowMs: number): Promise<void> {
  await getDb().collection(META).doc(PENDING_STATES).collection("states").doc(hash(state)).create({ by, expiresAtMs: nowMs + 600_000 })
}

/** Consumes the state: who started it, or null when unknown, used or expired. */
export async function takeConnectState(state: string, nowMs: number): Promise<{ by: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(state)) return null
  const db = getDb()
  const ref = db.collection(META).doc(PENDING_STATES).collection("states").doc(hash(state))
  return db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data()
    if (!d) return null
    tx.delete(ref)
    return typeof d.expiresAtMs === "number" && d.expiresAtMs > nowMs ? { by: String(d.by) } : null
  })
}

// ── The People API ──────────────────────────────────────────────────────────────────────────────────────────────

export function peopleApi(deps: GcDeps): PeopleApi {
  return {
    async list({ pageToken, syncToken }) {
      const r = await peopleRequest<{ connections?: GooglePerson[]; nextPageToken?: string; nextSyncToken?: string }>(
        deps,
        "GET",
        "/v1/people/me/connections",
        { query: { personFields: PERSON_FIELDS, pageSize: "200", requestSyncToken: "true", pageToken, syncToken } },
      )
      return { connections: r.connections ?? [], nextPageToken: r.nextPageToken, nextSyncToken: r.nextSyncToken }
    },
    async get(resourceName) {
      return peopleRequest<GooglePerson>(deps, "GET", `/v1/${resourceName}`, { query: { personFields: PERSON_FIELDS } })
    },
    async update(resourceName, body, updatePersonFields) {
      return peopleRequest<GooglePerson>(deps, "PATCH", `/v1/${resourceName}:updateContact`, {
        query: { updatePersonFields, personFields: PERSON_FIELDS },
        body,
      })
    },
    async listGroups() {
      const r = await peopleRequest<{ contactGroups?: ContactGroup[] }>(deps, "GET", "/v1/contactGroups", {
        query: { pageSize: "1000", groupFields: "name,groupType" },
      })
      return r.contactGroups ?? []
    },
    async createGroup(name) {
      return peopleRequest<ContactGroup>(deps, "POST", "/v1/contactGroups", { body: { contactGroup: { name } } })
    },
    async addToGroup(group, resourceNames) {
      await peopleRequest(deps, "POST", `/v1/${group}/members:modify`, { body: { resourceNamesToAdd: resourceNames } })
    },
  }
}

// ── Waiting arrivals ────────────────────────────────────────────────────────────────────────────────────────────

const ARRIVALS = CRM_COLLECTIONS.GOOGLE_CONTACT_ARRIVALS
const arrivalId = (resourceName: string) => hash(resourceName)
/** The inbox id of a waiting arrival. */
export const arrivalActivityId = (resourceName: string) => `gc:${arrivalId(resourceName)}`

function normalizeArrival(raw: FirebaseFirestore.DocumentData): PendingArrival {
  return {
    resource_name: String(raw.resource_name ?? ""),
    etag: String(raw.etag ?? ""),
    update_time: toIsoString(raw.update_time) || undefined,
    contact_source: raw.contact_source && typeof raw.contact_source === "object" ? raw.contact_source : undefined,
    book: normalizeAddressBook(raw.book),
    groups: Array.isArray(raw.groups) ? raw.groups.filter((g: unknown): g is string => typeof g === "string") : [],
    relationship: raw.relationship === "business" ? "business" : "personal",
    arrived_at: toIsoString(raw.arrived_at),
  }
}

export const pendingStore: PendingStore = {
  async get(resourceName) {
    const d = await getDb().collection(ARRIVALS).doc(arrivalId(resourceName)).get()
    return d.exists ? normalizeArrival(d.data()!) : null
  },
  async put(arrival) {
    await getDb().collection(ARRIVALS).doc(arrivalId(arrival.resource_name)).set(stripUndefined({ ...arrival }))
    invalidateCoreView()
  },
  async remove(resourceName) {
    await getDb().collection(ARRIVALS).doc(arrivalId(resourceName)).delete()
    invalidateCoreView()
  },
}

/** A waiting arrival as an inbox item: read only, never stored as an Activity until someone saves it. */
export function arrivalToActivity(a: PendingArrival): Activity {
  const name = personFieldsFromBook(a.book).name
  return {
    id: arrivalActivityId(a.resource_name),
    type: "google_contact",
    source: "google_contacts",
    channel: "Phone",
    occurred_at: a.update_time || a.arrived_at,
    contact: contactFromBook(a.book, name),
    summary: a.relationship === "business" ? "Added on the phone, labeled Business" : "Added on the phone",
    body: a.book.notes,
    relationship: a.relationship,
    visibility: a.relationship === "personal" ? "private" : "business",
    address_book: a.book,
    read_only: true,
    triaged: false,
    created_at: a.arrived_at,
  }
}

/** Every waiting arrival, for the read view (lib/core-model/read.ts). */
export async function listArrivalActivities(): Promise<Activity[]> {
  const snap = await getDb().collection(ARRIVALS).get()
  return snap.docs.map((d) => arrivalToActivity(normalizeArrival(d.data())))
}

/** Triage's hooks: link a saved Person to its Google contact, and forget the arrival on any decision. */
export const pendingArrivals: PendingArrivals = {
  async discard(activityId) {
    const id = activityId.replace(/^gc:/, "")
    await getDb().collection(ARRIVALS).doc(id).delete()
    invalidateCoreView()
  },
  async link(person: Person, activity: Activity) {
    const id = activity.id.replace(/^gc:/, "")
    const doc = await getDb().collection(ARRIVALS).doc(id).get()
    if (!doc.exists || person.google) return person
    const a = normalizeArrival(doc.data()!)
    return firestoreCoreStore.updatePerson(person.id, {
      address_book: person.address_book ?? a.book,
      google: {
        resource_name: a.resource_name,
        etag: a.etag,
        contact_source: a.contact_source,
        update_time: a.update_time,
        snapshot: a.book,
        in_434_group: false,
        synced_at: new Date().toISOString(),
      },
    })
  },
}

// ── Sync state, the switch, the log and the lock ────────────────────────────────────────────────────────────────

const stateRef = () => getDb().collection(META).doc(SYNC_STATE)

export const syncStateStore: SyncStateStore = {
  async read() {
    const d = (await stateRef().get()).data() ?? {}
    return {
      phase: d.phase === "sync" || d.phase === "resync" ? d.phase : "import",
      page_token: typeof d.page_token === "string" ? d.page_token : undefined,
      sync_token: typeof d.sync_token === "string" ? d.sync_token : undefined,
      last_synced_at: toIsoString(d.last_synced_at) || undefined,
      group_resource_name: typeof d.group_resource_name === "string" ? d.group_resource_name : undefined,
      // Off unless the founder switched it on: anything but `true` is off.
      write_back: d.write_back === true,
      last_run_at: toIsoString(d.last_run_at) || undefined,
      last_result: d.last_result && typeof d.last_result === "object" ? (d.last_result as SyncResult) : undefined,
    }
  },
  async write(state) {
    // The switch is not written by a run: only setWriteBack changes it.
    const { write_back: _w, ...rest } = state
    await stateRef().set(stripUndefined({ ...rest, page_token: state.page_token ?? null, sync_token: state.sync_token ?? null }), { merge: true })
  },
}

export async function setWriteBack(on: boolean, by: string): Promise<void> {
  await stateRef().set({ write_back: on, write_back_changed_by: by, write_back_changed_at: new Date().toISOString() }, { merge: true })
}

const writeLog: WriteLog = {
  async record(entry) {
    await getDb().collection(CRM_COLLECTIONS.GOOGLE_CONTACT_WRITES).add(stripUndefined({ ...entry }))
  },
}

/** One run at a time, for at most five minutes. */
async function withLock<T>(fn: () => Promise<T>): Promise<T | "busy"> {
  const db = getDb()
  const ref = db.collection(META).doc(LOCK)
  const token = Math.random().toString(36).slice(2)
  const got = await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data()
    if (d && typeof d.until === "number" && d.until > Date.now()) return false
    tx.set(ref, { until: Date.now() + 300_000, token })
    return true
  })
  if (!got) return "busy"
  try {
    return await fn()
  } finally {
    await ref.delete().catch(() => {})
  }
}

// ── Runs and status ─────────────────────────────────────────────────────────────────────────────────────────────

export type RunOutcome =
  | { state: "not_configured"; missing: string[] }
  | { state: "not_connected" }
  | { state: "busy" }
  | { state: "reconnect"; message: string }
  | { state: "error"; message: string }
  | { state: "ok"; result: SyncResult }

export async function runSyncNow(): Promise<RunOutcome> {
  const setup = gcSetup()
  if (!setup.ok) return { state: "not_configured", missing: setup.missing }
  const deps = gcDeps(setup.client)
  if (!(await connectionInfo(deps))) return { state: "not_connected" }
  try {
    const out = await withLock(async () =>
      runSync({
        api: peopleApi(deps),
        store: firestoreCoreStore,
        people: {
          byResourceName: findPersonByResourceName,
          linked: async () => (await listPeople()).filter((p) => p.google && !p.merged_into),
          knownBusinessEmails: async () => {
            const view = await getCoreView()
            return new Set(view.people.filter((p) => p.relationship !== "personal").flatMap((p) => p.emails))
          },
        },
        pending: pendingStore,
        state: syncStateStore,
        log: writeLog,
        cohorts: await listIcpCohorts(),
        now: () => new Date().toISOString(),
        budgetMs: 240_000,
      }),
    )
    invalidateCoreView()
    return out === "busy" ? { state: "busy" } : { state: "ok", result: out }
  } catch (err) {
    if (err instanceof GcError) {
      console.error(`[google-contacts] run: ${err.code}`)
      return err.reconnect ? { state: "reconnect", message: err.message } : { state: "error", message: err.message }
    }
    console.error(`[google-contacts] run: ${err instanceof Error ? err.name : "error"}`)
    return { state: "error", message: "The sync failed; the next run continues" }
  }
}

export interface SyncStatus {
  configured: boolean
  missing: string[]
  connected: boolean
  connected_at?: string
  phase: SyncState["phase"]
  write_back: boolean
  last_run_at?: string
  last_result?: SyncResult
  linked: number
  waiting_for_write_back: number
}

export async function syncStatus(): Promise<SyncStatus> {
  const setup = gcSetup()
  const state = await syncStateStore.read()
  const linked = (await listPeople()).filter((p) => p.google && !p.merged_into)
  const info = setup.ok ? await connectionInfo(gcDeps(setup.client)) : null
  return {
    configured: setup.ok,
    missing: setup.ok ? [] : setup.missing,
    connected: Boolean(info),
    connected_at: info?.connectedAt,
    phase: state.phase,
    write_back: state.write_back,
    last_run_at: state.last_run_at,
    last_result: state.last_result,
    linked: linked.length,
    waiting_for_write_back: linked.filter((p) => pendingFields(p).length > 0).length,
  }
}
