// The company lookup wired to Firestore and Apollo. The rules live in lib/core-model/company-lookup.ts; this file
// only supplies the store (Organizations, the daily count, the log) and the Apollo call, and picks the candidates.

import { getDb } from "@/lib/firebase-admin"
import { enrichByEmail } from "@/lib/prospecting/apollo"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { CRM_COLLECTIONS } from "@/types/crm-types"
import {
  candidatesFromInbox,
  dailyCap,
  lookupCompanies,
  lookupDone,
  runCap,
  type CompanyLookupDeps,
  type CompanyLookupStore,
  type LookupCandidate,
} from "./company-lookup"
import { firestoreCoreStore } from "./firestore-store"
import { getCoreView, inboxItems } from "./read"
import { stripUndefined } from "./firestore-util"

/** The Apollo credit log's user for these calls, so the lookup's spend sits with the rest of 434's Apollo spend. */
export const COMPANY_LOOKUP_ACTOR = "system:company-lookup"

export const firestoreLookupStore: CompanyLookupStore = {
  findOrganizationByDomain: firestoreCoreStore.findOrganizationByDomain,
  createOrganization: firestoreCoreStore.createOrganization,
  updateOrganization: firestoreCoreStore.updateOrganization,
  async reserve(orgId, day, cap, at) {
    const db = getDb()
    const orgRef = db.collection(CRM_COLLECTIONS.ORGANIZATIONS).doc(orgId)
    const dayRef = db.collection(CRM_COLLECTIONS.COMPANY_LOOKUP_DAYS).doc(day)
    return db.runTransaction(async (tx) => {
      const [orgSnap, daySnap] = await Promise.all([tx.get(orgRef), tx.get(dayRef)])
      const mark = orgSnap.data()?.company_lookup
      const done = lookupDone(mark && typeof mark === "object" ? { ...mark, at: String(mark.at ?? "") } : undefined, Date.parse(at))
      if (done) return done
      const count = typeof daySnap.data()?.count === "number" ? (daySnap.data()?.count as number) : 0
      if (count >= cap) return "daily_cap" as const
      tx.set(dayRef, { day, count: count + 1, updated_at: at }, { merge: true })
      tx.update(orgRef, { company_lookup: { status: "pending", source: "apollo", at, credits: 0 }, updated_at: at })
      return "ok" as const
    })
  },
  async log(entry) {
    await getDb().collection(CRM_COLLECTIONS.COMPANY_LOOKUPS).add(stripUndefined({ ...entry }))
  },
}

async function deps(): Promise<CompanyLookupDeps> {
  return {
    store: firestoreLookupStore,
    // With the context, enrichByEmail checks the Apollo budget first and writes a matched call to apollo_credit_log.
    enrich: (email) => enrichByEmail(email, { userEmail: COMPANY_LOOKUP_ACTOR }),
    cohorts: await listIcpCohorts().catch(() => []),
    now: () => new Date().toISOString(),
    dailyCap: dailyCap(),
  }
}

/** The scheduled sweep: every untriaged business arrival with a thin or unknown company, up to the run cap. */
export async function runCompanyLookupSweep() {
  const view = await getCoreView()
  return lookupCompanies(await deps(), candidatesFromInbox(inboxItems(view)), { trigger: "sweep", maxPerRun: runCap() })
}

/** One arrival, right after it is saved (the website form), so it is graded on the real company from the start. */
export async function lookupForArrival(candidate: LookupCandidate) {
  return lookupCompanies(await deps(), [candidate], { trigger: "arrival", maxPerRun: 1 })
}
