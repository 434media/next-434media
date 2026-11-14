// The Firestore implementation of the core model's store and of the lead path. Every write here clears the
// read view's cache (lib/core-model/read.ts) as well as the module's own list cache.

import { captureLeadFromContactForm, createLead, findLeadByEmail } from "@/lib/firestore-leads"
import * as people from "@/lib/firestore-people"
import * as orgs from "@/lib/firestore-organizations"
import * as affs from "@/lib/firestore-affiliations"
import * as acts from "@/lib/firestore-activities"
import type { LeadSource } from "@/types/crm-types"
import type { Activity, Person } from "@/types/core-model"
import { invalidateCoreView } from "./read"
import { splitName } from "./identity"
import type { CoreStore, LeadPath } from "./service"

function writes<T extends (...args: never[]) => Promise<unknown>>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } finally {
      invalidateCoreView()
    }
  }) as T
}

export const firestoreCoreStore: CoreStore = {
  getPerson: people.getPerson,
  findPersonByEmail: people.findPersonByEmail,
  createPerson: writes(people.createPerson),
  updatePerson: writes(people.updatePerson),
  reassignEmails: writes(people.reassignPersonEmails),
  getOrganization: orgs.getOrganization,
  findOrganizationByDomain: orgs.findOrganizationByDomain,
  findOrganizationByName: orgs.findOrganizationByName,
  createOrganization: writes(orgs.createOrganization),
  updateOrganization: writes(orgs.updateOrganization),
  findAffiliation: affs.findAffiliation,
  createAffiliation: writes(affs.createAffiliation),
  createActivity: writes(acts.createActivity),
  getTriage: acts.getTriage,
  recordTriage: writes(acts.recordTriage),
  recordMerge: writes(acts.recordMerge),
}

/** A Person's first-touch source as a lead source. The address book has no lead source of its own: "manual". */
function leadSourceOf(person: Person): LeadSource {
  return person.source === "google_contacts" ? "manual" : person.source
}

/**
 * The existing lead path (lib/firestore-leads.ts). A website form goes through captureLeadFromContactForm, the
 * same call the public form makes; anything else is matched by email and otherwise created with createLead.
 * Both score the lead with the shared rubric. The lead keeps the Person's first-touch source, so a prospected
 * Person stays a cold lead and the cold-outreach gate still applies to it.
 */
export const firestoreLeadPath: LeadPath = {
  async createLeadFor(person: Person, activity: Activity) {
    // Defence in depth: the service makes a Person business before it reaches here. A personal one never does.
    if (person.relationship === "personal") return { leadId: null }
    const email = person.emails[0] ?? ""
    if (!email) return { leadId: null }
    if (activity.type === "form_submission") {
      const { firstName, lastName } = splitName(activity.contact.name || person.name)
      const r = await captureLeadFromContactForm({
        firstName,
        lastName,
        company: activity.contact.company || "",
        email,
        phone: activity.contact.phone || person.phones[0],
        message: activity.body,
        source: activity.channel || "434Media",
      })
      invalidateCoreView()
      return { leadId: r.leadId }
    }
    const existing = await findLeadByEmail(email)
    if (existing) return { leadId: existing.id }
    const lead = await createLead({
      name: person.name || email,
      company: activity.contact.company || "",
      title: person.title,
      email,
      phone: person.phones[0],
      source: leadSourceOf(person),
      location: person.location,
      country: person.country,
      notes: activity.body || undefined,
      tags: [],
    })
    invalidateCoreView()
    return { leadId: lead.id }
  },
}
