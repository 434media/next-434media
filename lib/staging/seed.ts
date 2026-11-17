import { createHash } from "node:crypto"
import { STAGING_PROJECT_ID } from "../preview-auth"
import { draftApproval } from "../send-approval"
import { AGENT_LEDGER_COLLECTION, AGENT_TASKS_COLLECTION, advance, buildEntry, newTask } from "../agent/ledger"

/**
 * Made-up records for the staging store, c434-staging, so a preview's admin has something to show: content posts (one
 * of them a video post), leads, contacts, two roster members, and one website arrival with an agent's reply draft waiting
 * for a decision, so the People Inbox shows its "Draft ready" drawer. Nothing here is a real person, company or post:
 * every address is on example.com (RFC 2606), every phone a 555 number, and every company invented.
 *
 * Writes go to c434-staging and nowhere else: `writeStagingSeed` refuses any other project before it touches the
 * database, whoever calls it (the preview-only route app/api/admin/staging/seed, or scripts/staging/seed.ts).
 *
 * Idempotent: fixed document ids starting `seed-` (the email claims excepted, whose ids are the address's hash, as
 * lib/firestore-people.ts makes them), each marked `seed: "staging-seed"`, so a second run overwrites the first.
 */

export const SEED_MARK = "staging-seed"

export interface SeedDoc {
  collection: string
  id: string
  data: Record<string, unknown>
}

/** Refuses every project but the staging store. */
export function assertStagingProject(projectId: string | undefined | null): void {
  if (projectId !== STAGING_PROJECT_ID) {
    throw new Error(`Staging seed refused: target project is ${projectId ? `"${projectId}"` : "unset"}, not ${STAGING_PROJECT_ID}`)
  }
}

function claimId(email: string): string {
  return createHash("sha256").update(email).digest("hex")
}

/**
 * The seed records. `origin` is the deployment the video is served from (the site's own public hero clip), so the
 * video post plays on that preview; `now` fixes the dates for a test.
 */
export function buildStagingSeed(opts: { origin: string; now?: Date }): SeedDoc[] {
  const now = opts.now ?? new Date()
  const iso = now.toISOString()
  const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
  const origin = opts.origin.replace(/\/+$/, "")
  const base = { seed: SEED_MARK, created_at: iso, updated_at: iso }

  const post = (id: string, fields: Record<string, unknown>): SeedDoc => ({
    collection: "crm_content_posts",
    id,
    data: {
      ...base,
      user: "Staging Tester",
      date_created: day(-3),
      links: [],
      tags: "staging, made-up",
      social_platforms: ["instagram"],
      ...fields,
    },
  })

  const posts: SeedDoc[] = [
    post("seed-post-video", {
      title: "[Staging] Training day recap (video)",
      platform: "DEVSA",
      status: "needs_approval",
      date_to_post: day(2),
      social_copy: "Made-up copy for a staging video post. Nothing here is real.",
      social_platforms: ["instagram", "tiktok"],
      assets: [
        { url: `${origin}/hero/hero-720p.mp4`, kind: "video", aspectRatio: "16:9", source: "upload", platforms: ["instagram", "tiktok"] },
      ],
    }),
    post("seed-post-draft", {
      title: "[Staging] Community meetup announcement",
      platform: "Digital Canvas",
      status: "to_do",
      social_copy: "Made-up draft copy for staging.",
      assets: [],
    }),
    post("seed-post-scheduled", {
      title: "[Staging] Weekly roundup",
      platform: "434 Media",
      status: "scheduled",
      date_to_post: day(5),
      social_copy: "Made-up scheduled copy for staging.",
      social_platforms: ["instagram", "facebook"],
      assets: [],
    }),
    post("seed-post-posted", {
      title: "[Staging] Last week's highlight",
      platform: "TXMX Boxing",
      status: "posted",
      date_to_post: day(-2),
      posted_at: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
      social_copy: "Made-up posted copy for staging.",
      assets: [],
    }),
  ]

  // Leads are warm or inbound only (manual, web, event): a cold source would put them behind the jurisdiction gate,
  // which is not what a preview is for. All US, so no gate refuses them either.
  const lead = (id: string, fields: Record<string, unknown>): SeedDoc => ({
    collection: "leads",
    id,
    data: { ...base, country: "US", location: "San Antonio, TX", score: 50, priority: "medium", status: "new", tags: ["staging"], ...fields },
  })
  const leads: SeedDoc[] = [
    lead("seed-lead-1", { name: "Avery Example", company: "Example Riverworks", title: "Marketing Director", email: "avery@example.com", source: "manual", industry: "Manufacturing" }),
    lead("seed-lead-2", { name: "Jordan Sample", company: "Sample Health Partners", title: "Communications Lead", email: "jordan@example.com", source: "web", industry: "Healthcare", status: "contacted", priority: "high", score: 72 }),
    lead("seed-lead-3", { name: "Riley Placeholder", company: "Placeholder Events Co", title: "Founder", email: "riley@example.com", source: "event", industry: "Events", priority: "low", score: 31 }),
  ]

  // Contacts (the core model's People) with their one-person-per-email claims, as lib/firestore-people.ts writes them.
  const person = (id: string, name: string, email: string, fields: Record<string, unknown>): SeedDoc[] => [
    {
      collection: "crm_people",
      id,
      data: { ...base, name, emails: [email], phones: ["210-555-0100"], lifecycle_stage: "contact", roles: [], source: "manual", country: "US", relationship: "business", visibility: "business", ...fields },
    },
    { collection: "crm_person_emails", id: claimId(email), data: { email, person_id: id, at: iso, seed: SEED_MARK } },
  ]
  const people: SeedDoc[] = [
    ...person("seed-person-1", "Casey Example", "casey@example.com", { title: "Producer", roles: ["vendor"] }),
    ...person("seed-person-2", "Morgan Sample", "morgan@example.com", { title: "Program Manager", roles: ["partner"], lifecycle_stage: "lead" }),
    ...person("seed-person-3", "Taylor Placeholder", "taylor@example.com", { title: "Director", roles: ["client"], lifecycle_stage: "customer" }),
  ]

  // Two roster members with the narrow roles, so the team settings show something. They hold example.com addresses,
  // which no one can verify, so they can never sign in; staging admins are STAGING_ADMIN_OWNER_EMAILS.
  const member = (id: string, name: string, email: string, role: string): SeedDoc => ({
    collection: "crm_team_members",
    id,
    data: { seed: SEED_MARK, name, email, role, isActive: true, created_at: iso },
  })
  const team: SeedDoc[] = [
    member("seed-member-1", "Sam Example", "sam@example.com", "crm_only"),
    member("seed-member-2", "Drew Sample", "drew@example.com", "intern"),
  ]

  return [...posts, ...leads, ...people, ...team, ...draftWaiting(iso)]
}

/**
 * One made-up website arrival and the agent's reply draft waiting on it: the form, the intake task with its two ledger
 * entries (created, draft queued) and the pending approval, hashed as the intake run hashes one. Its recipient is on
 * example.com, outside the send allow-list, so Approve and send on a preview records the decision and is refused at
 * the send: nothing can go out.
 */
function draftWaiting(iso: string): SeedDoc[] {
  const formId = "seed-form-1"
  const taskId = "seed-intake-1"
  const email = "jamie@example.com"
  const form: SeedDoc = {
    collection: "contact_forms",
    id: formId,
    data: {
      seed: SEED_MARK,
      firstName: "Jamie",
      lastName: "Example",
      company: "Example Brewing Co",
      email,
      phone: "210-555-0142",
      role: "Marketing Manager",
      organizationType: "Business",
      requestType: "Video production",
      timeline: "Next quarter",
      budgetRange: "$10,000 to $25,000",
      referralSource: "Instagram",
      message: "[Staging] Made-up message. We are opening a second taproom in the spring and want a short launch film and a few social cuts.",
      source: "434Media",
      created_at: iso,
    },
  }
  let task = newTask({ id: taskId, property: "434", objective: "intake-reply", workflow: "434-intake-qualification/draft", budgetUsd: 1, lineage: { event: `contact_forms:${formId}` }, now: iso })
  const a = draftApproval({
    id: "seed-ap-1",
    path: "intake_reply",
    taskId,
    payload: {
      from: "434 Media <hello@example.com>",
      to: [email],
      subject: "Your launch film for the new taproom",
      text: "Hi Jamie,\n\n[Staging] A made-up draft reply. Thank you for writing to us about the new taproom. A short launch film with a few social cuts is work we do often, and spring gives us room to plan it well.\n\nCould you share the opening date and where the taproom is? From there we can suggest a shoot day and an outline.\n\nThe 434 Media team",
    },
    reviewReason: "[Staging] First reply to a new website arrival; check the routing and the tone.",
    now: iso,
  })
  const entries = []
  const created = buildEntry(task, { kind: "task_created", actor: "system", refs: { event: `contact_forms:${formId}` } }, iso)
  task = advance(task, created)
  entries.push(created)
  const started = buildEntry(task, { kind: "run_started", actor: "skill:434-intake-qualification" }, iso)
  task = advance(task, started, "running")
  entries.push(started)
  const queued = buildEntry(task, { kind: "draft_queued", actor: "skill:434-intake-qualification", refs: { approval: a.id, event: `contact_forms:${formId}` }, hashes: { draft: a.hash }, outcome: "qualified" }, iso)
  task = advance(task, queued, "awaiting_review")
  entries.push(queued)
  return [
    form,
    { collection: AGENT_TASKS_COLLECTION, id: taskId, data: { ...task, seed: SEED_MARK } },
    ...entries.map((e) => ({ collection: AGENT_LEDGER_COLLECTION, id: e.id, data: { ...e, seed: SEED_MARK } as Record<string, unknown> })),
    {
      collection: "crm_send_approvals",
      id: a.id,
      data: {
        ...a,
        seed: SEED_MARK,
        routing: { outcome: "qualified" },
        intake: { policyVersion: "staging", record: "[Staging] A made-up intake record.", nextOwner: "Founder", due: iso.slice(0, 10), returnCondition: "No reply in five business days", model: "anthropic/claude-sonnet-5.5" },
        arrival: { formId, receivedAt: iso },
      },
    },
  ]
}

/** The smallest Firestore surface the writer needs, so a test can pass a fake. */
export interface SeedDb {
  batch(): { set(ref: unknown, data: Record<string, unknown>): unknown; commit(): Promise<unknown> }
  collection(name: string): { doc(id: string): unknown }
}

/** Writes the seed to c434-staging. Refuses any other project before it touches the database. */
export async function writeStagingSeed(db: SeedDb, projectId: string | undefined | null, docs: SeedDoc[]): Promise<Record<string, number>> {
  assertStagingProject(projectId)
  const batch = db.batch()
  const counts: Record<string, number> = {}
  for (const d of docs) {
    batch.set(db.collection(d.collection).doc(d.id), d.data)
    counts[d.collection] = (counts[d.collection] ?? 0) + 1
  }
  await batch.commit()
  return counts
}
