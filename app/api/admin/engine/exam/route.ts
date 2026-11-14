import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 800

/**
 * POST /api/admin/engine/exam: runs one exam suite on our engine (434 build sequence V1 item 3, the exam; V1 item 4,
 * the proof slice). Founder only, since it spends Gateway credit (lib/exam/README.md: "A live run belongs behind a
 * gate"). The suite and the skill are read from 434-context at one commit through the read-only GitHub App
 * (lib/skills/source.ts); the skill's scripts run in a sandbox; every other tool is the suite's mock, so nothing is
 * sent, posted or written. Stores nothing: the report comes back in the response and goes into the run log.
 *
 * Body: { suite: "intake-qualification", skill: "434-intake-qualification", ref?: "main" | <commit>,
 *         model?: <slug>, only?: string[] }
 * A whole suite can take longer than one function allows; `only` runs a batch of cases.
 */
const SUITES: Record<string, string> = { "intake-qualification": "434-intake-qualification" }

export async function POST(req: Request) {
  const auth = await requireFounder("POST /api/admin/engine/exam")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: { suite?: unknown; ref?: unknown; model?: unknown; only?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const suiteId = typeof body.suite === "string" ? body.suite : ""
  const skill = SUITES[suiteId]
  if (!skill) return NextResponse.json({ error: `Unknown suite; one of ${Object.keys(SUITES).join(", ")}` }, { status: 400 })
  const ref = typeof body.ref === "string" && body.ref.trim() ? body.ref.trim() : "main"
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "anthropic/claude-sonnet-5.5"
  const only = Array.isArray(body.only) ? body.only.filter((x): x is string => typeof x === "string").slice(0, 50) : undefined

  const [{ modelAllowed }, source, { parseSuite }, { engineExecutor, modelJudge }, { runSuite, reportMarkdown }, { skillScriptTool }] = await Promise.all([
    import("@/lib/engine/models"),
    import("@/lib/skills/source"),
    import("@/lib/exam/suite"),
    import("@/lib/exam/executors"),
    import("@/lib/exam/runner"),
    import("@/lib/agent/skill-scripts"),
  ])
  if (!modelAllowed(model)) return NextResponse.json({ error: `Model ${model} is not on the engine's allow-list` }, { status: 400 })
  try {
    const commit = await source.resolveCommit(ref)
    const [files, suiteFiles] = await Promise.all([source.readSkillAt(skill, commit), source.readSuiteAt(suiteId, commit)])
    const parsed = parseSuite(suiteFiles)
    if (!parsed.ok) return NextResponse.json({ error: "The suite fails its checks", problems: parsed.problems }, { status: 422 })
    const executor = engineExecutor({
      skill: { files, folder: skill },
      model,
      modelName: model,
      maxOutputTokens: 16_000,
      effort: "low",
      maxSteps: 16,
      liveTools: () => {
        const s = skillScriptTool(files)
        return { tools: { run_skill_script: s.tool }, close: s.close }
      },
    })
    const report = await runSuite(parsed.suite, executor, { judge: modelJudge({ model, modelName: model }), only, gitSha: commit })
    console.info(`[POST /api/admin/engine/exam] ${suiteId}@${commit.slice(0, 7)} on ${model}: ${report.totals.pass}/${report.totals.cases} pass`)
    return NextResponse.json({ commit, report, markdown: reportMarkdown(report) })
  } catch (e) {
    console.error("[POST /api/admin/engine/exam]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Exam failed" }, { status: 502 })
  }
}
