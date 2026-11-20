// The Skills list on the Agents page (V1 item 4; founder 2026-11-19: "Approve"; Display Standard §3.15, Provisional).
// One card per skill in the generated catalog, read fresh through the read-only GitHub App. Display only: it starts,
// pins and changes nothing; starting a skill from the admin is connector slice 2. Rendered on the server.

import { BookOpen } from "lucide-react"
import type { SkillCard } from "@/lib/skills/catalog-view"

const DATA_CLASS: Record<string, string> = {
  personal: "Personal data",
  internal: "Internal",
  brand: "Brand",
  "client-sealed": "Client, sealed",
}

function Label({ children }: { children: React.ReactNode }) {
  return <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{children}</dt>
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-700">{children}</span>
}

function examLine(exam: SkillCard["exam"]): string {
  if (exam.status === "none") return "No exam yet"
  if (exam.status === "suite") return exam.suites === 1 ? "Has an exam" : `${exam.suites} exams`
  return exam.status
}

export function SkillsFrame({ count, children }: { count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-8" aria-labelledby="skills-heading">
      <div className="mb-3">
        <h2 id="skills-heading" className="text-base font-semibold text-neutral-900">
          Skills{typeof count === "number" ? <span className="ml-1.5 font-normal text-neutral-500 tabular-nums">{count}</span> : null}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">Every skill in the catalog, read from 434-context each time you open this page. A list only: nothing here starts a skill.</p>
      </div>
      {children}
    </section>
  )
}

export function SkillsList({ skills, commit }: { skills: SkillCard[]; commit: string }) {
  return (
    <SkillsFrame count={skills.length}>
      {skills.length === 0 ? (
        <p className="text-sm text-neutral-500">The catalog lists no skills.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {skills.map((s) => (
            <li key={s.name} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex-1 min-w-0 break-words font-mono text-sm font-medium text-neutral-900">{s.name}</h3>
                {s.version && <span className="font-mono text-xs tabular-nums text-neutral-500">v{s.version}</span>}
                {s.status && s.status !== "active" && <Pill>{s.status}</Pill>}
              </div>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <Label>What it does</Label>
                  <dd className="mt-0.5 text-neutral-800">{s.does || "—"}</dd>
                </div>
                <div>
                  <Label>When to use it</Label>
                  <dd className="mt-0.5 text-neutral-700">{s.when || "—"}</dd>
                </div>
                <div>
                  <Label>Steps and stop points</Label>
                  <dd className="mt-0.5 text-neutral-700">
                    {s.stopPoint}{" "}
                    {s.sop ? (
                      <a href={s.sop.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-neutral-900 underline underline-offset-2">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden /> Every step is in the SOP
                      </a>
                    ) : (
                      <span className="text-neutral-500">No SOP yet.</span>
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-xs">
                  <div>
                    <Label>Owner</Label>
                    <dd className="text-neutral-800">{s.owner ?? "—"}</dd>
                  </div>
                  <div>
                    <Label>Autonomy ceiling</Label>
                    <dd className="text-neutral-800">{s.autonomyCeiling ?? "—"}</dd>
                  </div>
                  <div>
                    <Label>Data class</Label>
                    <dd className="text-neutral-800">{s.dataClass ? DATA_CLASS[s.dataClass] ?? s.dataClass : "—"}</dd>
                  </div>
                  <div>
                    <Label>Exam</Label>
                    <dd className="text-neutral-800">{examLine(s.exam)}</dd>
                  </div>
                  {s.brands.length > 0 && (
                    <div className="col-span-2">
                      <Label>Brands</Label>
                      <dd className="text-neutral-800">{s.brands.join(", ")}</dd>
                    </div>
                  )}
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-400">
        Catalog at <span className="font-mono">{commit.slice(0, 7)}</span> on 434-context.
      </p>
    </SkillsFrame>
  )
}
