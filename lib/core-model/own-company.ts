// 434's own company is never a prospect or a client. An Organization on one of 434's own domains (OWN_DOMAINS in
// lib/core-model/identity.ts) is shown as 434 itself: the prospect and client roles are dropped, it carries no fit
// or grade, and the company lookup never spends a credit on it. Applied at read time, so a record already stored
// with the prospect role stops showing as one without anything stored being changed or deleted.

import type { AffiliationRole, CoreRole, Organization } from "@/types/core-model"
import { isOwnDomain } from "./identity"

const NOT_FOR_434: ReadonlySet<CoreRole> = new Set<CoreRole>(["prospect", "client"])

/** The roles an Organization on this domain may hold. */
export function rolesForDomain(domain: string | undefined, roles: CoreRole[]): CoreRole[] {
  return isOwnDomain(domain) ? roles.filter((r) => !NOT_FOR_434.has(r)) : roles
}

/** The link role for a person at an Organization on this domain: someone at 434 works there, nothing more. */
export function affiliationRoleForDomain(domain: string | undefined, role: AffiliationRole): AffiliationRole {
  return isOwnDomain(domain) && NOT_FOR_434.has(role as CoreRole) ? "works_at" : role
}

/** The Organization as shown: unchanged unless it is 434's own, which loses the prospect/client roles and the fit. */
export function asShown(org: Organization): Organization {
  if (!isOwnDomain(org.domain)) return org
  return {
    ...org,
    own: true,
    roles: rolesForDomain(org.domain, org.roles),
    icp_fit_score: undefined,
    icp_grade: undefined,
    icp_breakdown: undefined,
    icp_review: null,
    scored_at: undefined,
  }
}
