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
  const auth = admin.auth()
  try {
    await auth.getUserByEmail(viewerEmail)
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error
    await auth.createUser({ email: viewerEmail, displayName: viewerName, emailVerified: true })
  }

  const id = travelAccessId(viewerEmail, viewerProject, viewerTraveler)
  await db.collection("travel_access").doc(id).set(
    {
      email: viewerEmail,
      name: viewerName,
      projectSlug: viewerProject,
      travelerSlug: viewerTraveler,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )

  const resetLink = await auth.generatePasswordResetLink(viewerEmail)
  console.log(`Travel access granted to ${viewerEmail} for ${viewerProject}/${viewerTraveler}.`)
  console.log("Send this one-time password setup link directly to the viewer:")
  console.log(resetLink)
}

main().catch((error) => {
  console.error("Travel viewer provisioning failed:", error)
  process.exit(1)
})
