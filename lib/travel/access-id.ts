import { createHash } from "node:crypto"

export function travelAccessId(email: string, projectSlug: string, travelerSlug: string) {
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}|${projectSlug}|${travelerSlug}`)
    .digest("hex")
}
