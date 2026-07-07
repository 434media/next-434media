import type { DeckSlide, SlideType } from "@/types/deck-types"

// The default 12-slide template, seeded with the "Lab Cafe — health" content and
// slide ORDER from the original 434 Media Canva pitch deck. `buildDefaultDeckSlides()`
// stamps a fresh instance_id per slide so a new deck's slides are individually
// addressable (add / reorder / remove / duplicate). Images are left empty here —
// the renderer falls back to its per-type stock imagery until an Asset is set.

// Stable, unique id for a slide instance. Uses crypto.randomUUID where available
// (modern browsers + Node 19+), with a timestamp/random fallback.
function newInstanceId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  return `slide_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

// Text content per slide type, keyed per SLIDE_META. Newlines separate list items.
const DEFAULT_TEXTS: Record<SlideType, Record<string, string>> = {
  title: {
    company: "THE LAB\nCAFE",
    subtitle: "Presented By : 434 Media",
  },
  heard: {
    challenge:
      "Heavy reliance on paid search\nLimited awareness outside existing demand channels\nNeed for scalable customer acquisition",
    opportunity:
      "Growing consumer demand for direct-access healthcare\nStrong operation and expertise\nAbility to scale rapidly into additional markets",
    outcome:
      "Increase booked appointments\nReduce customer acquisition cost\nBuild sustainable brand awareness\nCreate repeatable growth systems",
  },
  why: {
    point1: "Nearly 50% of STI cases occur among individuals aged 15–24.",
    point2:
      "Millions of consumers seek health information online before engaging healthcare providers.",
    point3:
      "Convenience, speed, privacy, and direct access continue to influence healthcare purchasing decisions.",
  },
  opportunity: {
    headline:
      "THE LAB CAFE IS NOT COMPETING IN THE TESTING INDUSTRY. IT IS CREATING A CONSUMER HEALTHCARE ACCESS PLATFORM.",
    bullets:
      "Consumers increasingly expect healthcare on demand\nHealth information is becoming consumer controlled\nPrivacy and convenience continue to drive adoption\nThe Lab Cafe can become a trusted destination for health decision-making",
  },
  strategy: {
    line1: "Acquire consumers actively seeking answers.",
    line2: "Building trust through education on relevant health content.",
    line3:
      "Curate repeat customers through ongoing health engagement in order to retain established trust.",
  },
  plan: {
    phase1_label: "Demand Capture",
    phase1_items: "Paid Search\nLocal SEO\nHigh-Intent Landing Pages\nConversion Rate Optimization",
    phase2_label: "Demand Expansion",
    phase2_items: "Paid Social\nYouTube & Video\nCreator & Influencer Partnerships\nRetargeting",
    phase3_label: "Brand Development",
    phase3_items: "Content & Storytelling\nPR & Earned Media\nStrategic Partnerships\nCommunity Building",
  },
  audience: {
    primary: "Young Adults (18–34) — largest volume opportunity.",
    secondary: "Women (20–34) — family planning, fertility, routine health.",
    behavioral: "Dating App Users — high intent and active decision-making.",
    growth: "LGBTQ+ Community — routine screening and proactive health management.",
  },
  flow: {
    steps:
      'Consumer searches: "STD testing near me"\nDiscovers The Lab Cafe\nBooks Appointment\nReceives Information\nReturns For Additional Services',
  },
  success: {
    title: "Methodist Healthcare Ministries + VelocityTX",
    stat1: "969K+ Views",
    stat2: "403K+ Accounts Reached",
    stat3: "1,600+ Participants Engaged",
    challenge:
      "Increase awareness and engagement around Social Determinants of Health across South Texas.",
    solution:
      "Community-focused awareness campaign combining content, events, education, and storytelling.",
    outcome:
      "Measurable reach and ecosystem participation that transformed awareness into action.",
  },
  metrics: {
    marketing: "Website Traffic\nLead Volume\nCost Per Lead\nCost Per Appointment",
    business:
      "Customer Acquisition Cost (CAC)\nRevenue Per Customer\nLifetime Value (LTV)\nRepeat Visit Rate",
    executive: "Market Expansion Readiness\nChannel ROI\nGrowth Efficiency",
  },
  engagement: {
    strategy: "Market Research\nAudience Development\nGrowth Planning",
    acquisition: "Media Buying\nSEO\nContent Development",
    optimization: "Analytics\nTesting\nConversion Improvements",
  },
  nextsteps: {
    step1_title: "Discovery Alignment",
    step1_sub: "Finalize goals and KPIs",
    step2_title: "Launch Phase 1",
    step2_sub: "Demand Capture Campaigns",
    step3_title: "Measure & Optimize",
    step3_sub: "Validate CAC and Conversion Rates",
    step4_title: "Scale Into New Markets",
    step4_sub: "Florida · Additional Texas Markets · National Expansion",
    closing:
      "The objective is not simply to generate tests. It is to build a scalable consumer healthcare brand powered by information, trust, and access.",
  },
}

// The canonical slide order for the default template — matches the source Canva:
// Title → What We Heard → Why This Matters → Opportunity → Strategic → Marketing
// Plan → Audience → Customer Flow → Success → What Success Looks Like →
// Recommended Engagement → Next Steps.
const DEFAULT_ORDER: SlideType[] = [
  "title",
  "heard",
  "why",
  "opportunity",
  "strategy",
  "plan",
  "audience",
  "flow",
  "success",
  "metrics",
  "engagement",
  "nextsteps",
]

/** Build a fresh copy of the default 12-slide deck with new instance ids. */
export function buildDefaultDeckSlides(): DeckSlide[] {
  return DEFAULT_ORDER.map((type) => ({
    instance_id: newInstanceId(),
    type,
    texts: { ...DEFAULT_TEXTS[type] },
  }))
}

/** Build a single blank slide of the given type (for "add slide" in the editor). */
export function buildBlankSlide(type: SlideType): DeckSlide {
  return { instance_id: newInstanceId(), type, texts: {} }
}
