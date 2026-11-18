/**
 * The kill switch (434 build sequence V1 item 4, build plan v3: "After stop, nothing new is dispatched and descendant
 * runs are cancelled. In-flight work is reconciled. The flag is checked immediately before every send. Revoking the
 * Gateway key is a break-glass last resort only").
 *
 * One document, `crm_meta/agent_controls`, read uncached every time it is asked, the way the owned-Meta publisher reads
 * `crm_meta/owned_meta_enabled` (lib/firestore-crm.ts ownedMetaRuntimeEnabled):
 *
 *   { stopped: boolean, stopped_at?, stopped_by?, skills: { "<skill>": "off" | "proof" | "draft" },
 *     sends: { "<send path>": boolean }, ask: boolean }
 *
 * `ask` is the Ask panel's on/off (lib/ask/; V1 item 4, Ask panel slice 1). It is a switch of its own, not a skill
 * mode: the panel runs only when a signed-in person asks, never on an arrival. Missing reads as off.
 *
 * Fails closed: no document, a malformed one, a read that throws, or any environment but Production reads as stopped,
 * every skill off and every send refused. A stop overrides every skill mode and every send flag.
 *
 * This module is pure apart from `readAgentControls`, whose reader is injectable.
 */
import { SEND_PATHS, type SendPath } from "../send-approval"

export const AGENT_CONTROLS_DOC = { collection: "crm_meta", id: "agent_controls" } as const

/**
 * How a skill may run on its own trigger: `off`, nothing; `proof`, only on arrivals from the test sink (the proof run);
 * `draft`, on every arrival, producing drafts that wait for the founder. No mode sends: sending is a separate flag, and
 * every send needs a signed-in approval besides.
 */
export const SKILL_MODES = ["off", "proof", "draft"] as const
export type SkillMode = (typeof SKILL_MODES)[number]

export interface AgentControls {
  stopped: boolean
  stoppedAt?: string
  stoppedBy?: string
  skills: Record<string, SkillMode>
  sends: Record<SendPath, boolean>
  /** The Ask panel on or off. Off unless stored exactly `true`. */
  ask: boolean
}

const allSendsOff = (): Record<SendPath, boolean> => Object.fromEntries(SEND_PATHS.map((p) => [p, false])) as Record<SendPath, boolean>

/** What an unreadable, missing or malformed switch means: stopped. */
export const STOPPED: AgentControls = Object.freeze({ stopped: true, skills: {}, sends: allSendsOff(), ask: false }) as AgentControls

/** Reads the stored document. Anything that is not exactly the expected shape reads as stopped. */
export function parseControls(value: unknown): AgentControls {
  if (!value || typeof value !== "object") return { ...STOPPED, sends: allSendsOff() }
  const v = value as Record<string, unknown>
  if (typeof v.stopped !== "boolean") return { ...STOPPED, sends: allSendsOff() }
  const skills: Record<string, SkillMode> = {}
  if (v.skills && typeof v.skills === "object") {
    for (const [k, m] of Object.entries(v.skills as Record<string, unknown>)) skills[k] = (SKILL_MODES as readonly string[]).includes(m as string) ? (m as SkillMode) : "off"
  }
  const sends = allSendsOff()
  if (v.sends && typeof v.sends === "object") {
    for (const p of SEND_PATHS) sends[p] = (v.sends as Record<string, unknown>)[p] === true
  }
  return {
    stopped: v.stopped,
    ...(typeof v.stopped_at === "string" ? { stoppedAt: v.stopped_at } : {}),
    ...(typeof v.stopped_by === "string" ? { stoppedBy: v.stopped_by } : {}),
    skills,
    sends,
    ask: v.ask === true,
  }
}

/** The mode a skill runs in now. A stop turns every skill off. */
export function skillMode(c: AgentControls, skill: string): SkillMode {
  if (c.stopped) return "off"
  return c.skills[skill] ?? "off"
}

/** Whether the Ask panel may run now. A stop turns it off with everything else. */
export function askOn(c: AgentControls): boolean {
  return !c.stopped && c.ask === true
}

/** Whether a send on this path may be dispatched now. A stop refuses every send. */
export function sendAllowed(c: AgentControls, path: SendPath): boolean {
  return !c.stopped && c.sends[path] === true
}

/**
 * The switch as it is right now. Never cached. Outside Production it is always stopped (previews have no Firestore and
 * must never send); a read that fails is stopped.
 */
export async function readAgentControls(
  read: () => Promise<unknown> = async () => {
    const { getDb } = await import("../firebase-admin")
    return (await getDb().collection(AGENT_CONTROLS_DOC.collection).doc(AGENT_CONTROLS_DOC.id).get()).data()
  },
  env: Record<string, string | undefined> = process.env,
): Promise<AgentControls> {
  if (env.VERCEL_ENV !== "production") return { ...STOPPED, sends: allSendsOff() }
  try {
    return parseControls(await read())
  } catch (e) {
    console.error("[agent:controls] The kill switch could not be read; treating it as stopped:", e)
    return { ...STOPPED, sends: allSendsOff() }
  }
}
