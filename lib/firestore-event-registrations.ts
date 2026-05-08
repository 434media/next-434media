import { getDb, getNamedDb, getDigitalCanvasDb, COLLECTIONS, NAMED_DATABASES } from "./firebase-admin"
import { getSaTechDay2026RoleTags } from "./event-roles/sa-tech-day-2026"

// Event Registration interface
export interface EventRegistration {
  id?: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  company: string | null
  subscribeToFeed: boolean
  event: string
  eventName: string
  eventDate: string
  registeredAt: string
  source: string
  tags: string[]
  pageUrl: string
  checkedIn?: boolean
  checkedInAt?: string
  // Provenance stamps. Set by `updateEventRegistration` whenever a field is
  // backfilled from the admin drawer so we can answer "who last touched this
  // row and when?" without a separate audit collection.
  enrichedAt?: string
  enrichedBy?: string
  enrichmentSource?: "manual" | "csv" | "api"
  _dbSource?: string // Track which database this came from
  // Set when this registrant has been promoted into the leads pipeline.
  // The Lead record's `origin_ref` carries the reverse pointer.
  promotedLeadId?: string
  promotedAt?: string
}

const COLLECTION = COLLECTIONS.EVENT_REGISTRATIONS

/**
 * Convert a Firestore Timestamp or date value to ISO string
 */
function toISOString(value: unknown): string {
  if (!value) return ""
  // Firestore Timestamp object (has _seconds or seconds property)
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    const seconds = (v._seconds ?? v.seconds) as number | undefined
    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toISOString()
    }
    // Firestore Timestamp with toDate() method
    if (typeof (v as { toDate?: () => Date }).toDate === "function") {
      return (v as { toDate: () => Date }).toDate().toISOString()
    }
  }
  // Already a string
  if (typeof value === "string") return value
  // Number (milliseconds)
  if (typeof value === "number") return new Date(value).toISOString()
  return ""
}

/**
 * Map a Firestore doc to an EventRegistration (default DB format)
 * Handles both string dates and Firestore Timestamp objects
 */
function mapDefaultDoc(doc: FirebaseFirestore.DocumentSnapshot): EventRegistration {
  const data = doc.data()!
  return {
    id: doc.id,
    email: data.email || "",
    firstName: data.firstName || data.first_name || "",
    lastName: data.lastName || data.last_name || "",
    fullName: data.fullName || data.full_name || data.name || "",
    company: data.company || null,
    subscribeToFeed: data.subscribeToFeed || data.subscribe_to_feed || false,
    event: data.event || "",
    eventName: data.eventName || data.event_name || "",
    eventDate: toISOString(data.eventDate || data.event_date || ""),
    registeredAt: toISOString(data.registeredAt || data.registered_at || data.createdAt || data.created_at || ""),
    source: data.source || "",
    tags: data.tags || [],
    pageUrl: data.pageUrl || data.page_url || "",
    checkedIn: data.checkedIn || false,
    checkedInAt: toISOString(data.checkedInAt || ""),
    enrichedAt: data.enrichedAt ? toISOString(data.enrichedAt) : undefined,
    enrichedBy: data.enrichedBy || undefined,
    enrichmentSource: data.enrichmentSource || undefined,
    promotedLeadId: data.promotedLeadId || undefined,
    promotedAt: data.promotedAt ? toISOString(data.promotedAt) : undefined,
    _dbSource: "default",
  }
}

/**
 * Map a techday registration doc to the EventRegistration interface
 */
function mapTechdayDoc(doc: FirebaseFirestore.DocumentSnapshot): EventRegistration {
  const data = doc.data()!
  const registeredAt = data.createdAt?._seconds
    ? new Date(data.createdAt._seconds * 1000).toISOString()
    : data.createdAt || ""

  // Normalize tech-fuel detection. The events array can contain any of
  // "tech-fuel", "Tech Fuel", "techfuel", "tech_fuel", "TechFuel" etc. depending
  // on how the registration form serialized it. Surface a canonical
  // `role:tech-fuel-attendee` tag so the admin can filter on it consistently.
  const events = Array.isArray(data.events) ? (data.events as string[]) : []
  const hasTechFuel = events.some(
    (e) => typeof e === "string" && e.toLowerCase().replace(/[\s_]/g, "-") === "tech-fuel",
  )

  // Base tags: source-DB hint, event identifier, client engagement, and the
  // raw `events` array passthrough. `client:techbloc` reflects that Tech Day
  // is delivered as a scope of work for the Techbloc client engagement.
  const tags: string[] = [
    "site:techday",
    "event:sa-tech-day-2026",
    "client:techbloc",
    ...events,
  ]

  // Role tags. Tech Fuel attendance is auto-detected from the events array;
  // tech-day-attendee is the default for everyone in the techday `event-
  // registration` collection. Speakers / pitch companies / semi-final judges
  // are joined in from the role overlay file (email match).
  if (hasTechFuel) {
    tags.push("role:tech-fuel-attendee")
  } else {
    tags.push("role:tech-day-attendee")
  }
  for (const roleTag of getSaTechDay2026RoleTags(data.email)) {
    if (!tags.includes(roleTag)) tags.push(roleTag)
  }

  return {
    id: `techday:${doc.id}`,
    email: data.email || "",
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
    company: data.company || null,
    subscribeToFeed: false,
    event: "SATechDay2026",
    eventName: "SA Tech Day 2026",
    eventDate: "2026-04-10",
    registeredAt,
    // Canonical source label per the parent/child Firebase architecture: rows
    // from the techday named DB surface as `source: "techday"` so the admin
    // sees one bucket per child site.
    source: "techday",
    tags,
    pageUrl: "https://www.sanantoniotechday.com",
    checkedIn: data.checkedIn || false,
    checkedInAt: data.checkedInAt ? toISOString(data.checkedInAt) : "",
    promotedLeadId: data.promotedLeadId || undefined,
    promotedAt: data.promotedAt ? toISOString(data.promotedAt) : undefined,
    _dbSource: "techday",
  }
}

/**
 * Fetch registrations from the techday named database
 */
async function getTechdayRegistrations(filters?: { event?: string }): Promise<EventRegistration[]> {
  try {
    // If filtering by a non-techday event, skip
    if (filters?.event && filters.event !== "SATechDay2026") return []

    const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
    const snapshot = await tdDb.collection("registrations").get()
    return snapshot.docs.map(mapTechdayDoc)
  } catch (error) {
    console.error("Error fetching techday registrations:", error)
    return []
  }
}

/**
 * Fetch registrations from the Digital Canvas Firestore project (media-analytics-proxy).
 * Digital Canvas writes to the "event-registrations" collection (hyphenated)
 * in a completely separate GCP project.
 */
async function getDigitalCanvasRegistrations(filters?: { event?: string }): Promise<EventRegistration[]> {
  try {
    // If filtering by a non-MHTH event, skip
    if (filters?.event && filters.event !== "MoreHumanThanHuman2026") return []

    const dcDb = getDigitalCanvasDb()
    const snapshot = await dcDb.collection("event-registrations").get()
    return snapshot.docs.map((doc) => {
      const data = doc.data()

      // Canonical namespaced tags for every MHTH registrant. Mirrors the
      // pattern used for techday: site:* (provenance / brand-owned property),
      // event:* (event identifier with year), role:* (default attendee).
      // Raw `data.tags` passthrough preserves any registration-form-specific
      // tags so we don't lose data the form may have attached.
      const incomingTags = Array.isArray(data.tags) ? (data.tags as string[]) : []
      const tags: string[] = [
        "site:digitalcanvas",
        "event:more-human-than-human-2026",
        "role:mhth-attendee",
        ...incomingTags,
      ]

      return {
        id: `dc:${doc.id}`,
        email: data.email || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        fullName: data.fullName || "",
        company: data.company || null,
        subscribeToFeed: data.subscribeToFeed || false,
        event: data.event || "MoreHumanThanHuman2026",
        eventName: data.eventName || "More Human Than Human",
        eventDate: toISOString(data.eventDate || "2026-02-28"),
        registeredAt: toISOString(data.registeredAt || data.createdAt || ""),
        source: data.source || "web-digitalcanvas",
        tags,
        pageUrl: data.pageUrl || "",
        checkedIn: data.checkedIn || false,
        checkedInAt: data.checkedInAt ? toISOString(data.checkedInAt) : "",
        _dbSource: "digitalcanvas",
      }
    })
  } catch (error) {
    console.error("Error fetching Digital Canvas registrations:", error)
    return []
  }
}

/**
 * Deduplicate registrations across databases by email+event+name
 * Default DB registrations take priority (they may have been enriched).
 * Tags are merged across duplicates so speaker/spotlight tags are never lost.
 * Uses email+event+firstName+lastName as the key so that different people
 * sharing a placeholder email (e.g. "speaker@mail.com") are kept separate.
 */
function deduplicateRegistrations(registrations: EventRegistration[]): EventRegistration[] {
  const seen = new Map<string, EventRegistration>()
  for (const reg of registrations) {
    const key = `${reg.email.toLowerCase()}|${reg.event}|${reg.firstName.toLowerCase()}|${reg.lastName.toLowerCase()}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, reg)
    } else {
      // Merge tags from both records so enriched tags are never dropped
      const mergedTags = Array.from(new Set([...existing.tags, ...reg.tags]))
      // Prefer default DB record as the base
      if (reg._dbSource === "default" && existing._dbSource !== "default") {
        seen.set(key, { ...reg, tags: mergedTags })
      } else {
        seen.set(key, { ...existing, tags: mergedTags })
      }
    }
  }
  return Array.from(seen.values())
}

/**
 * Get event registrations with optional filtering
 * Merges results from:
 *  1. Default DB (groovy-ego) — event_registrations collection
 *  2. Techday named DB (groovy-ego/techday) — registrations collection
 *  3. Digital Canvas project (media-analytics-proxy) — event-registrations collection
 */
export async function getEventRegistrations(filters?: {
  event?: string
  source?: string
}): Promise<EventRegistration[]> {
  try {
    // Fetch from default DB
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTION)

    if (filters?.event) {
      query = query.where("event", "==", filters.event)
    }
    if (filters?.source) {
      query = query.where("source", "==", filters.source)
    }

    const [defaultSnapshot, techdayRegs, dcRegs] = await Promise.all([
      query.get(),
      getTechdayRegistrations(filters),
      getDigitalCanvasRegistrations(filters),
    ])

    const defaultRegs = defaultSnapshot.docs.map(mapDefaultDoc)

    // If filtering by source and it's not one of the named-DB sources, only
    // return default. Accept both new ("techday") and legacy ("SATechDay")
    // labels for techday so existing bookmarks/links keep working.
    if (
      filters?.source &&
      filters.source !== "techday" &&
      filters.source !== "SATechDay" &&
      filters.source !== "web-digitalcanvas"
    ) {
      return defaultRegs
    }

    // Merge and deduplicate across default DB + named DBs + separate projects.
    const allRegs = deduplicateRegistrations([
      ...defaultRegs,
      ...techdayRegs,
      ...dcRegs,
    ])
    return allRegs
  } catch (error) {
    console.error("Error fetching event registrations:", error)
    throw new Error("Failed to fetch event registrations")
  }
}

/**
 * Get unique event names from registrations
 */
export async function getEventNames(): Promise<string[]> {
  try {
    const db = getDb()
    const snapshot = await db.collection(COLLECTION).get()
    const events = new Set<string>()
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.eventName) events.add(data.eventName)
    })
    return Array.from(events).sort()
  } catch (error) {
    console.error("Error fetching event names:", error)
    return []
  }
}

/**
 * Get counts by event (merges default + techday + digitalcanvas databases)
 */
export async function getEventRegistrationCounts(): Promise<Record<string, number>> {
  try {
    const allRegs = await getEventRegistrations()
    const counts: Record<string, number> = {}
    allRegs.forEach((reg) => {
      const name = reg.eventName || "Unknown"
      counts[name] = (counts[name] || 0) + 1
    })
    return counts
  } catch (error) {
    console.error("Error fetching event registration counts:", error)
    return {}
  }
}

// Fields that may be edited freely (operational state).
type FreeEditField = "checkedIn" | "checkedInAt" | "tags" | "source"
// Fields that may only be BACKFILLED — if the existing value is non-empty,
// the write is rejected. Prevents the drawer from rewriting captured history
// (e.g. overwriting the company a registrant typed at signup with a "cleaner"
// version) while still letting admins fill in the blanks on sparse rows.
type BackfillField = "firstName" | "lastName" | "fullName" | "company"

export type UpdateEventRegistrationFields = Partial<
  Pick<EventRegistration, FreeEditField | BackfillField>
>

const BACKFILL_FIELDS: BackfillField[] = ["firstName", "lastName", "fullName", "company"]

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "")
}

/**
 * Update fields on an event registration.
 *
 * Two write modes:
 *  - Free edit: `checkedIn`, `checkedInAt`, `tags`, `source` (operational
 *    state, no provenance penalty for changing).
 *  - Backfill only: `firstName`, `lastName`, `fullName`, `company` — the
 *    write is REJECTED if the existing field already has a value. This
 *    enforces the "fill in blanks, never rewrite history" rule from the
 *    data-capture spec.
 *
 * On any successful write the function stamps `enrichedAt`, `enrichedBy`,
 * `enrichmentSource` on the row so we can answer "who last touched this and
 * when" without an audit collection.
 *
 * Backfill validation only runs on the default DB (the only one that owns
 * persisted rows post-Sprint-2 ingest). Techday/Digital Canvas paths skip
 * the read-then-write because they're updated through their own forms.
 */
export async function updateEventRegistration(
  id: string,
  fields: UpdateEventRegistrationFields,
  context?: { editorEmail?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    // techday / Digital Canvas — pass through, no backfill enforcement.
    if (id.startsWith("techday:")) {
      const realId = id.replace("techday:", "")
      const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
      await tdDb.collection("registrations").doc(realId).update(fields)
      return { success: true }
    }
    if (id.startsWith("dc:")) {
      const realId = id.replace("dc:", "")
      const dcDb = getDigitalCanvasDb()
      await dcDb.collection("event-registrations").doc(realId).update(fields)
      return { success: true }
    }

    const db = getDb()
    const docRef = db.collection(COLLECTION).doc(id)

    // Server-side backfill enforcement: only fetch + check when the caller
    // is touching one of the locked-down fields. Avoids an extra read for
    // the common case (check-in toggle, tag edit) which is hot during day-of
    // event ops.
    const backfillKeys = Object.keys(fields).filter((k) =>
      BACKFILL_FIELDS.includes(k as BackfillField),
    ) as BackfillField[]

    let willStampProvenance = backfillKeys.length > 0

    if (backfillKeys.length > 0) {
      const snapshot = await docRef.get()
      if (!snapshot.exists) {
        return { success: false, error: "Registration not found" }
      }
      const data = snapshot.data() ?? {}
      for (const key of backfillKeys) {
        const incoming = fields[key]
        const existing = data[key]
        if (isBlank(incoming)) continue
        if (!isBlank(existing) && existing !== incoming) {
          // Reject the write entirely rather than partially apply — keeps
          // the client's mental model honest ("save failed, refresh").
          return {
            success: false,
            error: `Field "${key}" already has a value. This admin only allows backfilling blanks.`,
          }
        }
      }
    }

    const writeFields: Record<string, unknown> = { ...fields }
    if (willStampProvenance) {
      writeFields.enrichedAt = new Date().toISOString()
      writeFields.enrichedBy = context?.editorEmail || "unknown"
      writeFields.enrichmentSource = "manual"
    }

    await docRef.update(writeFields)
    return { success: true }
  } catch (error) {
    console.error("Error updating event registration:", error)
    return { success: false, error: "Failed to update event registration" }
  }
}

/**
 * Add a new event registration (e.g. walk-up at event day)
 * Writes to the default database event_registrations collection.
 * If a registration with the same email+event already exists, merges tags
 * instead of creating a duplicate.
 */
export async function addEventRegistration(
  registration: Omit<EventRegistration, "id">
): Promise<{ success: boolean; id?: string; merged?: boolean; error?: string }> {
  try {
    const db = getDb()

    // Check for existing registration with the same email + event + name
    // Query by email only (single-field index) and filter in JS
    // to avoid requiring a composite Firestore index
    const emailSnapshot = await db
      .collection(COLLECTION)
      .where("email", "==", registration.email)
      .get()

    const matchingDoc = emailSnapshot.docs.find(
      (doc) => {
        const data = doc.data()
        return data.event === registration.event
          && (data.firstName || "").toLowerCase() === (registration.firstName || "").toLowerCase()
          && (data.lastName || "").toLowerCase() === (registration.lastName || "").toLowerCase()
      }
    )

    if (matchingDoc) {
      // Merge tags into the existing record
      const data = matchingDoc.data()
      const existingTags: string[] = data.tags || []
      const newTags = registration.tags || []
      const mergedTags = Array.from(new Set([...existingTags, ...newTags]))

      await matchingDoc.ref.update({ tags: mergedTags })
      return { success: true, id: matchingDoc.id, merged: true }
    }

    // No existing record — create a new one
    const docRef = await db.collection(COLLECTION).add({
      ...registration,
      registeredAt: registration.registeredAt || new Date().toISOString(),
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    console.error("Error adding event registration:", error)
    return { success: false, error: "Failed to add event registration" }
  }
}

/**
 * Delete an event registration
 * Supports deletion from default, techday, and digitalcanvas databases
 */
export async function deleteEventRegistration(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if this is a techday-prefixed ID
    if (id.startsWith("techday:")) {
      const realId = id.replace("techday:", "")
      const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
      await tdDb.collection("registrations").doc(realId).delete()
      return { success: true }
    }

    // Check if this is a digitalcanvas-prefixed ID
    if (id.startsWith("dc:")) {
      const realId = id.replace("dc:", "")
      const dcDb = getDigitalCanvasDb()
      await dcDb.collection("event-registrations").doc(realId).delete()
      return { success: true }
    }

    const db = getDb()
    await db.collection(COLLECTION).doc(id).delete()
    return { success: true }
  } catch (error) {
    console.error("Error deleting event registration:", error)
    return { success: false, error: "Failed to delete event registration" }
  }
}

/**
 * Convert event registrations to CSV
 */
export function eventRegistrationsToCSV(registrations: EventRegistration[]): string {
  const headers = ["First Name", "Last Name", "Email", "Company", "Event", "Event Date", "Registered At", "Subscribe to Feed", "Source"]
  const rows = registrations.map((r) => [
    r.firstName,
    r.lastName,
    r.email,
    r.company || "",
    r.eventName,
    r.eventDate,
    r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "",
    r.subscribeToFeed ? "Yes" : "No",
    r.source,
  ])

  const escape = (val: string) => {
    const s = String(val).replace(/"/g, '""')
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s
  }

  return [headers.join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n")
}

/**
 * Mark an event registration as promoted to the leads pipeline. Routes the
 * write to the right database based on the id prefix (techday: / dc: / default).
 * Called by /api/admin/leads/promote-from-audience.
 */
export async function markEventRegistrationPromoted(
  id: string,
  leadId: string,
): Promise<void> {
  const update = {
    promotedLeadId: leadId,
    promotedAt: new Date().toISOString(),
  }

  if (id.startsWith("techday:")) {
    const realId = id.replace("techday:", "")
    const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
    await tdDb.collection("registrations").doc(realId).update(update)
    return
  }
  if (id.startsWith("dc:")) {
    const realId = id.replace("dc:", "")
    const dcDb = getDigitalCanvasDb()
    await dcDb.collection("event-registrations").doc(realId).update(update)
    return
  }
  const db = getDb()
  await db.collection(COLLECTIONS.EVENT_REGISTRATIONS).doc(id).update(update)
}

/**
 * Look up a single event registration across all known DBs by its prefixed id.
 * Used by the promote endpoint to read the contact details before creating a Lead.
 */
export async function getEventRegistrationById(
  id: string,
): Promise<EventRegistration | null> {
  if (id.startsWith("techday:")) {
    const realId = id.replace("techday:", "")
    const tdDb = getNamedDb(NAMED_DATABASES.TECHDAY)
    const doc = await tdDb.collection("registrations").doc(realId).get()
    if (!doc.exists) return null
    return mapTechdayDoc(doc)
  }
  if (id.startsWith("dc:")) {
    // Digital Canvas mapping isn't a single doc fetch — the existing code
    // pulls them in bulk via a different path. Defer dc: promotion until the
    // dc-specific mapper is wired here.
    return null
  }
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.EVENT_REGISTRATIONS).doc(id).get()
  if (!doc.exists) return null
  return mapDefaultDoc(doc)
}
