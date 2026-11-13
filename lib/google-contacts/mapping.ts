// Google People API person ⟷ the Person's address book (lib/core-model/address-book.ts). Pure.
//
// Field names follow https://developers.google.com/people/api/rest/v1/people (read 2026-11-13). Everything Google
// holds comes over under its own meaning: names, nicknames, emails and phones as lists, addresses, birthday, events,
// websites, relations, custom fields (userDefined), notes (biographies), labels (contact group memberships), the photo
// and the organizations (company and title, which also become an Affiliation).

import type { ActivityContact, AddressBook, AddressBookField, Relationship } from "@/types/core-model"
import { emptyAddressBook, normalizeAddressBook } from "@/lib/core-model/address-book"
import { normalizeEmail } from "@/lib/core-model/identity"

/** Every field read on a list or get. */
export const PERSON_FIELDS = [
  "names",
  "nicknames",
  "emailAddresses",
  "phoneNumbers",
  "addresses",
  "birthdays",
  "events",
  "urls",
  "relations",
  "userDefined",
  "biographies",
  "memberships",
  "photos",
  "organizations",
  "metadata",
].join(",")

/** Our field → the People API's `updatePersonFields` name. Labels and the photo are never written. */
export const UPDATE_FIELD: Record<AddressBookField, string> = {
  name: "names",
  nicknames: "nicknames",
  emails: "emailAddresses",
  phones: "phoneNumbers",
  addresses: "addresses",
  birthday: "birthdays",
  events: "events",
  urls: "urls",
  relations: "relations",
  custom_fields: "userDefined",
  notes: "biographies",
  organizations: "organizations",
}

/** The label that makes an arrival `business` (spec, "How a person gets in"). Matched without case. */
export const BUSINESS_LABEL = "Business"
/** The contact group holding the contacts the CRM owns, and the only place it writes. */
export const CRM_GROUP_NAME = "434"

// The People API's person, only as far as this module reads it.
type Obj = Record<string, unknown>
export interface GooglePerson {
  resourceName?: string
  etag?: string
  metadata?: { deleted?: boolean; sources?: Array<{ type?: string; id?: string; etag?: string; updateTime?: string }> }
  [field: string]: unknown
}

const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => Boolean(x) && typeof x === "object") : [])
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
/** Google's `type`: a canonical one ("home", "work") or the custom label the founder typed. */
const typeOf = (x: Obj) => s(x.type)

export interface MappedContact {
  resource_name: string
  etag: string
  update_time?: string
  contact_source?: { id: string; etag: string }
  deleted: boolean
  book: AddressBook
  /** Contact group resource names, for the "434" group check. */
  groups: string[]
}

/** The update time and source Google reports for the contact itself. */
function contactSource(p: GooglePerson) {
  const sources = p.metadata?.sources ?? []
  return sources.find((x) => x.type === "CONTACT") ?? sources[0]
}

/**
 * A People API person as the address book. `groupNames` maps contact group resource names to their names, so
 * labels carry the name the founder sees ("Business"), not an id.
 */
export function fromGooglePerson(p: GooglePerson, groupNames: ReadonlyMap<string, string>): MappedContact {
  const src = contactSource(p)
  const groups = arr(p.memberships)
    .map((m) => s((m.contactGroupMembership as Obj | undefined)?.contactGroupResourceName))
    .filter((g): g is string => Boolean(g))
  const name = arr(p.names)[0] ?? {}
  const bday = arr(p.birthdays)[0]
  const bio = arr(p.biographies)[0]
  const book = normalizeAddressBook({
    name: { given: name.givenName, family: name.familyName, middle: name.middleName, prefix: name.honorificPrefix, suffix: name.honorificSuffix },
    nicknames: arr(p.nicknames).map((n) => n.value),
    emails: arr(p.emailAddresses).map((e) => ({ value: e.value, type: typeOf(e) })),
    phones: arr(p.phoneNumbers).map((e) => ({ value: e.value, type: typeOf(e) })),
    addresses: arr(p.addresses).map((a) => ({
      formatted: a.formattedValue,
      street: a.streetAddress,
      extended: a.extendedAddress,
      po_box: a.poBox,
      city: a.city,
      region: a.region,
      postal_code: a.postalCode,
      country: a.country,
      country_code: a.countryCode,
      type: typeOf(a),
    })),
    birthday: bday ? { ...((bday.date as Obj | undefined) ?? {}), text: bday.text } : undefined,
    events: arr(p.events).map((e) => ({ date: e.date, type: typeOf(e) })),
    urls: arr(p.urls).map((u) => ({ value: u.value, type: typeOf(u) })),
    relations: arr(p.relations).map((r) => ({ person: r.person, type: typeOf(r) })),
    custom_fields: arr(p.userDefined).map((u) => ({ key: u.key, value: u.value })),
    notes: bio?.value,
    labels: groups.map((g) => groupNames.get(g)).filter(Boolean),
    photo_url: arr(p.photos).find((ph) => !ph.default)?.url,
    organizations: arr(p.organizations).map((o) => ({ name: o.name, title: o.title, department: o.department })),
  })
  // A name that only exists unstructured ("Mom") is kept as the given name, so it is not lost.
  if (!book.name.given && !book.name.family && s(name.unstructuredName)) book.name.given = s(name.unstructuredName)
  return {
    resource_name: String(p.resourceName ?? ""),
    etag: String(p.etag ?? ""),
    update_time: s(src?.updateTime),
    contact_source: src?.id ? { id: String(src.id), etag: String(src.etag ?? "") } : undefined,
    deleted: p.metadata?.deleted === true,
    book: p.metadata?.deleted ? emptyAddressBook() : book,
    groups,
  }
}

/** Business when the contact carries the "Business" label; otherwise personal (fails safe: hidden, never shown). */
export function relationshipFromLabels(labels: string[]): Relationship {
  return labels.some((l) => l.trim().toLowerCase() === BUSINESS_LABEL.toLowerCase()) ? "business" : "personal"
}

/** Who an arrival is, as the inbox and the matching rules read it. */
export function contactFromBook(book: AddressBook, displayName: string): ActivityContact {
  const org = book.organizations[0]
  return {
    name: displayName || undefined,
    email: normalizeEmail(book.emails[0]?.value) || undefined,
    phone: book.phones[0]?.value,
    company: org?.name,
    title: org?.title,
  }
}

const date = (d: { year?: number; month?: number; day?: number }) =>
  Object.fromEntries(Object.entries({ year: d.year, month: d.month, day: d.day }).filter(([, v]) => typeof v === "number"))

/**
 * The People API body for an update of these fields, with the etag Google checks. Each named field is sent whole,
 * because the People API replaces a field's list on update.
 */
export function toGoogleUpdate(
  book: AddressBook,
  fields: AddressBookField[],
  link: { resource_name: string; etag: string; contact_source?: { id: string; etag: string } },
): { body: Obj; updatePersonFields: string } {
  const body: Obj = {
    resourceName: link.resource_name,
    etag: link.etag,
    metadata: { sources: link.contact_source ? [{ type: "CONTACT", id: link.contact_source.id, etag: link.contact_source.etag }] : [] },
  }
  for (const f of fields) {
    switch (f) {
      case "name":
        body.names = [
          {
            givenName: book.name.given,
            familyName: book.name.family,
            middleName: book.name.middle,
            honorificPrefix: book.name.prefix,
            honorificSuffix: book.name.suffix,
          },
        ]
        break
      case "nicknames":
        body.nicknames = book.nicknames.map((value) => ({ value }))
        break
      case "emails":
        body.emailAddresses = book.emails.map((e) => ({ value: e.value, type: e.type }))
        break
      case "phones":
        body.phoneNumbers = book.phones.map((p) => ({ value: p.value, type: p.type }))
        break
      case "addresses":
        body.addresses = book.addresses.map((a) => ({
          streetAddress: a.street,
          extendedAddress: a.extended,
          poBox: a.po_box,
          city: a.city,
          region: a.region,
          postalCode: a.postal_code,
          country: a.country,
          countryCode: a.country_code,
          type: a.type,
        }))
        break
      case "birthday":
        body.birthdays = book.birthday
          ? [book.birthday.month || book.birthday.day ? { date: date(book.birthday) } : { text: book.birthday.text }]
          : []
        break
      case "events":
        body.events = book.events.map((e) => ({ date: date(e.date), type: e.type }))
        break
      case "urls":
        body.urls = book.urls.map((u) => ({ value: u.value, type: u.type }))
        break
      case "relations":
        body.relations = book.relations.map((r) => ({ person: r.person, type: r.type }))
        break
      case "custom_fields":
        body.userDefined = book.custom_fields.map((c) => ({ key: c.key, value: c.value }))
        break
      case "notes":
        body.biographies = book.notes ? [{ value: book.notes, contentType: "TEXT_PLAIN" }] : []
        break
      case "organizations":
        body.organizations = book.organizations.map((o) => ({ name: o.name, title: o.title, department: o.department }))
        break
    }
  }
  return { body, updatePersonFields: fields.map((f) => UPDATE_FIELD[f]).join(",") }
}
