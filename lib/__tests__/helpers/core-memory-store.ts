// The in-memory core store and lead path the core-model tests run against (no Firestore).

import type { Activity, Affiliation, MergeRecord, Organization, Person, TriageRecord } from "../../../types/core-model"
import type { ActivityInput } from "../../core-model/activity"
import { normalizeEmail, organizationNameKey } from "../../core-model/identity"
import { stageMoveRefusal } from "../../core-model/lifecycle"
import { CoreRuleError, DuplicateError, type CoreStore, type LeadPath, type NewAffiliation, type NewOrganization, type NewPerson } from "../../core-model/service"

export const AT = "2026-11-13T15:00:00.000Z"

// ── An in-memory store that counts every write ─────────────────────────────────────────────────────────────

export class MemoryStore implements CoreStore {
  people = new Map<string, Person>()
  orgs = new Map<string, Organization>()
  affs = new Map<string, Affiliation>()
  activities = new Map<string, Activity>()
  triage = new Map<string, TriageRecord>()
  merges: Omit<MergeRecord, "id">[] = []
  emailIndex = new Map<string, string>()
  domainIndex = new Map<string, string>()
  writes = 0
  private seq = 0
  private id(prefix: string) {
    return `${prefix}${++this.seq}`
  }
  async getPerson(id: string) {
    return this.people.get(id) ?? null
  }
  async findPersonByEmail(email: string) {
    const id = this.emailIndex.get(normalizeEmail(email))
    return id ? (this.people.get(id) ?? null) : null
  }
  async createPerson(input: NewPerson) {
    for (const e of input.emails) {
      const held = this.emailIndex.get(e)
      if (held) throw new DuplicateError(`${e} is held`, held)
    }
    this.writes++
    const p: Person = { ...input, id: this.id("p"), created_at: AT, updated_at: AT }
    this.people.set(p.id, p)
    for (const e of p.emails) this.emailIndex.set(e, p.id)
    return p
  }
  async updatePerson(id: string, patch: Partial<NewPerson>) {
    // As the Firestore store: a client never reverts, whatever path calls it.
    const refusal = stageMoveRefusal(this.people.get(id)?.lifecycle_stage, patch.lifecycle_stage)
    if (refusal) throw new CoreRuleError(refusal, 409)
    for (const e of patch.emails ?? []) {
      const held = this.emailIndex.get(e)
      if (held && held !== id) throw new DuplicateError(`${e} is held`, held)
    }
    this.writes++
    const p = { ...(this.people.get(id) as Person), ...patch, updated_at: AT }
    this.people.set(id, p)
    for (const e of patch.emails ?? []) this.emailIndex.set(e, id)
    return p
  }
  async reassignEmails(emails: string[], personId: string) {
    this.writes++
    for (const e of emails) this.emailIndex.set(e, personId)
  }
  async getOrganization(id: string) {
    return this.orgs.get(id) ?? null
  }
  async findOrganizationByName(name: string) {
    const key = organizationNameKey(name)
    return [...this.orgs.values()].find((o) => !o.domain && !o.merged_into && organizationNameKey(o.name) === key) ?? null
  }
  async findOrganizationByDomain(domain: string) {
    const id = this.domainIndex.get(domain)
    return id ? (this.orgs.get(id) ?? null) : null
  }
  async createOrganization(input: NewOrganization) {
    if (input.domain && this.domainIndex.has(input.domain)) throw new DuplicateError("held", this.domainIndex.get(input.domain) as string)
    this.writes++
    const o: Organization = { ...input, id: this.id("o"), created_at: AT, updated_at: AT }
    this.orgs.set(o.id, o)
    if (o.domain) this.domainIndex.set(o.domain, o.id)
    return o
  }
  async updateOrganization(id: string, patch: Partial<NewOrganization>) {
    this.writes++
    const o = { ...(this.orgs.get(id) as Organization), ...patch }
    this.orgs.set(id, o)
    return o
  }
  async findAffiliation(personId: string, organizationId: string, role: string) {
    return [...this.affs.values()].find((a) => a.person_id === personId && a.organization_id === organizationId && a.role === role) ?? null
  }
  async createAffiliation(input: NewAffiliation) {
    this.writes++
    const a: Affiliation = { ...input, id: this.id("a"), created_at: AT, updated_at: AT }
    this.affs.set(a.id, a)
    return a
  }
  async createActivity(input: ActivityInput) {
    this.writes++
    const a: Activity = { ...input, id: this.id("act"), triaged: false, created_at: AT }
    this.activities.set(a.id, a)
    return a
  }
  async getTriage(id: string) {
    return this.triage.get(id) ?? null
  }
  async recordTriage(r: TriageRecord) {
    this.writes++
    this.triage.set(r.id, r)
  }
  async recordMerge(r: Omit<MergeRecord, "id">) {
    this.writes++
    this.merges.push(r)
  }
}

export class FakeLeadPath implements LeadPath {
  calls: Array<{ person: Person; activity: Activity }> = []
  constructor(private readonly leadId: string | null = "lead-1") {}
  async createLeadFor(person: Person, activity: Activity) {
    this.calls.push({ person, activity })
    return { leadId: this.leadId }
  }
}

