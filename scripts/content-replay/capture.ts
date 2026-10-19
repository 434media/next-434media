/**
 * Captures the replay set's source pages once (plan v9, Phase 1 direction 4), so a replay never depends on a live site.
 * Each story's primary page and supporting pages are read with the pipeline's own fetcher (sources.ts fetchSourcePage:
 * the same user agent, the same HTML-to-text) and written to pages/<story id>.json. A page already captured is kept
 * unless --refresh is given; a page that can't be read is reported and left out, never invented.
 *
 * Run: npx tsx scripts/content-replay/capture.ts [--refresh] [--only <story id>]
 * Network: the stories' public pages only. No model, no Firestore, no Canva.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fetchSourcePage, type SourcePage } from "../../lib/content-pipeline/sources"
import { loadStories, PAGES_DIR, type CapturedPages } from "./fixtures"

async function main() {
  const args = process.argv.slice(2), refresh = args.includes("--refresh"), only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null
  mkdirSync(PAGES_DIR, { recursive: true })
  const { stories } = loadStories()
  let failed = 0
  for (const s of stories) {
    if (only && s.id !== only) continue
    if (s.kind === "icymi" || !s.primaryUrl) continue // a roundup's source is the published posts in stories.json
    const file = join(PAGES_DIR, `${s.id}.json`)
    if (existsSync(file) && !refresh) { console.log(`kept      ${s.id}`); continue }
    const pages: Record<string, SourcePage> = {}, misses: string[] = []
    for (const url of [s.primaryUrl, ...(s.supporting ?? [])]) {
      try { pages[url] = await fetchSourcePage(url) } catch (err) { misses.push(`${url}: ${err instanceof Error ? err.message : "unreachable"}`) }
    }
    if (!pages[s.primaryUrl]) { failed++; console.error(`FAILED    ${s.id}: ${misses.join("; ")}`); continue }
    const out: CapturedPages = { story: s.id, capturedAt: new Date().toISOString(), pages, ...(misses.length ? { misses } : {}) }
    writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`)
    console.log(`captured  ${s.id}: ${Object.values(pages).map(p => `${p.url} (${p.text.length} chars${p.publishedAt ? `, ${p.publishedAt}` : ""})`).join("; ")}${misses.length ? `; missed ${misses.join("; ")}` : ""}`)
  }
  if (failed) { console.error(`${failed} stories could not be captured`); process.exitCode = 1 }
}

void main()
