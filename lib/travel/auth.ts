import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "node:crypto"
import { getSession } from "@/lib/auth"
import { getDb } from "@/lib/firebase-admin"
import { travelAccessId } from "./access-id"

const TRAVEL_SESSION_COOKIE = "travel-auth-session"
const TRAVEL_ACCESS_COLLECTION = "travel_access"

export interface TravelViewer {
  email: string
  name: string
  projectSlug: string
  travelerSlug: string
  source: "staff" | "viewer"
  /**
   * "traveler" is the person the itinerary belongs to. Everyone else provisioned
   * against the same page — the client, a partner — is a "viewer" and reads the
   * schedule only. Editor notes are the traveller's working notepad, not part of
   * what the page publishes, so the role is what gates them.
   */
  role: "traveler" | "viewer"
}

/** Editor notes belong to the traveller and to 434. Nobody else sees them. */
export function canReadEditorNotes(viewer: TravelViewer) {
  return viewer.source === "staff" || viewer.role === "traveler"
}

function sessionSecret() {
  const secret = process.env.TRAVEL_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("TRAVEL_SESSION_SECRET (or ADMIN_SESSION_SECRET) must be at least 32 characters")
  }
  return secret
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
}

function signaturesMatch(expected: string, received: string) {
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function authorizeTravelViewer(
  email: string,
  projectSlug: string,
  travelerSlug: string,
): Promise<Omit<TravelViewer, "source"> | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const snapshot = await getDb()
    .collection(TRAVEL_ACCESS_COLLECTION)
    .doc(travelAccessId(normalizedEmail, projectSlug, travelerSlug))
    .get()

  if (!snapshot.exists) return null
  const data = snapshot.data() || {}
  if (data.isActive === false) return null
  return {
    email: normalizedEmail,
    name: String(data.name || normalizedEmail.split("@")[0]),
    projectSlug,
    travelerSlug,
    // Anyone provisioned without an explicit role reads the schedule only.
    // A wrong guess here would publish the traveller's notes to the client.
    role: data.role === "traveler" ? "traveler" : "viewer",
  }
}

export async function setTravelSession(viewer: Omit<TravelViewer, "source">) {
  const payload = Buffer.from(
    JSON.stringify({ viewer, expiresAt: Date.now() + 12 * 60 * 60 * 1000 }),
  ).toString("base64url")
  const store = await cookies()
  store.set(TRAVEL_SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 60 * 60,
    path: "/",
  })
}

export async function clearTravelSession() {
  const store = await cookies()
  store.delete(TRAVEL_SESSION_COOKIE)
}

async function getViewerSession(): Promise<TravelViewer | null> {
  const store = await cookies()
  const value = store.get(TRAVEL_SESSION_COOKIE)?.value
  if (!value) return null
  try {
    const [payload, signature] = value.split(".")
    if (!payload || !signature || !signaturesMatch(sign(payload), signature)) return null
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    if (!parsed.viewer?.email || Number(parsed.expiresAt) < Date.now()) return null
    return { ...parsed.viewer, source: "viewer" }
  } catch {
    return null
  }
}

export async function getTravelAccess(projectSlug: string, travelerSlug: string) {
  const staff = await getSession()
  if (staff) {
    return {
      email: staff.email,
      name: staff.name,
      projectSlug,
      travelerSlug,
      source: "staff" as const,
      role: "traveler" as const,
    }
  }

  const viewer = await getViewerSession()
  if (!viewer) return null
  if (viewer.projectSlug !== projectSlug || viewer.travelerSlug !== travelerSlug) return null
  return viewer
}
