import type { SlackMessage } from "./owned-meta-tool"

/**
 * Read one exact Slack message (parent or thread reply) by channel + ts.
 * GET-only; the bot token is sent as a header and never returned or logged.
 */
export async function readSlackMessage(channel: string, ts: string, token: string | undefined, fetcher: typeof fetch = fetch): Promise<SlackMessage | undefined> {
  if (!token || !/^[CGD][A-Z0-9]{6,}$/.test(channel) || !/^\d{10}\.\d{6}$/.test(ts)) return undefined
  const url = new URL("https://slack.com/api/conversations.replies")
  url.searchParams.set("channel", channel); url.searchParams.set("ts", ts); url.searchParams.set("inclusive", "true"); url.searchParams.set("limit", "200")
  try {
    const response = await fetcher(url, { method: "GET", headers: { authorization: `Bearer ${token}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) })
    const body = await response.json().catch(() => null) as { ok?: boolean; messages?: SlackMessage[] } | null
    if (!response.ok || !body?.ok || !Array.isArray(body.messages)) return undefined
    return body.messages.find(m => m && m.ts === ts)
  } catch { return undefined }
}

/** Best-effort result notice to the configured incoming webhook. Unset → skipped. */
export async function postSlackNotice(text: string, webhook: string | undefined, fetcher: typeof fetch = fetch): Promise<"sent" | "skipped" | "failed"> {
  if (!webhook) return "skipped"
  let url: URL
  try { url = new URL(webhook) } catch { return "skipped" }
  if (url.protocol !== "https:" || url.hostname !== "hooks.slack.com" || !url.pathname.startsWith("/services/")) return "skipped"
  try {
    const response = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), redirect: "error", signal: AbortSignal.timeout(10_000) })
    return response.ok ? "sent" : "failed"
  } catch { return "failed" }
}
