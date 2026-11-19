// Firestore reports an exhausted quota as gRPC status 8, RESOURCE_EXHAUSTED.
// The Admin SDK surfaces it as `code: 8` (sometimes the string
// "resource-exhausted") with "RESOURCE_EXHAUSTED" or "Quota exceeded" in the
// message. Only this error means "quota exceeded"; an empty collection does not.
export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const { code, message } = err as { code?: unknown; message?: unknown }
  if (code === 8 || code === "resource-exhausted" || code === "RESOURCE_EXHAUSTED") return true
  return typeof message === "string" && /RESOURCE_EXHAUSTED|quota exceeded/i.test(message)
}
