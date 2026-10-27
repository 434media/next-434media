/**
 * The send command's hand-off to the brand page (plan v11.2.1 Step 4 item 5; coordinator's call 2026-10-27): the
 * command opens `/admin/brands/<id>#share&email=…&name=…&country=…&days=…`, and the signed-in requester presses Send
 * link, so the command sends through the button's route with no credential of its own. The share rides in the
 * fragment, which the browser never sends to a server. Client-safe: no Node imports.
 */
/** The send command's prefill from the page's fragment: `#share&email=…&name=…&country=…&days=…`; null when absent. */
export function commandPrefill(hash: string): { email?: string; name?: string; country?: string; days?: string } | null {
  if (!hash.startsWith("#share")) return null
  const q = new URLSearchParams(hash.slice("#share".length).replace(/^[&?]/, ""))
  const pick = (k: string, max: number) => { const v = q.get(k)?.trim(); return v ? v.slice(0, max) : undefined }
  const days = pick("days", 3)
  return { email: pick("email", 254), name: pick("name", 100), country: pick("country", 80), days: days && /^\d+$/.test(days) ? days : undefined }
}
