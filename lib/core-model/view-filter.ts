// The visibility filter over a whole core view. Pure (no Firestore), so it is tested directly
// (lib/__tests__/core-model-personal.test.ts); lib/core-model/read.ts applies it to every read.

import type { AdminRole } from "@/lib/session-cookie"
import type { CoreView } from "./assemble"
import { canSee, type VisibilityViewer } from "./visibility"

export interface Viewer extends VisibilityViewer {
  role?: AdminRole | null
  superAdmin?: boolean
  /** The founder (ADMIN_FOUNDER_EMAIL, verified sign-in): the only viewer of `private` records. */
  founder?: boolean
}

/**
 * The part of a view a viewer may see. People and Organizations they may not see are removed, with every link and
 * activity that touches them; an activity is also removed on its own visibility (a phone arrival not yet linked to
 * anyone is `private`). Pure, so it is tested without Firestore. Every read of the core model, by a route, the
 * connector or an agent, goes through this.
 */
export function filterViewFor<T extends CoreView>(view: T, viewer: Viewer): T {
  const people = view.people.filter((p) => canSee(p, viewer))
  const organizations = view.organizations.filter((o) => canSee(o, viewer))
  const hiddenPeople = new Set(view.people.filter((p) => !canSee(p, viewer)).map((p) => p.id))
  const hiddenOrgs = new Set(view.organizations.filter((o) => !canSee(o, viewer)).map((o) => o.id))
  const hiddenAddresses = new Set(view.people.filter((p) => !canSee(p, viewer)).flatMap((p) => p.emails))
  return {
    ...view,
    people,
    organizations,
    affiliations: view.affiliations.filter((a) => !hiddenPeople.has(a.person_id) && !hiddenOrgs.has(a.organization_id)),
    activities: view.activities
      .filter(
        (a) =>
          canSee(a, viewer) &&
          !(a.person_id && hiddenPeople.has(a.person_id)) &&
          !(a.organization_id && hiddenOrgs.has(a.organization_id)),
      )
      .map((a) => (a.email ? redactHiddenAddresses(a, hiddenAddresses) : a)),
  }
}

/**
 * A message's recipient list may name someone the viewer may not see (a broadcast went to many people, one of them a
 * personal contact). Their address is removed from what this viewer is shown; the stored record is unchanged.
 */
function redactHiddenAddresses<A extends CoreView["activities"][number]>(a: A, hidden: Set<string>): A {
  if (!a.email || hidden.size === 0) return a
  const keep = (list: string[]) => list.filter((e) => !hidden.has(e))
  const to = keep(a.email.to)
  const cc = keep(a.email.cc)
  if (to.length === a.email.to.length && cc.length === a.email.cc.length) return a
  return { ...a, email: { ...a.email, to, cc } }
}

