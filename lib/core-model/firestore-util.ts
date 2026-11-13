// Shared helpers for the core model's Firestore modules (lib/firestore-people.ts and siblings).

import { Timestamp } from "firebase-admin/firestore"
import crypto from "crypto"

/** A field may be an ISO string, a Date, a Timestamp or a {toDate()} object depending on who wrote it. */
export function toIsoString(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString()
    } catch {
      return ""
    }
  }
  return ""
}

/** Firestore rejects `undefined`; drop those keys (top level and one level down) before a write. */
export function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) {
      out[k] = stripUndefined(v as object)
    } else {
      out[k] = v
    }
  }
  return out as T
}

/** Doc id for an email's claim: a hash, so an address never appears in a document path. */
export function emailClaimId(email: string): string {
  return crypto.createHash("sha256").update(email).digest("hex")
}

/** Doc id for a domain's claim. Domains carry no slash once normalized. */
export function domainClaimId(domain: string): string {
  return domain.replace(/\//g, "_")
}

/** Firestore doc ids cannot contain a slash. Activity ids from old collections can (never in practice). */
export function safeDocId(id: string): string {
  return id.replace(/\//g, "_")
}

export const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
