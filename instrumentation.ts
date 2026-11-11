/**
 * Runs once when a server instance starts (Next.js instrumentation). It installs the engine guard
 * (lib/engine/guard.ts): every language-model call made by name then passes the model allow-list and the daily
 * budget before it is sent, and its cost is recorded against its task (434 build sequence V1 item 2, Foundation A).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { installEngineGuard } = await import("./lib/engine/guard")
  await installEngineGuard()
}
