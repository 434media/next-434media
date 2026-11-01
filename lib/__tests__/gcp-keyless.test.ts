/**
 * Offline. The keyless path (lib/gcp-keyless.ts) must stay off until every variable is set, so merging it changes
 * nothing, and must refuse a partial set rather than fall back to the key.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { keylessConfig } from "../gcp-keyless"

const FULL = {
  GCP_PROJECT_NUMBER: "123456789012",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel-434media",
  GCP_SERVICE_ACCOUNT_EMAIL: "reader@example-project.iam.gserviceaccount.com",
  FIREBASE_PROJECT_ID: "example-project",
}

test("off when none of the variables is set", () => {
  assert.equal(keylessConfig({ GOOGLE_SERVICE_ACCOUNT_KEY: "{}" }), null)
})

test("a partial set throws and names what is missing", () => {
  const { GCP_SERVICE_ACCOUNT_EMAIL: _omit, ...partial } = FULL
  assert.throws(() => keylessConfig(partial), /missing GCP_SERVICE_ACCOUNT_EMAIL/)
})

test("on when all five are set", () => {
  assert.deepEqual(keylessConfig(FULL), FULL)
})
