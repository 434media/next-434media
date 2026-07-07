import { getSOPsFromFirestore } from "@/lib/firestore-project-management"
import type { SequenceStep } from "@/lib/lead-prompt"

/**
 * Canonical outreach-sequence templates authored by the GTM squad, stored as
 * SOP docs in Firestore (`pm_sops`, category "find"). A doc is designated as the
 * template for a sequence step by tagging it `sequence-1` / `sequence-2` /
 * `sequence-3` (case-insensitive). Most-recently-updated wins on ties.
 *
 * The sequence draft flow (hybrid): if a step has a designated template, the AI
 * personalizes it per-lead; otherwise it falls back to writing from scratch.
 */

export interface SequenceTemplate {
  /** Parsed subject line (may still contain [placeholders] for the AI to fill). */
  subject?: string
  /** Parsed body copy (with [placeholders]). */
  body: string
  /** The SOP doc title this came from — for logging / rep visibility. */
  sourceTitle: string
}

// GTM category, incl. the legacy "GTM" alias that predates the verb rename.
const FIND_CATEGORIES = new Set(["find", "GTM"])
const stepTag = (step: SequenceStep) => `sequence-${step}`

// Pull a "Subject: …" line (plain or **bold**) out of the template markdown; the
// rest is the body. Also strips a leading markdown header (e.g. "# Email 1").
function parseTemplate(content: string): { subject?: string; body: string } {
  const lines = (content || "").split("\n")
  const subjectRe = /^\s*\**\s*subject\s*:?\s*\**\s*(.+?)\s*\**\s*$/i
  let subject: string | undefined
  const bodyLines: string[] = []
  for (const line of lines) {
    if (subject === undefined) {
      const m = line.match(subjectRe)
      if (m) {
        subject = m[1].replace(/\*+$/, "").trim()
        continue
      }
    }
    bodyLines.push(line)
  }
  let body = bodyLines.join("\n").trim()
  body = body.replace(/^#{1,6}\s.*\n+/, "").trim() // drop a leading "# heading"
  return { subject, body }
}

/**
 * Resolve the designated sequence templates. Returns a partial map keyed by
 * step; steps without a tagged template are simply absent (caller falls back to
 * from-scratch generation). Never throws — a template-fetch failure yields {}.
 */
export async function getSequenceTemplates(): Promise<
  Partial<Record<SequenceStep, SequenceTemplate>>
> {
  let sops
  try {
    sops = await getSOPsFromFirestore()
  } catch {
    return {}
  }

  const out: Partial<Record<SequenceStep, SequenceTemplate>> = {}
  for (const step of [1, 2, 3] as const) {
    const tag = stepTag(step)
    const matches = sops.filter(
      (s) =>
        FIND_CATEGORIES.has(s.category) &&
        (s.tags ?? []).some((t) => t.trim().toLowerCase() === tag),
    )
    if (matches.length === 0) continue
    matches.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    const doc = matches[0]
    const { subject, body } = parseTemplate(doc.content)
    if (body) out[step] = { subject, body, sourceTitle: doc.title }
  }
  return out
}
