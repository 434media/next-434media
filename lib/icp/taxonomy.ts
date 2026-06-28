/**
 * Shared ICP taxonomy — 434's geography lists + industry recognition patterns.
 *
 * Neutral module imported by BOTH the canonical rubric (lib/icp/rubric.ts) and
 * the prospecting scorer (lib/prospecting/scorer.ts) so there's one source of
 * truth and no circular dependency between them.
 */

export const SOUTH_TEXAS_CITIES = [
  "san antonio",
  "brownsville",
  "laredo",
  "mcallen",
  "harlingen",
  "corpus christi",
  "edinburg",
  "rio grande",
  "rgv",
]

export const TEXAS_CITIES = [
  "austin",
  "houston",
  "dallas",
  "fort worth",
  "el paso",
  "lubbock",
  "amarillo",
  "waco",
]

export const HISPANIC_TARGETED_METROS = [
  "miami",
  "los angeles",
  "chicago",
  "phoenix",
  "albuquerque",
  "denver",
]

export interface IndustrySignal {
  name: string
  patterns: RegExp[]
  score: number
}

/**
 * Industry recognition patterns for 434's real verticals. Run against the
 * org industry field, org name, person title, and (on the prospecting path)
 * filter keywords. Scores are 22–25 (top vs secondary ICP tiers).
 */
export const INDUSTRY_SIGNALS: IndustrySignal[] = [
  {
    name: "Healthcare / life sciences",
    score: 25,
    patterns: [
      /\bhealth(care|tech)?\b/i,
      /\bbio(tech)?\b/i,
      /\bmedic(al|ine)\b/i,
      /\bpharma\b/i,
      /\bhospital\b/i,
      /\bclinic(al)?\b/i,
      /\bmilitary[- ]health\b/i,
      /\blife scien(ce|ces)\b/i,
      /\bprosthetic/i,
    ],
  },
  {
    name: "Capital / VC / accelerators",
    score: 25,
    patterns: [
      /\bventure(s)?\b/i,
      /\bcapital\b/i,
      /\b(angel|angels)\b/i,
      /\baccelerator\b/i,
      /\bincubator\b/i,
      /\bfamily office\b/i,
      /\bportfolio (marketing|management)\b/i,
      /\b(VC|LP|GP) firm\b/i,
    ],
  },
  {
    name: "Sports / fight / lifestyle (Latino-targeted)",
    score: 25,
    patterns: [
      /\bboxing\b/i,
      /\bfight (sport|club|gym)\b/i,
      /\bMMA\b/i,
      /\bsports? (apparel|gear|nutrition|league)\b/i,
      /\bathletic(s)?\b/i,
    ],
  },
  {
    name: "Tech / SaaS / dev",
    score: 22,
    patterns: [
      /\bsoftware\b/i,
      /\bSaaS\b/i,
      /\bdeveloper(s)?\b/i,
      /\bAI (tool|product|platform)\b/i,
      /\bdev(\.|ops)?\b/i,
      /\b(edtech|recruit|talent platform)\b/i,
    ],
  },
  {
    name: "Media / broadcast (bilingual)",
    score: 25,
    patterns: [
      /\bunivision\b/i,
      /\btelemundo\b/i,
      /\bbroadcast(er|ing)\b/i,
      /\bspanish[- ]language\b/i,
      /\bbilingual media\b/i,
    ],
  },
  {
    name: "Education / workforce",
    score: 22,
    patterns: [
      /\buniversity\b/i,
      /\bcollege\b/i,
      /\binstitute\b/i,
      /\bacademy\b/i,
      /\beducation\b/i,
      /\bworkforce\b/i,
    ],
  },
  {
    name: "Nonprofit / mission",
    score: 22,
    patterns: [
      /\bfoundation\b/i,
      /\bministries\b/i,
      /\bnonprofit\b/i,
      /\balliance\b/i,
      /\bcoalition\b/i,
      /\bsocial impact\b/i,
      /\bmission(-driven)?\b/i,
    ],
  },
  {
    name: "CPG (Hispanic focus)",
    score: 22,
    patterns: [
      /\b(foods?|beverage|snack)\b/i,
      /\bconsumer (brand|goods)\b/i,
      /\b(hispanic|latino|latinx) brand\b/i,
    ],
  },
  {
    name: "Civic-tech / economic-development",
    score: 22,
    patterns: [
      /\bcivic(-tech)?\b/i,
      /\beconomic development\b/i,
      /\bchamber of commerce\b/i,
      /\btech bloc\b/i,
    ],
  },
]
