import { admin, getDb } from "../lib/firebase-admin"
import { travelAccessId } from "../lib/travel/access-id"

function value(flag: string) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined
}

const email = value("--email")?.toLowerCase()
const name = value("--name")
const projectSlug = value("--project")
const travelerSlug = value("--traveler")
const role = value("--role") === "traveler" ? "traveler" : "viewer"
/**
 * Grant access without touching Firebase Authentication.
 *
 * Creating a user and minting a password link needs the Firebase Authentication
 * Admin role. The credential this project publishes media and writes Firestore
 * with does not hold it, and widening it would turn a media key into one that
 * can create identities. The narrow path instead: the user is created by hand
 * in the Firebase console, this writes only the scoped access record, and the
 * person sets their own password through "Forgot password?" on the sign-in page.
 * Nothing that grants account access travels by email.
 */
const firestoreOnly = process.argv.includes("--firestore-only")

if (!email || !name || !projectSlug || !travelerSlug) {
  console.error(
    "Usage: tsx scripts/provision-travel-viewer.ts --email viewer@example.com --name \"Viewer Name\" --project bvc-agm-2026 --traveler aj",
  )
  process.exit(1)
}

const viewerEmail = email as string
const viewerName = name as string
const viewerProject = projectSlug as string
const viewerTraveler = travelerSlug as string

async function main() {
  const db = getDb()
  if (!firestoreOnly) {
    const auth = admin.auth()
    try {
      await auth.getUserByEmail(viewerEmail)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === "auth/insufficient-permission") {
        console.error(
          "This credential cannot manage Firebase Authentication users.\n" +
            "Either grant it the Firebase Authentication Admin role, or create the user\n" +
            "by hand in the Firebase console and re-run with --firestore-only.",
        )
        process.exit(1)
      }
      if (code !== "auth/user-not-found") throw error
      await auth.createUser({ email: viewerEmail, displayName: viewerName, emailVerified: true })
    }
  }

  const id = travelAccessId(viewerEmail, viewerProject, viewerTraveler)
  await db.collection("travel_access").doc(id).set(
    {
      email: viewerEmail,
      name: viewerName,
      projectSlug: viewerProject,
      travelerSlug: viewerTraveler,
      role,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )

  console.log(`Travel access granted to ${viewerEmail} for ${viewerProject}/${viewerTraveler} as ${role}.`)
  console.log(role === "traveler"
    ? "This person sees and writes editor notes."
    : "Schedule only: editor notes stay hidden from this person.")

  if (firestoreOnly) {
    console.log(
      "\nAccess record written. Two things must be true before they can sign in:\n" +
        `  1. ${viewerEmail} exists in Firebase Console > Authentication > Users\n` +
        "  2. They set a password themselves via \"Forgot password?\" on /travel/sign-in\n" +
        "Send them the page link. Nothing here grants account access by email.",
    )
    return
  }

  const resetLink = await admin.auth().generatePasswordResetLink(viewerEmail)
  console.log("Send this one-time password setup link directly to the viewer:")
  console.log(resetLink)
}

main().catch((error) => {
  console.error("Travel viewer provisioning failed:", error)
  process.exit(1)
})
