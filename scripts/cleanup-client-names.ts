/**
 * Cosmetic cleanup of `company_name` on crm_clients.
 *
 * Pass 1 — whitespace (default): trim and collapse internal runs of spaces.
 *   Safe and unambiguous ("Frost Bank " → "Frost Bank", "global  med" →
 *   "global med"). Won't create duplicates — the strict dedup already merged
 *   whitespace/punctuation variants.
 *
 * Pass 2 — casing (--casing): apply a CURATED map of brand-correct spellings
 *   for all-lowercase names. NOT auto-title-cased — acronyms and brand casing
 *   (ManTech, KARL STORZ, MSD Law PLLC) can't be inferred reliably, so only the
 *   entries in CASING_FIXES are touched; anything not listed is left as-is.
 *
 * Safety: DRY-RUN by default — prints the diffs, writes nothing. Pass --apply.
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-client-names.ts            # whitespace dry-run
 *   npx tsx --env-file=.env.local scripts/cleanup-client-names.ts --apply
 *   npx tsx --env-file=.env.local scripts/cleanup-client-names.ts --casing   # casing dry-run
 *   npx tsx --env-file=.env.local scripts/cleanup-client-names.ts --casing --apply
 */
import { getDb } from "../lib/firebase-admin"

const APPLY = process.argv.includes("--apply")
const CASING = process.argv.includes("--casing")

// Curated brand-correct spellings, keyed by the current (lowercase) value.
// Only confident ones; ambiguous/cryptic names (a2-g, fcnit, egs-anc, premfed,
// specprogroup, ugsmedicaldental, nuvimedix, coviesinc, gov sci, scs cases,
// landonoconnor, ccthera, fortdefianceind, create with cdid, aky tech consulting,
// global med, regenevita) are intentionally left out for manual review.
const CASING_FIXES: Record<string, string> = {
  // multi-word, plain-English → title case
  "turn medical": "Turn Medical",
  "jana life sciences": "Jana Life Sciences",
  "olifant medical": "Olifant Medical",
  "tier 1 performance": "Tier 1 Performance",
  "computerized screening": "Computerized Screening",
  "911 medical devices": "911 Medical Devices",
  // known brand casings
  cisco: "Cisco",
  mantech: "ManTech",
  karlstorz: "Karl Storz",
  "micro-x": "Micro-X",
  planmecausa: "Planmeca USA",
  dripdropors: "DripDrop ORS",
  "msd law pllc": "MSD Law PLLC",
  "usa-spirit": "USA Spirit",
  "cfd-research": "CFD Research",
  "stellar-micro": "Stellar Micro",
  dermaclip: "DermaClip",
  scimage: "ScImage",
  // single-token first-letter caps
  avazzia: "Avazzia",
  juxtopia: "Juxtopia",
  vysnova: "Vysnova",
}

function cleanWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ")
}

async function main() {
  const db = getDb()
  const snap = await db.collection("crm_clients").get()
  const rows = snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, data: d.data() as Record<string, unknown> }))
    .filter((r) => r.data.is_opportunity !== true)

  console.log(`\n${APPLY ? "🔴 APPLY" : "🟢 DRY-RUN"} — cleanup company_name (${CASING ? "casing" : "whitespace"})\n`)

  const changes: { ref: FirebaseFirestore.DocumentReference; from: string; to: string }[] = []
  for (const r of rows) {
    const cur = String(r.data.company_name || "")
    if (!cur) continue
    let next = cur
    if (CASING) {
      const fix = CASING_FIXES[cur.trim().toLowerCase()]
      if (fix) next = fix
    } else {
      next = cleanWhitespace(cur)
    }
    if (next !== cur) changes.push({ ref: r.ref, from: cur, to: next })
  }

  for (const c of changes) console.log(`  "${c.from}"  →  "${c.to}"`)
  console.log(`\n${changes.length} name(s) to update.`)

  if (!APPLY) {
    console.log(`\n🟢 Dry-run — nothing written. Re-run with --apply to update.`)
    return
  }

  let written = 0
  for (let i = 0; i < changes.length; i += 400) {
    const batch = db.batch()
    for (const c of changes.slice(i, i + 400)) {
      batch.update(c.ref, { company_name: c.to })
      written++
    }
    await batch.commit()
  }
  console.log(`\n✅ Updated ${written} company names.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
