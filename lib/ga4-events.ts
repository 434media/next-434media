/**
 * Business-event wrappers around GA4 Measurement Protocol.
 *
 * Every CRM-side mutation that maps to a marketing event should call one of
 * these — keeping the event names + param shapes in one place ensures the
 * GA4 reports stay consistent over time.
 *
 * Event-naming convention: snake_case, verb-first, past-tense for state
 * transitions. Match the names used by gtag.js on the public sites so a
 * single GA4 funnel definition works whether the event came from browser
 * or server.
 */

import {
  clientIdFromEmail,
  sendMeasurementProtocolEvents,
} from "./ga4-measurement-protocol"
import type { Lead, LeadPlatform } from "../types/crm-types"

/**
 * Map our internal `LeadPlatform` value to the env-var suffix we'd use for
 * routing the event to the matching GA4 property. Defaults to "MAIN" for
 * unmapped platforms — those still get tracked, just on the main property.
 */
function platformToPropertyKey(platform?: LeadPlatform): string {
  switch (platform) {
    case "TXMX":
      return "TXMX"
    case "VemosVamos":
      return "VEMOSVAMOS"
    case "DevSA":
      // No DevSA GA4 property exists yet (analytics-config has the others);
      // route to main until/unless that property gets configured.
      return "MAIN"
    case "MilCity":
      // No MilCity GA4 property exists yet; route to main.
      return "MAIN"
    case "434 Media":
    default:
      return "MAIN"
  }
}

/**
 * Fire when a public form fans into the leads collection. The contact-form
 * and email-signup capture helpers both call this.
 */
export async function trackLeadCapture(
  lead: Pick<Lead, "email" | "source" | "platform" | "company" | "score">,
): Promise<void> {
  await sendMeasurementProtocolEvents(
    {
      client_id: clientIdFromEmail(lead.email),
      events: [
        {
          name: "lead_capture",
          params: {
            source: lead.source,
            platform: lead.platform || "unknown",
            // GA4 conventions: short_string params, no PII. Don't push email/name.
            company_present: !!lead.company,
            initial_score: lead.score ?? 0,
            engagement_time_msec: 1, // GA4 wants this >0 to register the event
          },
        },
      ],
    },
    { propertyKey: platformToPropertyKey(lead.platform) },
  )
}

/**
 * Fire when a lead's status flips to `engaged` — the BD team has had a
 * meaningful back-and-forth, not just sent an outbound. Marks the lead
 * as a marketing-qualified-lead equivalent for funnel reporting.
 */
export async function trackLeadQualified(
  lead: Pick<Lead, "email" | "platform" | "score" | "source">,
): Promise<void> {
  await sendMeasurementProtocolEvents(
    {
      client_id: clientIdFromEmail(lead.email),
      events: [
        {
          name: "lead_qualified",
          params: {
            source: lead.source,
            platform: lead.platform || "unknown",
            score: lead.score ?? 0,
            engagement_time_msec: 1,
          },
        },
      ],
    },
    { propertyKey: platformToPropertyKey(lead.platform) },
  )
}

/**
 * Fire when a lead is converted into a crm_clients record. Highest-value
 * funnel event — this is the conversion the BD team actually celebrates.
 */
export async function trackLeadConverted(
  lead: Pick<Lead, "email" | "platform" | "score" | "source">,
  newClientId: string,
): Promise<void> {
  await sendMeasurementProtocolEvents(
    {
      client_id: clientIdFromEmail(lead.email),
      events: [
        {
          name: "lead_converted",
          params: {
            source: lead.source,
            platform: lead.platform || "unknown",
            score: lead.score ?? 0,
            client_id_value: newClientId,
            engagement_time_msec: 1,
          },
        },
      ],
    },
    { propertyKey: platformToPropertyKey(lead.platform) },
  )
}

/**
 * Fire when a CRM opportunity flips to `closed_won`. This is the only event
 * carrying a real dollar value, so it's the one that powers revenue
 * attribution back to the original acquisition source in GA4.
 */
export async function trackOpportunityWon(args: {
  /** Email of the primary contact, used as the join key. */
  email?: string
  /** Brand the opportunity was attributed to. */
  brand?: string
  /** Closed-won dollar value. */
  value: number
  /** crm_clients id, for backreference in BigQuery export. */
  clientId: string
}): Promise<void> {
  if (!args.email) return // No client_id without an email; skip silently.
  await sendMeasurementProtocolEvents(
    {
      client_id: clientIdFromEmail(args.email),
      events: [
        {
          name: "opportunity_won",
          params: {
            currency: "USD",
            value: args.value,
            brand: args.brand || "unknown",
            client_id_value: args.clientId,
            engagement_time_msec: 1,
          },
        },
      ],
    },
    // Brand → property key mapping. Closed-won opportunities likely came
    // from many sources; we route to the main property and let the brand
    // param drive segmentation inside GA4.
    { propertyKey: "MAIN" },
  )
}
