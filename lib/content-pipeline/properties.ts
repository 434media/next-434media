import type { Brand } from "@/components/crm/types"
import type { LeadPlatform } from "@/types/crm-types"
import { SERIES, type RequestKind } from "./series"

/**
 * The properties the Generate panel offers (the CRM roster; the UI word is "Property", the code keeps "brand" and
 * "platform"). Only MilCityUSA has templates and editorial rules connected, so it is the only one that can be
 * chosen; generating for the others is not in Phase 1. `id` is what a job stores: the publisher's brand id where
 * one exists ("milcity", as content posts already carry in intake.metaBrand and tags). `roster` names the existing
 * identifier in code (LeadPlatform for four of them, the CRM Brand for Digital Canvas); nothing is renamed.
 */
export interface PipelineProperty { id: string; label: string; roster: LeadPlatform | Brand; active: boolean; reason?: string }
const NOT_YET = "No templates connected yet"
export const PIPELINE_PROPERTIES: readonly PipelineProperty[] = [
  { id: "milcity", label: "MilCityUSA", roster: "MilCity", active: true },
  { id: "txmx", label: "TXMX Boxing", roster: "TXMX", active: false, reason: NOT_YET },
  { id: "vemos", label: "VemosVamos", roster: "VemosVamos", active: false, reason: NOT_YET },
  { id: "devsa", label: "DEVSA", roster: "DevSA", active: false, reason: NOT_YET },
  { id: "digital-canvas", label: "Digital Canvas", roster: "Digital Canvas", active: false, reason: NOT_YET },
]
export const DEFAULT_PROPERTY = "milcity"

/** What a property's templates generate: for MilCityUSA, the series the worker fills, with their brand templates (feed). */
export interface PipelineTemplate { kind: RequestKind; label: string; templates: string[]; detail: string }
export const PROPERTY_TEMPLATES: Record<string, readonly PipelineTemplate[]> = {
  milcity: [
    { kind: "news", label: SERIES.news.label, templates: [SERIES.news.templates.feed], detail: "One story, one card" },
    { kind: "breaking", label: SERIES.breaking.label, templates: [SERIES.breaking.templates.feed], detail: "Primary source in the last 24 hours" },
    { kind: "dt101", label: SERIES.dt101.label, templates: [SERIES.dt101.templates.feed], detail: "Benefit-led card, mission-brief caption" },
    { kind: "icymi", label: "ICYMI roundup", templates: [SERIES.icymi_cover.templates.feed, SERIES.icymi_story.templates.feed], detail: "Cover + five published stories" },
  ],
}
export function propertyCanGenerate(id: string, kind: string): boolean {
  return !!PIPELINE_PROPERTIES.find(p => p.id === id && p.active) && !!PROPERTY_TEMPLATES[id]?.some(t => t.kind === kind)
}
