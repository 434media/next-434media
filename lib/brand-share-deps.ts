import { assertVerifiedSender, getResend, RESEND_DOMAIN } from "./resend"
import { isSuppressed } from "./firestore-suppression"
import { firestoreBrandShares } from "./firestore-brand-shares"
import { firestoreBrandProfiles, readProfileVersion } from "./firestore-brand-profiles"
import { brandBookStatus } from "./content-pipeline/brand-book-check"
import { profileProblems, type BrandProfile } from "./content-pipeline/profile"
import { PIPELINE_PROPERTIES } from "./content-pipeline/properties"
import type { BrandBook } from "./content-pipeline/brand-book"
import type { ShareDeps } from "./brand-share-send"

/** Brand-book shares are sent from the 434 sending domain (lib/resend.ts); replies go to the person who sent it. */
export const SHARE_FROM = `434 MEDIA <brandbook@${RESEND_DOMAIN}>`

const labelOf = (id: string, profile?: { name?: string }) => PIPELINE_PROPERTIES.find(p => p.id === id)?.label ?? profile?.name ?? id

/** The live dependencies of the send path: Firestore, the suppression list and Resend. */
export function liveShareDeps(origin: string): ShareDeps {
  return {
    shares: firestoreBrandShares(),
    async book(brandId) {
      const pub = (await firestoreBrandProfiles().get(brandId))?.published
      if (!pub) return { ok: false, reason: "the brand has no published profile" }
      if (profileProblems(brandId, { [brandId]: pub.profile }).length) return { ok: false, reason: "its published profile does not validate" }
      const status = brandBookStatus((pub.profile as BrandProfile).visual)
      if (!status.ok) return { ok: false, reason: status.reason }
      return { ok: true, book: { label: labelOf(brandId, pub.profile as { name?: string }), versionId: pub.version_id, n: pub.n } }
    },
    isSuppressed,
    async sendMail(m) {
      assertVerifiedSender(SHARE_FROM)
      const { data, error } = await getResend().emails.send({ from: SHARE_FROM, to: m.to, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html })
      if (error || !data?.id) throw new Error(error?.message || "Resend returned no message id")
      return { id: data.id }
    },
    origin,
  }
}

/** The book a share pinned, from its kept version (not today's): the vendor sees what was sent. */
export async function pinnedBook(brandId: string, n: number): Promise<{ book: BrandBook; label: string } | null> {
  const v = await readProfileVersion(brandId, n)
  if (!v) return null
  const status = brandBookStatus((v.profile as BrandProfile).visual)
  return status.ok ? { book: status.book, label: labelOf(brandId, v.profile as { name?: string }) } : null
}
