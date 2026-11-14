// The read side of the core model: stored records plus today's collections read in at read time
// (lib/core-model/adapters.ts), assembled into one view (lib/core-model/assemble.ts) and scored once.
//
// The whole view is cached for 30 s, like every CRM list, and built once per window: concurrent requests share
// one build, and read-time scoring of adapted organizations runs once per build, not per request. Every core
// write clears it (lib/core-model/firestore-store.ts). An old source that fails to read is left out and named in
// `warnings`; the view still loads.

import { listPeople } from "@/lib/firestore-people"
import { listOrganizations } from "@/lib/firestore-organizations"
import { listAffiliations } from "@/lib/firestore-affiliations"
import { listActivities, listTriage } from "@/lib/firestore-activities"
import { getLeads } from "@/lib/firestore-leads"
import { getClients } from "@/lib/firestore-crm"
import { getContactForms } from "@/lib/firestore-contact-forms"
import { getAllStatesForSource } from "@/lib/firestore-submission-states"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import type { Activity, InboxItem, Organization, Person } from "@/types/core-model"
import { adaptClient, adaptContactForm, adaptLead, type CoreBundle } from "./adapters"
import { assembleCoreView, inboxOf, type CoreView } from "./assemble"
import { scoreOrganization } from "./score"
import { filterViewFor, type Viewer } from "./view-filter"
import { listArrivalActivities } from "@/lib/google-contacts/server"

export interface BuiltCoreView extends CoreView {
  warnings: string[]
  built_at: string
}

const CACHE_TTL = 30 * 1000
let cache: { data: BuiltCoreView; ts: number } | null = null
let inFlight: Promise<BuiltCoreView> | null = null
let generation = 0

export function invalidateCoreView(): void {
  cache = null
  generation++
}

async function settle<T>(label: string, p: Promise<T>, fallback: T, warnings: string[]): Promise<T> {
  try {
    return await p
  } catch (err) {
    console.error(`[core-model/read] ${label} failed:`, err)
    warnings.push(`${label} could not be read`)
    return fallback
  }
}

async function build(): Promise<BuiltCoreView> {
  const warnings: string[] = []
  const [people, organizations, affiliations, activities, triage, leads, clients, forms, formStates, cohorts, arrivals] = await Promise.all([
    listPeople(),
    listOrganizations(),
    listAffiliations(),
    listActivities(),
    listTriage(),
    settle("Leads", getLeads(), [], warnings),
    settle("Clients", getClients(), [], warnings),
    settle("Contact forms", getContactForms(), [], warnings),
    settle("Contact form states", getAllStatesForSource("contact_forms"), new Map(), warnings),
    settle("ICP cohorts", listIcpCohorts(), [], warnings),
    settle("Google Contacts arrivals", listArrivalActivities(), [], warnings),
  ])

  const stored: CoreBundle = { people, organizations, affiliations, activities }
  const adapted: CoreBundle[] = [
    ...leads.map(adaptLead),
    ...clients.map(adaptClient),
    ...forms.map((f) => {
      const state = f.id ? formStates.get(f.id) : undefined
      return adaptContactForm(f, Boolean(state && state !== "new"))
    }),
    // Phone arrivals waiting for a decision: read only, never stored as Activities until someone saves them.
    { people: [], organizations: [], affiliations: [], activities: arrivals },
  ]
  const view = assembleCoreView(stored, adapted, new Set(triage.keys()))

  // Scoring on arrival: a stored Organization was scored when it was created; one read in from an old collection
  // is scored here, once per build, with the same rubric.
  const at = new Date().toISOString()
  view.organizations = view.organizations.map((o) =>
    typeof o.icp_fit_score === "number" ? o : { ...o, ...scoreOrganization(o, cohorts, at) },
  )
  return { ...view, warnings, built_at: at }
}

export async function getCoreView(): Promise<BuiltCoreView> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data
  if (inFlight) return inFlight
  const startedAt = generation
  inFlight = build()
    .then((data) => {
      // A write during the build makes this result stale: serve it to the waiting callers, but don't cache it.
      if (startedAt === generation) cache = { data, ts: Date.now() }
      return data
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export type { Viewer } from "./view-filter"

/** The view a viewer may see (filterViewFor over the cached whole view). */
export async function getVisibleCoreView(viewer: Viewer): Promise<BuiltCoreView> {
  return filterViewFor(await getCoreView(), viewer)
}

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

/** One Person with their affiliations (and organizations) and timeline. */
export function personDetail(view: CoreView, id: string) {
  const person = view.people.find((p) => p.id === id)
  if (!person) return null
  const orgs = new Map(view.organizations.map((o) => [o.id, o]))
  const affiliations = view.affiliations
    .filter((a) => a.person_id === id)
    .map((a) => ({ ...a, organization: orgs.get(a.organization_id) as Organization | undefined }))
  const activities: Activity[] = view.activities.filter((a) => a.person_id === id)
  return { person, affiliations, activities }
}

/** One Organization with its people and timeline. */
export function organizationDetail(view: CoreView, id: string) {
  const organization = view.organizations.find((o) => o.id === id)
  if (!organization) return null
  const people = new Map(view.people.map((p) => [p.id, p]))
  const affiliations = view.affiliations
    .filter((a) => a.organization_id === id)
    .map((a) => ({ ...a, person: people.get(a.person_id) as Person | undefined }))
  const activities = view.activities.filter((a) => a.organization_id === id)
  return { organization, affiliations, activities }
}
