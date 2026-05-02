import { NextResponse } from "next/server"
import { checkBotId } from "botid/server"

/**
 * Server-side BotID guard for public POST routes.
 *
 * Vercel BotID is wired into next.config.ts via withBotId() — that ships the
 * detection script to the client. This helper enforces the verdict on the
 * server: every public form/signup route should `await requireHumanRequest()`
 * before doing any work, and short-circuit on a non-OK result.
 *
 * In development (NODE_ENV !== 'production') the SDK bypasses by default and
 * returns { isHuman: true, bypassed: true } — no setup needed for local dev.
 *
 * Verified bots (Googlebot etc.) are treated as bots for write endpoints since
 * legitimate crawlers have no business POSTing to a contact form.
 */
export async function requireHumanRequest(): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  try {
    const verdict = await checkBotId()
    if (verdict.isHuman || verdict.bypassed) return { ok: true }

    // Bot — block. Generic 403 so we don't leak which signal tripped.
    console.warn(
      "[botid] blocked bot request",
      JSON.stringify({
        isBot: verdict.isBot,
        isVerifiedBot: verdict.isVerifiedBot,
      }),
    )
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request blocked" },
        { status: 403 },
      ),
    }
  } catch (err) {
    // Fail-open on SDK errors. We'd rather accept a small amount of bot traffic
    // than break legitimate signups when BotID's worker is unreachable. Log it
    // so we notice if it becomes a pattern.
    console.error("[botid] check failed, allowing request:", err)
    return { ok: true }
  }
}
