import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 800

/**
 * POST /api/admin/engine/exam: runs one exam suite on our engine (434 build sequence V1 item 3, the exam; V1 item 4,
 * the proof slice). Founder only, since it spends Gateway credit (lib/exam/README.md: "A live run belongs behind a
 * gate"). The suite and the skill are read from 434-context at one commit through the read-only GitHub App
 * (lib/skills/source.ts); the skill's scripts run in a sandbox; every other tool is the suite's mock, so nothing is
 * sent, posted or written by the skill. The report is kept in `agent_exam_reports` (lib/agent/exam-reports.ts),
 * written when the run starts and after every case, so a run that hits the time limit keeps what it finished.
 *
 * GET returns the newest kept reports, or one with `?id=`.
 * Body: { suite: "intake-qualification" | "admin-ask", ref?: "main" | <commit>,
 *         model?: <slug>, only?: string[] }
 * A whole suite can take longer than one function allows; `only` runs a batch of cases.
 */
const SUITES: Record<string, string> = { "intake-qualification": "434-intake-qualification", "admin-ask": "admin-ask" }

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

  const [{ modelAllowed }, source, { parseSuite }, { engineExecutor, modelJudge }, { runSuite, reportMarkdown }, { skillScriptTool }, store] = await Promise.all([
    import("@/lib/engine/models"),
    import("@/lib/skills/source"),
    import("@/lib/exam/suite"),
    import("@/lib/exam/executors"),
    import("@/lib/exam/runner"),
    import("@/lib/agent/skill-scripts"),
    import("@/lib/agent/exam-reports"),
  ])
  if (!modelAllowed(model)) return NextResponse.json({ error: `Model ${model} is not on the engine's allow-list` }, { status: 400 })
  let meta: import("@/lib/agent/exam-reports").ExamRunMeta | null = null
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
    const startedAt = new Date().toISOString()
    meta = { id: `${suiteId}-${startedAt.replace(/[-:.]/g, "")}-${model.replace(/[^a-z0-9]+/gi, "-")}`, suite: suiteId, skill, model, commit, only, planned: only ? parsed.suite.cases.filter((c) => only.includes(c.id)).length : parsed.suite.cases.length, startedAt }
    await store.saveExamReport(store.startedReport(meta))
    const run = meta
    const report = await runSuite(parsed.suite, executor, {
      judge: modelJudge({ model, modelName: model }),
      only,
      gitSha: commit,
      onCase: (partial) => store.saveExamReport(store.reportDoc(run, partial, reportMarkdown(partial), "running", new Date().toISOString())),
    })
    await store.saveExamReport(store.reportDoc(run, report, reportMarkdown(report), "done", new Date().toISOString()))
    console.info(`[POST /api/admin/engine/exam] ${suiteId}@${commit.slice(0, 7)} on ${model}: ${report.totals.pass}/${report.totals.cases} pass`)
    return NextResponse.json({ id: run.id, commit, report, markdown: reportMarkdown(report) })
  } catch (e) {
    console.error("[POST /api/admin/engine/exam]", e)
    if (meta) {
      const failed = { ...store.startedReport(meta), status: "failed" as const, updatedAt: new Date().toISOString(), error: e instanceof Error ? e.message : "Exam failed" }
      // Keep the cases already saved: mark the stored run failed without overwriting them.
      await store.markExamFailed(failed).catch((err) => console.error("[POST /api/admin/engine/exam] could not mark the run failed", err))
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Exam failed" }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const auth = await requireFounder("GET /api/admin/engine/exam")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { getExamReport, listExamReports } = await import("@/lib/agent/exam-reports")
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (id) {
      const report = await getExamReport(id)
      if (!report) return NextResponse.json({ error: "No such exam report" }, { status: 404 })
      return NextResponse.json({ report })
    }
    return NextResponse.json({ reports: await listExamReports(10) })
  } catch (e) {
    console.error("[GET /api/admin/engine/exam]", e)
    return NextResponse.json({ error: "The exam reports could not be read" }, { status: 500 })
  }
}
