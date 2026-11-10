/**
 * The canon check (434 build sequence V1 item 2): fails when a single-source value appears outside the file that owns
 * it. Runs in `verify` on every pull request.
 *
 *   tsx scripts/canon/check.ts               scan every tracked text file; exit 1 on a finding not in the baseline
 *   tsx scripts/canon/check.ts --baseline    also print each finding as a baseline entry, for review
 *
 * The values are read from their owners at run time, so this check restates none of them:
 * - jurisdiction (CLAUDE.md, "Jurisdiction policy is one allow-list"): lib/prospecting/scorer.ts owns the cold-outreach
 *   allow-list, the cold lead sources, and EXCLUDED_COUNTRIES / EXCLUDED_COUNTRY_CODES. Another file that declares one
 *   of them, or lists four or more of the excluded countries, or six or more of their codes, is re-listing the policy.
 *   The prompt inputs CLAUDE.md names (the translator's prompt, icp-base.md) are the documented exceptions.
 * - Mailchimp tags (CLAUDE.md, "Mailchimp tags are code-owned"): lib/mailchimp-tags.ts owns the taxonomy. A string
 *   literal that is one of its fixed tags (brand:, source:, status:) anywhere else is a tag written by hand instead of
 *   through brandTag / sourceTag / statusTag. Event tags are open-ended by design and are not checked.
 * - the brand roster (CLAUDE.md, "Brands"): components/crm/types.ts owns BRANDS. Another list naming three or more of
 *   its brands is a second roster. A brand name on its own (display text) is fine.
 *
 * Tests are not scanned: a test states values to check them. Findings already in the tree when the check arrived are
 * in scripts/canon/baseline.json, each with a reason, so they are visible and decided once; a new one fails.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

export interface CanonFinding { path: string; line: number; rule: string; value: string }
export interface BaselineEntry { path: string; rule: string; value: string; reason: string }
export interface Canon {
  excludedCountries: string[]
  excludedCodes: string[]
  mailchimpTags: string[]
  roster: string[]
}

export const OWNERS = {
  jurisdiction: "lib/prospecting/scorer.ts",
  mailchimp: "lib/mailchimp-tags.ts",
  roster: "components/crm/types.ts",
} as const
/** Files CLAUDE.md names as inputs the code runs on, which may state the jurisdictions in words for a model. */
const JURISDICTION_EXCEPTIONS = new Set(["lib/prospecting/translator.ts", "lib/prospecting/icp-base.md", "CLAUDE.md", "AGENTS.md"])
const DECLARATIONS = ["EXCLUDED_COUNTRIES", "EXCLUDED_COUNTRY_CODES", "COLD_OUTREACH_ALLOWED_COUNTRY", "COLD_LEAD_SOURCES"]
const SCANNED = /\.(ts|tsx|js|jsx|mjs|cjs|py|md|mdx|json|ya?ml)$/
const SKIPPED = [/^lib\/__tests__\//, /\.test\.(ts|tsx|mjs)$/, /^pnpm-lock\.yaml$/, /^scripts\/canon\//, /^docs\/archive\//]

/** The string members of `const NAME ... = new Set([...])` or `= [...]` in an owner's source. */
export function listIn(source: string, name: string): string[] {
  const m = new RegExp(`\\b${name}\\b[^=]*=\\s*(?:new Set\\(\\s*)?\\[([\\s\\S]*?)\\]`).exec(source)
  if (!m) throw new Error(`canon check: ${name} not found in its owner; the owner moved or changed shape`)
  return [...m[1].replace(/\/\/[^\n]*/g, "").matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

export function readCanon(root: string): Canon {
  const read = (p: string) => readFileSync(join(root, p), "utf8")
  const jur = read(OWNERS.jurisdiction)
  const mc = read(OWNERS.mailchimp)
  const tags = [
    ...listIn(mc, "BRANDS").map((v) => `brand:${v}`),
    ...listIn(mc, "SOURCES").map((v) => `source:${v}`),
    ...listIn(mc, "STATUSES").map((v) => `status:${v}`),
  ]
  return {
    excludedCountries: listIn(jur, "EXCLUDED_COUNTRIES"),
    excludedCodes: listIn(jur, "EXCLUDED_COUNTRY_CODES"),
    mailchimpTags: tags,
    roster: listIn(read(OWNERS.roster), "BRANDS"),
  }
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const quoted = (v: string, flags = "") => new RegExp(`["'\`]${esc(v)}["'\`]`, flags)

export function findCanon(path: string, text: string, canon: Canon): CanonFinding[] {
  const out: CanonFinding[] = []
  const lines = text.split("\n")
  const window = (i: number, n: number) => lines.slice(i, i + n).join(" ")

  if (path !== OWNERS.jurisdiction) {
    lines.forEach((l, i) => {
      for (const d of DECLARATIONS) if (new RegExp(`\\b(?:const|let|var)\\s+${d}\\b|\\b${d}\\s*=\\s*(?:new|\\[)`).test(l)) out.push({ path, line: i + 1, rule: "jurisdiction list declared outside its owner", value: d })
    })
    if (!JURISDICTION_EXCEPTIONS.has(path)) {
      // A list spans a few lines; one finding per file is enough to send someone to the owner.
      for (let i = 0; i < lines.length; i++) {
        const w = window(i, 8)
        const names = canon.excludedCountries.filter((c) => quoted(c, "i").test(w)).length
        const codes = canon.excludedCodes.filter((c) => quoted(c).test(w)).length
        if (names >= 4 || codes >= 6) { out.push({ path, line: i + 1, rule: "excluded countries re-listed", value: `${names} names, ${codes} codes` }); break }
      }
    }
  }
  if (path !== OWNERS.mailchimp) {
    lines.forEach((l, i) => {
      for (const t of canon.mailchimpTags) if (quoted(t).test(l)) out.push({ path, line: i + 1, rule: "Mailchimp tag written by hand", value: t })
    })
  }
  if (path !== OWNERS.roster) {
    for (let i = 0; i < lines.length; i++) {
      const w = window(i, 3)
      const named = canon.roster.filter((b) => quoted(b).test(w))
      if (named.length >= 3) { out.push({ path, line: i + 1, rule: "brand roster re-listed", value: `${named.length} roster brands` }); break }
    }
  }
  return out
}

export function scan(root: string): CanonFinding[] {
  const canon = readCanon(root)
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }).split("\0").filter(Boolean)
  const out: CanonFinding[] = []
  for (const path of files) {
    if (!SCANNED.test(path) || SKIPPED.some((re) => re.test(path))) continue
    const full = join(root, path)
    try { if (!statSync(full).isFile() || statSync(full).size > 5 << 20) continue } catch { continue }
    out.push(...findCanon(path, readFileSync(full, "utf8"), canon))
  }
  return out
}

export const baselineKey = (f: { path: string; rule: string; value: string }) => `${f.path}|${f.rule}|${f.value}`

function main() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const baseline = JSON.parse(readFileSync(join(root, "scripts/canon/baseline.json"), "utf8")) as BaselineEntry[]
  const known = new Set(baseline.map(baselineKey))
  const all = scan(root)
  const found = all.filter((f) => !known.has(baselineKey(f)))
  const stale = baseline.filter((b) => !all.some((f) => baselineKey(f) === baselineKey(b)))
  if (stale.length) console.log(`canon check: ${stale.length} baseline entr${stale.length === 1 ? "y is" : "ies are"} fixed and can be removed:\n${stale.map((b) => `  ${b.path}  ${b.rule}  ${b.value}`).join("\n")}`)
  if (!found.length) {
    console.log(`canon check: no single-source value outside its owner (${baseline.length} known in the baseline).`)
    return
  }
  console.error(`canon check: ${found.length} finding(s).\n`)
  for (const f of found) console.error(`  ${f.path}:${f.line}  ${f.rule}  ${f.value}`)
  console.error(
    `\nImport the value from its owner instead of restating it: ${OWNERS.jurisdiction} (jurisdiction), ` +
      `${OWNERS.mailchimp} (brandTag / sourceTag / statusTag), ${OWNERS.roster} (BRANDS).`,
  )
  if (process.argv.includes("--baseline")) {
    const seen = new Set<string>()
    console.error(`\n${JSON.stringify(found.filter((f) => !seen.has(baselineKey(f)) && seen.add(baselineKey(f))).map((f) => ({ path: f.path, rule: f.rule, value: f.value, reason: "" })), null, 2)}`)
  }
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
