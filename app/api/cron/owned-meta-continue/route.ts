import { randomUUID } from "node:crypto"
import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { listStartedOwnedMetaPostIds, ownedMetaStore } from "@/lib/firestore-crm"
import { executeOwnedMeta, ownedMetaDeploymentEnabled, recordOwnedMetaFailure } from "@/lib/owned-meta-execution"
import { postSlackNotice } from "@/lib/owned-meta-slack"
import { continueOwnedMeta } from "@/lib/owned-meta-tool-handler"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Resumes approved publisher runs whose Meta media is still processing.
 * Jobs with a recorded final intent are never touched, so no final publish repeats.
 */
export async function GET(request: NextRequest) {
  return runCronJob("owned-meta-continue", request, () => continueOwnedMeta({
    deploymentEnabled: ownedMetaDeploymentEnabled,
    listIds: () => listStartedOwnedMetaPostIds(),
    store: ownedMetaStore(),
    execute: executeOwnedMeta,
    recordFailure: recordOwnedMetaFailure,
    notify: text => postSlackNotice(text, process.env.OWNED_META_SLACK_WEBHOOK_URL),
    randomId: randomUUID,
    now: () => new Date().toISOString(),
  }))
}
