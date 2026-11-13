// The address book on a Person: the whole Google Contacts record under Google's meanings (spec, "What comes over"),
// and the one rule for two copies of it: **the latest edit wins** (founder, 2026-11-13).
//
// Who changed what is decided field by field against the snapshot, the copy as Google last held it:
//   - changed only in the CRM     → the CRM value stays and is due to be written to Google;
//   - changed only in Google      → Google's value is taken;
//   - changed in both, the same   → nothing to do;
//   - changed in both, differently→ the later edit wins: Google's update time against the CRM's edit time.
// Whatever is overwritten is returned as a change, and the caller keeps it in the Person's activity history, so
// nothing is lost and it can be put back. There is no conflict inbox. Labels and the photo are Google's alone.
//
// Pure: no Firestore, no network. Tested in lib/__tests__/core-model-personal.test.ts.

import type { AddressBook, AddressBookField, Person } from "@/types/core-model"
import { ADDRESS_BOOK_WRITABLE } from "@/types/core-model"
import { normalizeEmail, splitName } from "./identity"

export function emptyAddressBook(): AddressBook {
  return {
    name: {},
    nicknames: [],
    emails: [],
    phones: [],
    addresses: [],
    events: [],
    urls: [],
    relations: [],
    custom_fields: [],
    labels: [],
    organizations: [],
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : []

function date(v: unknown) {
  const d = (v && typeof v === "object" ? v : {}) as Record<string, unknown>
  return { year: num(d.year), month: num(d.month), day: num(d.day) }
}

/** Read a stored (or mapped) address book defensively. */
export function normalizeAddressBook(raw: unknown): AddressBook {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const n = (r.name && typeof r.name === "object" ? r.name : {}) as Record<string, unknown>
  const b = r.birthday && typeof r.birthday === "object" ? (r.birthday as Record<string, unknown>) : null
  return {
    name: { given: str(n.given), family: str(n.family), middle: str(n.middle), prefix: str(n.prefix), suffix: str(n.suffix) },
    nicknames: Array.isArray(r.nicknames) ? r.nicknames.map(str).filter((x): x is string => Boolean(x)) : [],
    emails: list(r.emails).map((e) => ({ value: str(e.value) ?? "", type: str(e.type) })).filter((e) => e.value),
    phones: list(r.phones).map((p) => ({ value: str(p.value) ?? "", type: str(p.type) })).filter((p) => p.value),
    addresses: list(r.addresses).map((a) => ({
      formatted: str(a.formatted),
      street: str(a.street),
      extended: str(a.extended),
      po_box: str(a.po_box),
      city: str(a.city),
      region: str(a.region),
      postal_code: str(a.postal_code),
      country: str(a.country),
      country_code: str(a.country_code),
      type: str(a.type),
    })),
    birthday: b ? { ...date(b), text: str(b.text) } : undefined,
    events: list(r.events).map((e) => ({ date: date(e.date), type: str(e.type) })),
    urls: list(r.urls).map((u) => ({ value: str(u.value) ?? "", type: str(u.type) })).filter((u) => u.value),
    relations: list(r.relations).map((x) => ({ person: str(x.person) ?? "", type: str(x.type) })).filter((x) => x.person),
    custom_fields: list(r.custom_fields).map((c) => ({ key: str(c.key) ?? "", value: str(c.value) ?? "" })).filter((c) => c.key),
    notes: str(r.notes),
    labels: Array.isArray(r.labels) ? r.labels.map(str).filter((x): x is string => Boolean(x)) : [],
    photo_url: str(r.photo_url),
    organizations: list(r.organizations).map((o) => ({ name: str(o.name), title: str(o.title), department: str(o.department) })),
  }
}

/** A stable comparison: key order and `undefined` members never make two equal values differ. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k]
      if (x !== undefined && x !== null && x !== "") out[k] = canonical(x)
    }
    return out
  }
  return v ?? null
}
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/** The writable fields where two books differ. */
export function changedFields(a: AddressBook, b: AddressBook): AddressBookField[] {
  return ADDRESS_BOOK_WRITABLE.filter((f) => !same(a[f], b[f]))
}

export interface FieldChange {
  field: string
  /** The value that was replaced. Kept in the activity history so it can be put back. */
  before: unknown
  after: unknown
  winner: "crm" | "google"
}

export interface MergeResult {
  /** The address book the Person should now hold. */
  book: AddressBook
  /** Fields the CRM holds differently from Google: due to be written back (when write-back is on). */
  toGoogle: AddressBookField[]
  /** Every value that was overwritten, for the activity history. */
  changes: FieldChange[]
}

const ms = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

/**
 * Latest edit wins, field by field. `crmEditedAt` is when a person last edited an address-book field in the CRM;
 * `googleUpdatedAt` is Google's update time for the contact. A tie goes to Google, the copy on the phone.
 */
export function mergeLatestEditWins(input: {
  crm: AddressBook
  snapshot: AddressBook
  google: AddressBook
  crmEditedAt?: string
  googleUpdatedAt?: string
}): MergeResult {
  const { crm, snapshot, google } = input
  const book: AddressBook = { ...crm, labels: google.labels, photo_url: google.photo_url }
  const toGoogle: AddressBookField[] = []
  const changes: FieldChange[] = []
  const googleLater = ms(input.googleUpdatedAt) >= ms(input.crmEditedAt)
  const set = <F extends AddressBookField>(f: F, v: AddressBook[F]) => {
    ;(book as unknown as Record<string, unknown>)[f] = v
  }
  for (const f of ADDRESS_BOOK_WRITABLE) {
    const crmChanged = !same(crm[f], snapshot[f])
    const googleChanged = !same(google[f], snapshot[f])
    if (!googleChanged) {
      if (crmChanged) toGoogle.push(f)
      continue
    }
    if (!crmChanged || same(crm[f], google[f])) {
      if (!same(crm[f], google[f])) changes.push({ field: f, before: crm[f] ?? null, after: google[f] ?? null, winner: "google" })
      set(f, google[f])
      continue
    }
    if (googleLater) {
      changes.push({ field: f, before: crm[f] ?? null, after: google[f] ?? null, winner: "google" })
      set(f, google[f])
    } else {
      changes.push({ field: f, before: google[f] ?? null, after: crm[f] ?? null, winner: "crm" })
      toGoogle.push(f)
    }
  }
  return { book, toGoogle, changes }
}

/** The display name Google would show, built from the structured parts. */
export function bookDisplayName(book: AddressBook): string {
  const n = book.name
  return [n.prefix, n.given, n.middle, n.family, n.suffix].filter(Boolean).join(" ").trim()
}

/**
 * The Person's own fields as the address book gives them: the name, emails and phones as lists, the notes, and the
 * first title. Company and title also become an Affiliation (lib/google-contacts/sync.ts).
 */
export function personFieldsFromBook(book: AddressBook): Pick<Person, "name" | "emails" | "phones" | "notes" | "title"> {
  return {
    name:
      bookDisplayName(book) ||
      book.nicknames[0] ||
      normalizeEmail(book.emails[0]?.value) ||
      book.organizations[0]?.name ||
      book.phones[0]?.value ||
      "",
    emails: Array.from(new Set(book.emails.map((e) => normalizeEmail(e.value)).filter(Boolean))),
    phones: book.phones.map((p) => p.value),
    notes: book.notes,
    title: book.organizations[0]?.title,
  }
}

/**
 * Apply a person's edit in the CRM to the Person's address book, so it can be written back. Only the fields the
 * Person form edits: name, phones, notes and title. A phone that is kept keeps its Google type.
 */
export function applyPersonEditToBook(
  book: AddressBook,
  patch: Partial<Pick<Person, "name" | "phones" | "notes" | "title">>,
): AddressBook {
  const next: AddressBook = { ...book }
  if (patch.name !== undefined && patch.name !== bookDisplayName(book)) {
    const { firstName, lastName } = splitName(patch.name)
    next.name = { given: firstName || undefined, family: lastName || undefined }
  }
  if (patch.phones !== undefined) {
    const typeOf = new Map(book.phones.map((p) => [p.value, p.type]))
    next.phones = patch.phones.map((value) => ({ value, type: typeOf.get(value) }))
  }
  if ("notes" in patch) next.notes = patch.notes || undefined
  if ("title" in patch) {
    const [first, ...rest] = book.organizations
    next.organizations = [{ ...(first ?? {}), title: patch.title || undefined }, ...rest]
  }
  return next
}
