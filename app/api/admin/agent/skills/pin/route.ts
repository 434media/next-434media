import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * The skill pin (V1 item 4, the proof slice): which version of a skill the engine runs. Founder only. A run reads the
 * skill at the pinned commit and refuses a folder that does not hash to the pinned fingerprint, so a change merged to
 * 434-context runs only after the founder pins it here. Nothing else writes `agent_skills` (it is a protected target:
 * lib/engine/protected-config.ts).
 *
 * GET  → the current pin, or null, and the source's coverage: the repositories the App's installation covers and its
 *        permissions, read live with a short-lived Metadata: read token that is revoked at once (lib/skills/source.ts).
 * POST { ref?: "main" | <commit>, model?: <slug> } → reads the skill and the catalog at that commit, checks the skill
 *       (lib/skills/loader.ts parseSkill), takes the autonomy ceiling from the catalog, and stores the pin.
 *
 * Only the intake skill can be pinned in this slice.
 */
const SKILL = "434-intake-qualification"

export async function GET() {
  const auth = await requireFounder("GET /api/admin/agent/skills/pin")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { readPin } = await import("@/lib/agent/intake-server")
  const { installationCoverage } = await import("@/lib/skills/source")
  // The source's coverage, read live: which repositories the App's installation covers and what it may do there.
  const source = await installationCoverage().catch((e: unknown) => ({ ok: false, problems: [e instanceof Error ? e.message : String(e)] }))
  return NextResponse.json({ pin: await readPin(SKILL), source })
}

export async function POST(req: Request) {
  const auth = await requireFounder("POST /api/admin/agent/skills/pin")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: { ref?: unknown; model?: unknown }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const ref = typeof body.ref === "string" && body.ref.trim() ? body.ref.trim() : "main"
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined

  const [{ resolveCommit, readSkillAt, readFileAt, catalogEntry, CATALOG_PATH }, { parseSkill }, { modelAllowed }, { sha256 }, { AUTONOMY_LEVELS }, { AGENT_SKILLS_COLLECTION }, { getDb }] = await Promise.all([
    import("@/lib/skills/source"),
    import("@/lib/skills/loader"),
    import("@/lib/engine/models"),
    import("@/lib/engine/protected-config"),
    import("@/lib/engine/tool-policy"),
    import("@/lib/agent/intake"),
    import("@/lib/firebase-admin"),
  ])
  if (model && !modelAllowed(model)) return NextResponse.json({ error: `Model ${model} is not on the engine's allow-list` }, { status: 400 })
  try {
    const commit = await resolveCommit(ref)
    const files = await readSkillAt(SKILL, commit)
    const parsed = parseSkill(files, { folder: SKILL })
    if (!parsed.ok) return NextResponse.json({ error: "The skill fails its checks at this commit", problems: parsed.problems }, { status: 422 })
    const catalogText = await readFileAt(commit, CATALOG_PATH)
    const entry = catalogEntry(catalogText, SKILL)
    if (!entry.autonomy_ceiling || !(AUTONOMY_LEVELS as readonly string[]).includes(entry.autonomy_ceiling)) {
      return NextResponse.json({ error: "The catalog gives this skill no autonomy ceiling; no run without one" }, { status: 422 })
    }
    const pin = {
      skill: SKILL,
      commit,
      sha256: parsed.skill.sha256,
      catalogSha256: sha256(catalogText),
      ceiling: entry.autonomy_ceiling,
      ...(model ?? entry.model ? { model: model ?? entry.model! } : {}),
      pinnedBy: "founder",
      pinnedAt: new Date().toISOString(),
    }
    if (pin.model && !modelAllowed(pin.model)) return NextResponse.json({ error: `The catalog's model ${pin.model} is not on the engine's allow-list` }, { status: 422 })
    await getDb().collection(AGENT_SKILLS_COLLECTION).doc(SKILL).set(pin)
    console.info(`[POST /api/admin/agent/skills/pin] ${SKILL} pinned at ${commit.slice(0, 7)} (${parsed.skill.sha256.slice(0, 12)})`)
    return NextResponse.json({ pin })
  } catch (e) {
    console.error("[POST /api/admin/agent/skills/pin]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pin failed" }, { status: 502 })
  }
}
