/**
 * Canonical FAQ used for schema.org/FAQPage on the homepage.
 *
 * Every answer is master wording. The Section 1.1 definition and the 4.3
 * commercial-model definitions are read from the generated extracts; the
 * other answers quote the master section named beside them, verbatim. Do not
 * add a question the master does not supply the substance for, and do not
 * add distribution, media-buying, OTT or CTV entries here: master 9.7 puts
 * those on the Distribution page, and 2.11 says 434 does not perform them.
 */
import { BRAND_RECORDS } from "@/lib/brand-records"
import { COMMERCIAL_MODEL_DEFINITIONS } from "@/lib/commercial-models"

export interface FaqEntry {
  question: string
  answer: string
}

const commercialModels = Object.entries(COMMERCIAL_MODEL_DEFINITIONS)
  .map(([model, definition]) => `${model}: ${definition}`)
  .join(" ")

export const FAQS: FaqEntry[] = [
  {
    question: "What does 434 MEDIA do?",
    // 1.1, then 1.2 verbatim.
    answer: `${BRAND_RECORDS.canonicalDefinition} 434 MEDIA develops and owns original media properties while producing individual content, live experiences, and multi-part platforms for brands. Productions may also include purpose-built digital infrastructure and distribution through specialized partners.`,
  },
  {
    question: "What does 434 MEDIA produce?",
    // 1.7 lead-in; 4.3 definitions from the generated extract.
    answer: `434 operates through three commercial models: ${commercialModels}`,
  },
  {
    question: "Where is 434 MEDIA located?",
    // Address as in the root layout's structured data (8.2 allows location
    // there); the second sentence is 8.2's approved website line.
    answer:
      "434 MEDIA is located at 816 Camaron St., Suite 1.11, San Antonio, TX 78212. 434 produces on location, wherever the story is.",
  },
  {
    question: "What types of clients does 434 MEDIA work with?",
    // 1.1's "for brands", and 1.5 verbatim.
    answer:
      "434 MEDIA produces for brands. “Brands” includes qualified businesses, nonprofits, institutions, government entities, agencies, and other organizations.",
  },
  {
    question: "Does 434 MEDIA produce video?",
    // 1.3's approved response to "So you produce video?", verbatim.
    answer:
      "Yes. Video is one of our production formats. We also produce live experiences and multi-part platforms, and we develop original media properties of our own.",
  },
  {
    question: "How do I contact 434 MEDIA?",
    // 9.1 primary CTA and 9.5 intake.
    answer: "Start a production at https://www.434media.com/contact.",
  },
]

export function buildFaqPageLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  }
}
