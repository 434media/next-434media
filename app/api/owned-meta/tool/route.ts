import { randomUUID } from "node:crypto"
import { decideOwnedMeta, excludeOwnedMetaPost, ownedMetaStore } from "@/lib/firestore-crm"
import { executeOwnedMeta, ownedMetaBrandEnabled, ownedMetaHealth, prepareOwnedMetaBatch, recordOwnedMetaFailure } from "@/lib/owned-meta-execution"
import { readSlackMessage } from "@/lib/owned-meta-slack"
import { handleOwnedMetaTool } from "@/lib/owned-meta-tool-handler"

export const runtime = "nodejs"
export const maxDuration = 60

/** Bearer-authenticated publisher tool for the Slack executor. See lib/owned-meta-tool-handler.ts. */
export async function POST(req: Request) {
  return handleOwnedMetaTool(req, {
    env: { VERCEL_ENV: process.env.VERCEL_ENV, OWNED_META_TOOL_SECRET: process.env.OWNED_META_TOOL_SECRET, OWNED_META_APPROVER_SLACK_IDS: process.env.OWNED_META_APPROVER_SLACK_IDS },
    store: ownedMetaStore(),
    brandEnabled: ownedMetaBrandEnabled,
    prepare: prepareOwnedMetaBatch,
    decide: (id, revision, hash, email, note) => decideOwnedMeta(id, revision, hash, "approved", { email, name: email }, note),
    execute: executeOwnedMeta,
    recordFailure: recordOwnedMetaFailure,
    exclude: excludeOwnedMetaPost,
    health: ownedMetaHealth,
    readSlackMessage: (channel, ts) => readSlackMessage(channel, ts, process.env.OWNED_META_SLACK_BOT_TOKEN),
    randomId: randomUUID,
    now: () => new Date().toISOString(),
  })
}
