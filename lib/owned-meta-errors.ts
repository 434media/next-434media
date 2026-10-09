import type { MetaDestination } from "./owned-meta-publisher"

export type MetaOperation = "prepare" | "publish" | "verify" | "connection"
/** Only these fields may cross the provider boundary. Never retain a vendor message. */
export interface SafeMetaError {
  destination: MetaDestination
  operation: MetaOperation
  at: string
  httpStatus: number
  code?: number
  subcode?: number
  traceId?: string
}

export function safeMetaError(status: number, body: unknown, destination: MetaDestination, operation: MetaOperation, secret: string): SafeMetaError {
  const detail: SafeMetaError = { destination, operation, at: new Date().toISOString(), httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0 }
  const error = body && typeof body === "object" && "error" in body ? body.error : null
  if (!error || typeof error !== "object") return detail
  for (const [source, target] of [["code", "code"], ["error_subcode", "subcode"]] as const) {
    const value = (error as Record<string, unknown>)[source]
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) detail[target] = value
  }
  const trace = "fbtrace_id" in error ? error.fbtrace_id : undefined
  if (typeof trace === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(trace) && !(secret && (trace.includes(secret) || secret.includes(trace)))) detail.traceId = trace
  return detail
}
