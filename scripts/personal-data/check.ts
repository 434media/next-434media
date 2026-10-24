/**
 * Fails when tracked files carry email addresses or phone numbers that are not on the allowlist.
 *
 *   tsx scripts/personal-data/check.ts            scan every tracked file; exit 1 on a finding
 *   tsx scripts/personal-data/check.ts --pending  also print a pending entry for each finding (sha256, no address)
 *
 * This repository is public. People's addresses, phone numbers and movements belong in Firestore, read by
 * server code behind a gate, not in source (next-434media: the event-role and travel files that this replaced).
 *
 * The allowlist (scripts/personal-data/allowlist.json) is deliberately small:
 * - domains: the company's own domain, and the reserved example domains (RFC 2606/6761) placeholders should use;
 * - addresses: placeholders and fixtures that are not anyone's address;
 * - pending: real addresses already in the tree that someone has to decide about, matched by path and the sha256
 *   of the normalized value, so the list itself never republishes them. A new file or a new address fails.
 * Phone numbers pass only in the fictional 555 range. Lockfiles carry package authors' addresses and are skipped.
 *
 * A name and a route have no pattern to match, so the files that held them are forbidden by path (forbiddenPaths):
 * the data lives in Firestore now, and a file at that path is the old data coming back.
 */
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

export interface PendingEntry { path: string; sha256: string; reason: string }
export interface Allowlist {
  domains: string[]
  addresses: string[]
  skipPaths: string[]
  /** A tracked file at, or under, one of these paths fails the check whatever it contains. */
  forbiddenPaths: string[]
  pending: PendingEntry[]
}
export interface Finding { path: string; line: number; kind: "email" | "phone" | "forbidden-path"; value: string; sha256: string }

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// A NANP number with separators: (210) 555-0100, 210-555-0100, +1 210.555.0100. Bare digit runs are ids, not phones.
const PHONE = /(?<![\w+])(?:\+?1[-. ]?)?\(?([2-9]\d{2})\)?[-. ]([2-9]\d{2})[-. ](\d{4})(?!\d)/g
/** `logo@2x.png` and friends: an asset name, not an address. */
const FILE_TLDS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "mp4", "mov", "js", "mjs", "ts", "tsx", "css", "json", "ico", "pdf"])
const RESERVED_TLDS = [".test", ".example", ".invalid", ".localhost"]

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")

function domainAllowed(domain: string, allow: Allowlist): boolean {
  if (RESERVED_TLDS.some((t) => domain.endsWith(t))) return true
  return allow.domains.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export function findPersonalData(path: string, text: string, allow: Allowlist): Finding[] {
  const addresses = new Set(allow.addresses.map((a) => a.toLowerCase()))
  const pending = new Set(allow.pending.filter((p) => p.path === path).map((p) => p.sha256))
  const out: Finding[] = []
  text.split("\n").forEach((lineText, i) => {
    for (const m of lineText.matchAll(EMAIL)) {
      const value = m[0].toLowerCase()
      const domain = value.slice(value.indexOf("@") + 1)
      if (FILE_TLDS.has(domain.slice(domain.lastIndexOf(".") + 1))) continue
      if (addresses.has(value) || domainAllowed(domain, allow)) continue
      const hash = sha256(value)
      if (!pending.has(hash)) out.push({ path, line: i + 1, kind: "email", value, sha256: hash })
    }
    for (const m of lineText.matchAll(PHONE)) {
      const [, area, exchange, number] = m
      if (area === "555" || exchange === "555") continue
      const value = `${area}${exchange}${number}`
      const hash = sha256(value)
      if (!pending.has(hash)) out.push({ path, line: i + 1, kind: "phone", value, sha256: hash })
    }
  })
  return out
}

/** `jane.doe@example.com` → `j***@example.com`; a phone keeps its last two digits. Enough to find it, not to reuse it. */
export function redact(f: Finding): string {
  if (f.kind === "forbidden-path") return "this path held personal data that now lives in Firestore"
  if (f.kind === "phone") return `***-***-**${f.value.slice(-2)}`
  const at = f.value.indexOf("@")
  return `${f.value[0]}***${f.value.slice(at)}`
}

export function loadAllowlist(root: string): Allowlist {
  return JSON.parse(readFileSync(join(root, "scripts/personal-data/allowlist.json"), "utf8")) as Allowlist
}

export function scanRepository(root: string, allow: Allowlist): Finding[] {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\0")
    .filter(Boolean)
  const skip = new Set(allow.skipPaths)
  const findings: Finding[] = []
  for (const path of files) {
    if (allow.forbiddenPaths.some((p) => path === p || (p.endsWith("/") && path.startsWith(p)))) {
      findings.push({ path, line: 0, kind: "forbidden-path", value: path, sha256: sha256(path) })
      continue
    }
    if (skip.has(path)) continue
    const full = join(root, path)
    let size: number
    try {
      const st = statSync(full)
      if (!st.isFile()) continue
      size = st.size
    } catch {
      continue // deleted in the working tree
    }
    if (size > 5 << 20) continue
    const buf = readFileSync(full)
    if (buf.includes(0)) continue // binary
    findings.push(...findPersonalData(path, buf.toString("utf8"), allow))
  }
  return findings
}

function main() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const allow = loadAllowlist(root)
  const findings = scanRepository(root, allow)
  if (!findings.length) {
    console.log(`personal-data check: no email addresses or phone numbers outside the allowlist (${allow.pending.length} pending entries).`)
    return
  }
  console.error(`personal-data check: ${findings.length} finding(s) in tracked files.\n`)
  for (const f of findings) console.error(`  ${f.path}:${f.line}  ${f.kind}  ${redact(f)}`)
  console.error(
    "\nPeople's contact details and movements belong in Firestore behind a server-side gate, not in this public\n" +
      "repository. Move the data, or use a placeholder on a reserved domain (example.com, *.test) or a 555 number.\n" +
      "Only an address that is genuinely not personal goes on scripts/personal-data/allowlist.json.",
  )
  if (process.argv.includes("--pending")) {
    const seen = new Set<string>()
    const entries = findings
      .filter((f) => !seen.has(`${f.path}|${f.sha256}`) && seen.add(`${f.path}|${f.sha256}`))
      .map((f) => ({ path: f.path, sha256: f.sha256, reason: "" }))
    console.error(`\n${JSON.stringify(entries, null, 2)}`)
  }
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
