import type { Brand, ContentProperty } from "@/components/crm/types"
import type { LeadPlatform } from "@/types/crm-types"
import { loadProfile, profileProblems, type RequestKind } from "./profile"

/**
 * The properties the Generate panel offers (the CRM roster; the UI word is "Property", the code keeps "brand" and
 * "platform"). Only MilCityUSA has templates and editorial rules connected, so it is the only one that can be
 * chosen; generating for the others is not in Phase 1. `id` is what a job stores: the publisher's brand id where
 * one exists ("milcity", as content posts already carry in intake.metaBrand and tags). `roster` names the existing
 * identifier in code (LeadPlatform for four of them, the CRM Brand for Digital Canvas); nothing is renamed.
 * `contentProperty` is the value a draft's content post stores in `platform`, which the drawer shows as its Property
 * (the -05 draft of 2026-10-17 had it empty).
 */
export interface PipelineProperty { id: string; label: string; roster: LeadPlatform | Brand; contentProperty: ContentProperty; active: boolean; reason?: string }
const NOT_YET = "No templates connected yet"
export const PIPELINE_PROPERTIES: readonly PipelineProperty[] = [
  { id: "milcity", label: "MilCityUSA", roster: "MilCity", contentProperty: "MilCityUSA", active: true },
  { id: "txmx", label: "TXMX Boxing", roster: "TXMX", contentProperty: "TXMX Boxing", active: false, reason: NOT_YET },
  { id: "vemos", label: "VemosVamos", roster: "VemosVamos", contentProperty: "Vemos Vamos", active: false, reason: NOT_YET },
  { id: "devsa", label: "DEVSA", roster: "DevSA", contentProperty: "DEVSA", active: false, reason: NOT_YET },
  { id: "digital-canvas", label: "Digital Canvas", roster: "Digital Canvas", contentProperty: "Digital Canvas", active: false, reason: NOT_YET },
]
export const DEFAULT_PROPERTY = "milcity"
/** The content post's Property for a job's property id; jobs from before the field were MilCityUSA. */
export function contentPropertyOf(id: string | undefined): ContentProperty {
  return (PIPELINE_PROPERTIES.find(p => p.id === (id ?? DEFAULT_PROPERTY)) ?? PIPELINE_PROPERTIES[0]).contentProperty
}

/**
 * What a property's templates generate: the request kinds in its brand profile, with the brand templates (feed) each
 * fills. A property whose profile is missing or fails validation generates nothing, so Generate never offers it.
 */
export interface PipelineTemplate { kind: RequestKind; label: string; templates: string[]; detail: string }
export const PROPERTY_TEMPLATES: Record<string, readonly PipelineTemplate[]> = Object.fromEntries(PIPELINE_PROPERTIES.filter(p => !profileProblems(p.id).length).map(p => {
  const b = loadProfile(p.id)
  return [p.id, b.requestKinds.map(k => ({ kind: k.kind, label: k.label, templates: k.series.map(s => b.series[s]!.templates.feed), detail: k.detail }))]
}))
export function propertyCanGenerate(id: string, kind: string): boolean {
  return !!PIPELINE_PROPERTIES.find(p => p.id === id && p.active) && !!PROPERTY_TEMPLATES[id]?.some(t => t.kind === kind)
}
