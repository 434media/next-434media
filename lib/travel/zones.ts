/**
 * Time zones for the travel surface.
 *
 * Two kinds of time live in this itinerary and they are not the same kind of fact:
 *
 *   A flight or hotel time is an *instant*. "LAX 8:15 AM PT" is a moment that
 *   exists independently of where anyone reads it, and Airtable stores it
 *   correctly as one.
 *
 *   A shoot time is a *wall clock at the filming location*. When a producer
 *   writes "10:00 AM" for NeuroFlow they mean ten in the morning in
 *   Philadelphia, not an instant that happens to be ten somewhere else.
 *
 * Airtable stores both as instants. A date field without "use the same time
 * zone for all collaborators" reads what is typed in the *editor's* browser
 * zone, so a producer in Central typing 10:00 for a Philadelphia shoot stores
 * 15:00Z, which renders as 11:00 AM Eastern. The shoot then reads an hour late
 * on the page and nothing about the record looks wrong.
 *
 * `pegWallClock` converts the second kind to the first: it reads the wall clock
 * the producer typed and rebuilds the instant that shows that same wall clock at
 * the filming location.
 *
 * ENTRY_ZONE is the zone the typed value is interpreted in. Lock the Airtable
 * field to this zone ("use the same time zone for all collaborators") so the
 * meaning does not change with whoever opens the base.
 */

import type { TravelEvent } from "./types"

export const ENTRY_ZONE = "America/Chicago"

export function zoneFor(value = "") {
  if (/MCW|ORD|Osage|Iowa|Mason City/i.test(value)) return "America/Chicago"
  if (/EWR|JFK|LGA|NYC|New York|PHL|Philadelphia/i.test(value)) return "America/New_York"
  return "America/Los_Angeles"
}

/**
 * The string a zone is read from must name a place. A flight's subtitle is its
 * carrier and flight numbers, which matches no city and falls through to the
 * default — so a Central departure printed as PDT.
 */
export function zoneSource(event: TravelEvent) {
  if (event.kind === "flight") return event.origin
  if (event.kind === "hotel") return event.address
  return event.location
}

type Parts = { y: number; m: number; d: number; hh: number; mm: number; ss: number }

function partsIn(date: Date, timeZone: string): Parts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => Number(formatted.find((part) => part.type === type)?.value ?? "0")
  const hour = get("hour")
  return { y: get("year"), m: get("month"), d: get("day"), hh: hour === 24 ? 0 : hour, mm: get("minute"), ss: get("second") }
}

/** How far the zone is from UTC at that instant, in milliseconds. */
function offsetAt(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone)
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Read the wall clock of `iso` in `fromZone`, and return the instant that shows
 * that same wall clock in `toZone`. Returns the input unchanged when it is empty
 * or unparseable, so a missing time stays missing rather than becoming a wrong one.
 */
export function pegWallClock(iso: string, toZone: string, fromZone: string = ENTRY_ZONE) {
  if (!iso) return iso
  const source = new Date(iso)
  if (Number.isNaN(source.getTime())) return iso

  const wall = partsIn(source, fromZone)
  const asIfUtc = Date.UTC(wall.y, wall.m - 1, wall.d, wall.hh, wall.mm, wall.ss)

  // One refinement pass: the first guess can land on the wrong side of a DST
  // change, and re-reading the offset at the guessed instant corrects it.
  let instant = asIfUtc - offsetAt(new Date(asIfUtc), toZone)
  instant = asIfUtc - offsetAt(new Date(instant), toZone)
  return new Date(instant).toISOString()
}
