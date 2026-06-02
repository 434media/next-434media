/**
 * One-time Mailchimp retag backfill — Step 3 of the audiences/Mailchimp
 * alignment plan (docs/audiences-mailchimp-alignment.md).
 *
 * Rewrites every member's tags from the drifted legacy taxonomy to the canonical
 * one defined in lib/mailchimp-tags.ts, then deletes the legacy + empty segments.
 * IDEMPOTENT: re-running after a successful apply is a no-op.
 *
 * DRY-RUN BY DEFAULT. Nothing is written unless you pass --apply.
 *
 *   # 1. Dry-run — prints the full before/after diff, writes nothing:
 *   npx tsx --env-file=.env.local scripts/mailchimp-retag.ts
 *
 *   # 2. Live pass — only after you've reviewed the dry-run output:
 *   npx tsx --env-file=.env.local scripts/mailchimp-retag.ts --apply
 *
 * Flags:
 *   --apply        Actually write to Mailchimp (omit for dry-run).
 *   --limit N      Only process the first N members (for a smaller test pass).
 *   --verbose      Print per-member tag changes.
 *   --skip-segments  Retag members but don't delete any segments.
 */

import crypto from "node:crypto"
import { TAG_REMAP, RETIRED_TAGS, isCanonicalTag } from "../lib/mailchimp-tags"

// ── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const VERBOSE = args.includes("--verbose")
const SKIP_SEGMENTS = args.includes("--skip-segments")
const LIMIT = (() => {
  const i = args.indexOf("--limit")
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : Infinity
})()

// ── Mailchimp config + low-level client ──────────────────────────────────────
const API_KEY = process.env.MAILCHIMP_API_KEY
const AUDIENCE_ID =
  process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID

if (!API_KEY) {
  console.error("✗ MAILCHIMP_API_KEY not set. Run with: npx tsx --env-file=.env.local …")
  process.exit(1)
}
if (!AUDIENCE_ID) {
  console.error("✗ No audience id (MAILCHIMP_AUDIENCE_ID_434MEDIA / MAILCHIMP_AUDIENCE_ID).")
  process.exit(1)
}

const SERVER = API_KEY.split("-").pop()
const BASE = `https://${SERVER}.api.mailchimp.com/3.0`
const AUTH = { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" }

async function mc<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: AUTH })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Mailchimp ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 200)}`)
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const subscriberHash = (email: string) =>
  crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex")

// ── Types ────────────────────────────────────────────────────────────────────
interface Member {
  id: string
  email_address: string
  status: string
  tags?: Array<{ id: number; name: string }>
}
interface Segment {
  id: number
  name: string
  member_count: number
  type: string
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchAllMembers(): Promise<Member[]> {
  const all: Member[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const json = await mc<{ members: Member[]; total_items: number }>(
      `/lists/${AUDIENCE_ID}/members?count=${PAGE}&offset=${offset}&fields=members.id,members.email_address,members.status,members.tags,total_items`,
    )
    const batch = json.members ?? []
    all.push(...batch)
    if (batch.length < PAGE || all.length >= json.total_items) break
    offset += PAGE
  }
  return all
}

async function fetchAllSegments(): Promise<Segment[]> {
  const json = await mc<{ segments: Segment[] }>(
    `/lists/${AUDIENCE_ID}/segments?count=1000&fields=segments.id,segments.name,segments.member_count,segments.type`,
  )
  return json.segments ?? []
}

// ── Per-member plan ───────────────────────────────────────────────────────────
interface MemberPlan {
  email: string
  add: string[] // canonical tags to apply
  remove: string[] // legacy tags to deactivate
  unmapped: string[] // non-canonical, no mapping, NOT touched (needs a human)
}

function planForMember(m: Member): MemberPlan {
  const current = (m.tags ?? []).map((t) => t.name)
  const currentSet = new Set(current)
  const add = new Set<string>()
  const remove = new Set<string>()
  const unmapped = new Set<string>()

  for (const name of current) {
    if (isCanonicalTag(name)) continue // already canonical — keep as-is
    const key = name.toLowerCase()
    const mapped = TAG_REMAP[key]
    if (mapped) {
      for (const c of mapped) if (!currentSet.has(c)) add.add(c)
      remove.add(name)
    } else if (RETIRED_TAGS.includes(key)) {
      remove.add(name)
    } else {
      unmapped.add(name) // leave it; report for manual review
    }
  }
  return { email: m.email_address, add: [...add], remove: [...remove], unmapped: [...unmapped] }
}

// ── Segment deletion plan ─────────────────────────────────────────────────────
interface SegmentPlan {
  toDelete: Segment[] // legacy-known or empty-and-non-canonical
  keep: Segment[] // canonical tags
  review: Segment[] // non-empty, unknown, non-canonical — needs a human
}

function planForSegments(segments: Segment[]): SegmentPlan {
  const toDelete: Segment[] = []
  const keep: Segment[] = []
  const review: Segment[] = []
  for (const seg of segments) {
    if (seg.type !== "static") {
      keep.push(seg) // not a tag (saved/auto segment) — never touch
      continue
    }
    const key = seg.name.toLowerCase()
    if (isCanonicalTag(seg.name)) {
      keep.push(seg)
    } else if (TAG_REMAP[key] || RETIRED_TAGS.includes(key)) {
      toDelete.push(seg) // legacy, members already migrated
    } else if (seg.member_count === 0) {
      toDelete.push(seg) // empty cruft (the ~45 unused placeholders)
    } else {
      review.push(seg) // unknown + non-empty — don't guess, surface it
    }
  }
  return { toDelete, keep, review }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${APPLY ? "🔴 APPLY (live writes)" : "🟢 DRY-RUN (no writes)"} — audience ${AUDIENCE_ID}\n`)

  // 1) Members
  console.log("Fetching members…")
  let members = await fetchAllMembers()
  if (LIMIT !== Infinity) members = members.slice(0, LIMIT)
  console.log(`  ${members.length} members fetched.\n`)

  const plans = members.map(planForMember)
  const changed = plans.filter((p) => p.add.length || p.remove.length)

  // Aggregate projections
  const addCounts: Record<string, number> = {}
  const removeCounts: Record<string, number> = {}
  const unmappedCounts: Record<string, number> = {}
  for (const p of plans) {
    p.add.forEach((t) => (addCounts[t] = (addCounts[t] ?? 0) + 1))
    p.remove.forEach((t) => (removeCounts[t] = (removeCounts[t] ?? 0) + 1))
    p.unmapped.forEach((t) => (unmappedCounts[t] = (unmappedCounts[t] ?? 0) + 1))
  }

  const sortDesc = (rec: Record<string, number>) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1])

  console.log(`Members with tag changes: ${changed.length} / ${members.length}\n`)

  console.log("── Canonical tags to ADD (members gaining each) ──")
  for (const [tag, n] of sortDesc(addCounts)) console.log(`  +${String(n).padStart(5)}  ${tag}`)
  if (!Object.keys(addCounts).length) console.log("  (none)")

  console.log("\n── Legacy tags to REMOVE (members losing each) ──")
  for (const [tag, n] of sortDesc(removeCounts)) console.log(`  -${String(n).padStart(5)}  ${tag}`)
  if (!Object.keys(removeCounts).length) console.log("  (none)")

  if (Object.keys(unmappedCounts).length) {
    console.log("\n⚠ UNMAPPED tags found on members (LEFT UNTOUCHED — add to TAG_REMAP/RETIRED_TAGS if needed):")
    for (const [tag, n] of sortDesc(unmappedCounts)) console.log(`   ${String(n).padStart(5)}  ${tag}`)
  }

  if (VERBOSE) {
    console.log("\n── Per-member changes ──")
    for (const p of changed) {
      console.log(`  ${p.email}`)
      if (p.add.length) console.log(`      + ${p.add.join(", ")}`)
      if (p.remove.length) console.log(`      - ${p.remove.join(", ")}`)
    }
  }

  // 2) Segments
  let segPlan: SegmentPlan | null = null
  if (!SKIP_SEGMENTS) {
    console.log("\nFetching segments…")
    const segments = await fetchAllSegments()
    segPlan = planForSegments(segments)
    console.log(`  ${segments.length} segments. Delete ${segPlan.toDelete.length}, keep ${segPlan.keep.length}, review ${segPlan.review.length}.\n`)

    console.log("── Segments to DELETE (legacy / empty) ──")
    for (const s of segPlan.toDelete.sort((a, b) => b.member_count - a.member_count))
      console.log(`  ✗ ${String(s.member_count).padStart(5)}  ${s.name}`)
    if (!segPlan.toDelete.length) console.log("  (none)")

    if (segPlan.review.length) {
      console.log("\n⚠ Segments to REVIEW (non-empty, unknown — NOT deleted):")
      for (const s of segPlan.review) console.log(`   ${String(s.member_count).padStart(5)}  ${s.name}`)
    }
  }

  // 3) Apply (only with --apply)
  if (!APPLY) {
    console.log("\n🟢 Dry-run complete. No changes made. Re-run with --apply to write.\n")
    return
  }

  console.log("\n🔴 Applying member tag changes…")
  let done = 0
  for (const p of changed) {
    const payload = {
      tags: [
        ...p.add.map((name) => ({ name, status: "active" as const })),
        ...p.remove.map((name) => ({ name, status: "inactive" as const })),
      ],
    }
    try {
      await mc(`/lists/${AUDIENCE_ID}/members/${subscriberHash(p.email)}/tags`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error(`  ! ${p.email}: ${(err as Error).message}`)
    }
    if (++done % 100 === 0) console.log(`  …${done}/${changed.length}`)
  }
  console.log(`  Member retag done (${done} members updated).`)

  if (segPlan && !SKIP_SEGMENTS) {
    console.log("\n🔴 Deleting legacy/empty segments…")
    for (const s of segPlan.toDelete) {
      try {
        await mc(`/lists/${AUDIENCE_ID}/segments/${s.id}`, { method: "DELETE" })
        console.log(`  ✗ deleted "${s.name}"`)
      } catch (err) {
        console.error(`  ! failed to delete "${s.name}": ${(err as Error).message}`)
      }
    }
  }

  console.log("\n✅ Apply complete.\n")
}

main().catch((err) => {
  console.error("\n✗ Backfill failed:", err)
  process.exit(1)
})
