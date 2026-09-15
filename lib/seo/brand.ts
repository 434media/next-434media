/**
 * Brand identity used across every OG/Twitter card.
 *
 * Governed strings are not restated here — `description` reads the Section 1.1
 * canonical definition from the generated extract, and the motto is read from
 * BRAND_RECORDS at each use so the right form reaches the right field.
 *
 * `headline`, `headline2` and `shortTagline` were the retired positioning
 * ("Bold Stories. / Proven Impact.") and are deleted rather than repointed.
 */
import { BRAND_RECORDS } from "@/lib/brand-records"

export const BRAND = {
  name: "434 MEDIA",
  domain: "www.434media.com",
  location: "SAN ANTONIO, TX",
  description: BRAND_RECORDS.canonicalDefinition,
} as const
