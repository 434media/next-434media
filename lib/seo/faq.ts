/**
 * Canonical FAQ used for schema.org/FAQPage on the homepage.
 *
 * Questions are written to mirror the conversational, intent-driven queries
 * generative engines surface ("Best digital marketing agency in San Antonio?",
 * "Who does OTT advertising in Texas?"). Answers are answer-first and concise —
 * the form AI engines prefer to cite verbatim.
 */

export interface FaqEntry {
  question: string
  answer: string
}

export const FAQS: FaqEntry[] = [
  {
    question: "What does 434 MEDIA do?",
    answer:
      "434 MEDIA is a creative media and smart marketing agency based in San Antonio, TX. We deliver ROI-driven brand strategy, video production, web development, programmatic and OTT/CTV advertising, multichannel campaigns, and event production for enterprises across South Texas.",
  },
  {
    question: "Where is 434 MEDIA located?",
    answer:
      "434 MEDIA is headquartered at 816 Camaron St., Suite 1.11, San Antonio, TX 78212. We work with enterprise clients throughout San Antonio, South Texas, and across the United States.",
  },
  {
    question: "What types of clients does 434 MEDIA work with?",
    answer:
      "We partner with venture capital firms, accelerators, startups, healthcare and life-science organizations, civic and nonprofit institutions, and enterprise brands that need integrated brand storytelling and performance media.",
  },
  {
    question: "Does 434 MEDIA offer OTT, CTV, and programmatic advertising?",
    answer:
      "Yes. We plan and execute audience-targeted programmatic, OTT, and connected-TV campaigns end-to-end — including creative production, media buying, and performance reporting tied to enterprise KPIs.",
  },
  {
    question: "Does 434 MEDIA do video production?",
    answer:
      "Yes. Video production is a core service. We handle concept and scripting, multi-camera shoots, post-production, and distribution-ready cuts for brand films, ad campaigns, event coverage, and recurring content programs.",
  },
  {
    question: "Can 434 MEDIA build my website?",
    answer:
      "Yes. We design and build modern marketing sites and web platforms on Next.js with conversion goals, analytics instrumentation, and accessibility built in from day one.",
  },
  {
    question: "What makes 434 MEDIA different from other San Antonio marketing agencies?",
    answer:
      "We combine in-house production capability — video, web, design, and event execution — with measurable, ROI-driven media strategy. Clients get one partner for narrative, creative, and performance instead of stitching together specialists.",
  },
  {
    question: "How do I contact 434 MEDIA?",
    answer:
      "Email build@434media.com or visit https://www.434media.com/contact to start a project conversation. We respond to qualified inquiries within one business day.",
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
