export const TRAVEL_PROJECTS = {
  "bvc-agm-2026": {
    slug: "bvc-agm-2026",
    client: "Builders VC",
    purpose: "AGM",
    year: 2026,
    startDate: "2026-09-27",
    endDate: "2026-10-10",
    airtableBaseId: "appSrPavFP7MYuUhG",
    travelers: {
      aj: {
        slug: "aj",
        name: "Augusto Garces",
        displayName: "AJ",
        routeStops: [
          { code: "LAX", city: "Los Angeles", dates: "Sep 27", home: true },
          { code: "IA", city: "Osage", dates: "Sep 27–28" },
          { code: "NYC", city: "New York", dates: "Sep 29–30" },
          { code: "LAX", city: "Home", dates: "Oct 1–4", home: true },
          { code: "PHL", city: "Philadelphia", dates: "Oct 5–6" },
          { code: "SFO", city: "San Francisco", dates: "Oct 6–8" },
          { code: "TBD", city: "Return", dates: "Oct 9–10" },
        ],
      },
    },
  },
} as const

export type TravelProjectSlug = keyof typeof TRAVEL_PROJECTS

export function getTravelProject(projectSlug: string, travelerSlug: string) {
  const project = TRAVEL_PROJECTS[projectSlug as TravelProjectSlug]
  if (!project) return null
  const traveler = project.travelers[travelerSlug as keyof typeof project.travelers]
  if (!traveler) return null
  return { project, traveler }
}
