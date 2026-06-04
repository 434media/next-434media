import { getDb, COLLECTIONS } from "./firebase-admin"

// Audience-side record imported from a partner-shared roster (Alamo Angels,
// SA Tech week sponsors, etc). Lighter than `Lead` — holds contact + partner
// provenance + import receipt only. When someone "promotes" this member into
// the active leads pipeline, a `Lead` doc is created and `promotedLeadId` is
// set here as a backlink.
export interface PartnerListMember {
  id?: string

  // Identity
  email: string
  fullName: string
  firstName?: string
  lastName?: string
  preferredName?: string

  // Contact
  company?: string
  phone?: string
  linkedin?: string

  // Partner provenance — drives the partner-cohort filter on Audiences > Lists.
  partnerSlug: string
  partnerName: string

  // Import metadata
  importedAt: string  // ISO timestamp of first import
  updatedAt?: string  // ISO timestamp of most recent backfill / re-import
  joinedAt?: string   // ISO date if the source list provided one

  // Re-import / enrichment receipts — newest line appended on top.
  notes?: string

  // Free-form tags. Conventionally namespaced (e.g. "demographic:woman-investor").
  tags: string[]

  // Promotion backlink — set when a Lead is created from this member.
  promotedLeadId?: string
  promotedAt?: string
}

const COLLECTION = COLLECTIONS.PARTNER_LIST_MEMBERS

function toISOString(value: unknown): string {
  if (!value) return ""
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>
    const seconds = (v._seconds ?? v.seconds) as number | undefined
    if (typeof seconds === "number") return new Date(seconds * 1000).toISOString()
    if (typeof (v as { toDate?: () => Date }).toDate === "function") {
      return (v as { toDate: () => Date }).toDate().toISOString()
    }
  }
  if (typeof value === "string") return value
  if (typeof value === "number") return new Date(value).toISOString()
  return ""
}

function mapDoc(doc: FirebaseFirestore.DocumentSnapshot): PartnerListMember {
  const data = doc.data()!
  return {
    id: doc.id,
    email: data.email || "",
    fullName: data.fullName || "",
    firstName: data.firstName || undefined,
    lastName: data.lastName || undefined,
    preferredName: data.preferredName || undefined,
    company: data.company || undefined,
    phone: data.phone || undefined,
    linkedin: data.linkedin || undefined,
    partnerSlug: data.partnerSlug || "",
    partnerName: data.partnerName || "",
    importedAt: toISOString(data.importedAt),
    updatedAt: data.updatedAt ? toISOString(data.updatedAt) : undefined,
    joinedAt: data.joinedAt ? toISOString(data.joinedAt) : undefined,
    notes: data.notes || undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    promotedLeadId: data.promotedLeadId || undefined,
    promotedAt: data.promotedAt ? toISOString(data.promotedAt) : undefined,
  }
}

export async function findPartnerListMemberByEmail(
  email: string,
): Promise<PartnerListMember | null> {
  const db = getDb()
  const normalized = email.trim().toLowerCase()
  const snap = await db
    .collection(COLLECTION)
    .where("email", "==", normalized)
    .limit(1)
    .get()
  if (snap.empty) return null
  return mapDoc(snap.docs[0])
}

export async function getPartnerListMember(
  id: string,
): Promise<PartnerListMember | null> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null
  return mapDoc(doc)
}

interface ListPartnerMembersOptions {
  partnerSlug?: string
  /** Cap results — defaults to 1000 since the dataset is small. */
  limit?: number
}

export async function listPartnerListMembers(
  opts: ListPartnerMembersOptions = {},
): Promise<PartnerListMember[]> {
  const db = getDb()
  let query: FirebaseFirestore.Query = db.collection(COLLECTION)
  if (opts.partnerSlug) {
    query = query.where("partnerSlug", "==", opts.partnerSlug)
  }
  query = query.limit(opts.limit ?? 1000)
  const snap = await query.get()
  return snap.docs.map(mapDoc)
}

export interface PartnerListMemberCapture {
  email: string
  firstName?: string
  lastName?: string
  preferredName?: string
  company?: string
  phone?: string
  linkedin?: string
  partnerSlug: string
  partnerName: string
  joinedAt?: string
  extraTags?: string[]
  noteSuffix?: string
}

/**
 * Idempotent upsert from a partner-list import row. Re-importing the same
 * email merges tags, appends an import receipt to notes, and backfills any
 * blank contact fields without overwriting existing values. Mirrors the
 * "history-preserving" pattern used by EventRegistration backfills.
 */
export async function capturePartnerListMember(
  input: PartnerListMemberCapture,
): Promise<{ id: string; created: boolean }> {
  const db = getDb()
  const email = input.email.trim().toLowerCase()
  const fullName =
    input.preferredName?.trim() ||
    `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() ||
    email

  const captureTags = Array.from(
    new Set([
      "source:partner",
      `partner:${input.partnerSlug}`,
      ...(input.extraTags ?? []),
    ]),
  )

  const stamp = (input.joinedAt || new Date().toISOString()).split("T")[0]
  const noteLine = `[${stamp}] Imported from ${input.partnerName}${
    input.noteSuffix ? ` — ${input.noteSuffix}` : ""
  }`

  const existing = await findPartnerListMemberByEmail(email)
  const now = new Date().toISOString()

  if (existing && existing.id) {
    const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...captureTags]))
    const mergedNotes = [existing.notes, noteLine].filter(Boolean).join("\n\n")

    const patch: Partial<PartnerListMember> = {
      tags: mergedTags,
      notes: mergedNotes,
      updatedAt: now,
    }
    // Backfill-only — never overwrite existing values.
    if (!existing.firstName && input.firstName) patch.firstName = input.firstName
    if (!existing.lastName && input.lastName) patch.lastName = input.lastName
    if (!existing.preferredName && input.preferredName) {
      patch.preferredName = input.preferredName
      // Re-derive fullName if preferred name was filled in for the first time.
      if (existing.fullName === existing.email || existing.fullName === "") {
        patch.fullName = input.preferredName
      }
    }
    if (!existing.company && input.company) patch.company = input.company
    if (!existing.phone && input.phone) patch.phone = input.phone
    if (!existing.linkedin && input.linkedin) patch.linkedin = input.linkedin

    await db.collection(COLLECTION).doc(existing.id).update(patch)
    return { id: existing.id, created: false }
  }

  const newDoc: PartnerListMember = {
    email,
    fullName,
    firstName: input.firstName,
    lastName: input.lastName,
    preferredName: input.preferredName,
    company: input.company,
    phone: input.phone,
    linkedin: input.linkedin,
    partnerSlug: input.partnerSlug,
    partnerName: input.partnerName,
    importedAt: now,
    updatedAt: now,
    joinedAt: input.joinedAt,
    notes: noteLine,
    tags: captureTags,
  }

  // Strip undefined fields so Firestore doesn't store explicit nulls/undefineds.
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(newDoc)) {
    if (v !== undefined) cleaned[k] = v
  }

  const ref = await db.collection(COLLECTION).add(cleaned)
  return { id: ref.id, created: true }
}

export async function updatePartnerListMember(
  id: string,
  patch: Partial<Omit<PartnerListMember, "id" | "email" | "importedAt">>,
): Promise<void> {
  const db = getDb()
  const cleaned: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleaned[k] = v
  }
  await db.collection(COLLECTION).doc(id).update(cleaned)
}

export async function deletePartnerListMember(id: string): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).delete()
}

/**
 * Mark a partner-list member as promoted to the leads pipeline. Called by
 * the unified /api/admin/leads/promote-from-audience endpoint (forthcoming).
 */
export async function markPartnerListMemberPromoted(
  id: string,
  leadId: string | null,
): Promise<void> {
  // leadId null = un-promote: clear the backlink so the cohort member returns
  // to a normal, re-promotable state (used when a mistaken promotion is undone).
  const db = getDb()
  await db.collection(COLLECTION).doc(id).update({
    promotedLeadId: leadId ?? null,
    promotedAt: leadId ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  })
}
