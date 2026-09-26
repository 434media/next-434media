import "server-only"
import { airportCodes, pegWallClock, zoneFor } from "./zones"
import {
  amexBookingFrom,
  authorizedGuestFrom,
  checkedBagFrom,
  connectionFrom,
  reservationUnderFrom,
  roomTypeFrom,
} from "./extracted"
import type {
  EditorNote,
  FlightEvent,
  HotelEvent,
  ShootEvent,
  TravelDay,
  TravelItineraryPayload,
} from "./types"

const TABLES = {
  itinerary: "tblMSrVnx87rZVTPN",
  flights: "tblDJIwePq9yDaQVe",
  hotels: "tbl51ncH5qzCwd0Ci",
  intake: "tbloTg54xyJmdYaNK",
  editorNotes: "tblFvvax2YwFO2GfV",
} as const

const FIELDS = {
  itinerary: {
    date: "fldhu3fLCZkZEG8P1",
    dayType: "fld3qSf3LzLli0dZa",
    flights: "fldarhMNcFdueMB0e",
    hotels: "fldsSpIQzAx9jx6ss",
    shoots: "fldfBHClceTSCqB1O",
  },
  flight: {
    departureAt: "fldTpbWJZjYDb6Bqa",
    arrivalAt: "fldVYBj6WLdJKbZQX",
    carrier: "fldm3CIjIHVWpDQZJ",
    number: "fldyKUlhRST1m1LPn",
    origin: "fldWulQmovZQ2UbqI",
    destination: "fld8coUHfJJ4DOg8A",
    confirmation: "fldQZzGXvE4MhWdy0",
    extracted: "flddieN6k1X0zzshf",
    notes: "fldQiTRSWyFCs2vyc",
  },
  hotel: {
    checkInAt: "fldSGr5831wQiBWT6",
    checkOutAt: "fldbPFFyob9CpeIty",
    name: "fldlvU8NULg5Y0VR1",
    address: "fldlHHBynkurW9IDX",
    confirmation: "fldNqqSWLlGL4Xn4l",
    extracted: "fldOos3nmscwTzMZK",
    notes: "fldiAyxlcy5Gl5Ffg",
  },
  intake: {
    company: "fld920NHq0tlZox5g",
    contactName: "fldhbPK8Vw78Y3Qfh",
    contactPhone: "fldaLXzZDDsqQoIun",
    startAt: "fldQRPZjjVYdbPfYM",
    endAt: "fldO0HB7sZWW0LAsA",
    location: "fldbYceAB5i67dAFY",
    mapUrl: "fldABxy7kzZC6ewIg",
    questions: "fldIcr2wOzMcSefNy",
    intervieweeName: "fldAE8NPRhHxR4bj8",
    intervieweeLinkedIn: "flddPW9jsoj2gCIQH",
  },
  editorNote: {
    body: "fldpvU2jEiXmD8kz8",
    author: "fldSEebAXbur65QiP",
    intake: "fldKmNpzp1BcKrUtd",
    createdAt: "fldImX5ty7CwNMvEW",
  },
} as const

interface AirtableRecord {
  id: string
  createdTime: string
  fields: Record<string, unknown>
}

function textValue(value: unknown): string {
  if (value == null) return ""
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(" · ")
  if (typeof value === "object") {
    const object = value as Record<string, unknown>
    if (object.state === "error") return ""
    return textValue(object.value ?? object.name ?? object.text ?? "")
  }
  return String(value).trim()
}

function linkedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item : textValue((item as { id?: unknown })?.id)))
    .filter((id): id is string => /^rec[A-Za-z0-9]{14}$/.test(id))
}

function questionsFrom(value: unknown, interviewee: string): string[] {
  const raw = textValue(value)
  const questions = raw
    .split(/\n+/)
    .map((item) => item.replace(/^\s*(?:\d+[.)]|[-•])\s*/, "").trim())
    .filter(Boolean)
  if (questions[0]?.localeCompare(interviewee, undefined, { sensitivity: "base" }) === 0) {
    questions.shift()
  }
  return questions
}

function match(text: string, expression: RegExp) {
  return text.match(expression)?.[1]?.trim() || ""
}

function routeFromNotes(notes: string) {
  const legs = [...notes.matchAll(/\b([A-Z]{3})\s+\d{1,2}:\d{2}\s+[AP]M\s+\w+\s*→\s*([A-Z]{3})/g)]
  return {
    origin: legs[0]?.[1] || "",
    destination: legs.at(-1)?.[2] || "",
  }
}

function flightFrom(record: AirtableRecord): FlightEvent {
  const values = record.fields
  const extracted = textValue(values[FIELDS.flight.extracted])
  const notes = textValue(values[FIELDS.flight.notes]) || extracted
  const route = routeFromNotes(notes)
  const flightNumbers = [...new Set(notes.match(/\b[A-Z]{2}\d{3,4}\b/g) || [])].join(" + ")
  const originText = textValue(values[FIELDS.flight.origin])
  const destinationText = textValue(values[FIELDS.flight.destination])
  // Prefer codes named in the city fields; when a record writes cities instead
  // ("Los Angeles" / "Mason City (serving Osage, IA)"), the booking note spells
  // the routing out, so read the codes from there rather than guessing.
  const fieldCodes = [...airportCodes(originText), ...airportCodes(destinationText)]
  const legCodes = fieldCodes.length > 1 ? fieldCodes : airportCodes(notes)
  const originCode = legCodes[0] ?? ""
  const destinationCode = legCodes.length > 1 ? legCodes[legCodes.length - 1] : ""
  // A code appearing between the ends is where the traveler changes planes.
  const viaCode = legCodes.slice(1, -1).find((code) => code !== originCode && code !== destinationCode) ?? ""
  return {
    id: record.id,
    kind: "flight",
    departureAt: textValue(values[FIELDS.flight.departureAt]),
    arrivalAt: textValue(values[FIELDS.flight.arrivalAt]),
    // One record holds a whole routing string where a city belongs
    // ("MCW 7:00 PM CT → ORD 8:32 PM CT."). Read the codes out of whatever
    // arrives: the first is where the leg starts, the last is where it ends.
    origin: originCode || textValue(values[FIELDS.flight.origin]) || route.origin,
    destination: destinationCode || textValue(values[FIELDS.flight.destination]) || route.destination,
    carrier: textValue(values[FIELDS.flight.carrier]) || match(notes, /Traveler:[^.]+\.\s*([^.,]+?)\s+[A-Z]{2}\d/),
    flightNumbers: textValue(values[FIELDS.flight.number]) || flightNumbers,
    confirmation:
      textValue(values[FIELDS.flight.confirmation]) ||
      match(notes, /(?:Airline\s+)?confirmation:\s*([A-Z0-9]+)/i),
    bookingReference: match(notes, /Amex Travel booking:\s*([^.;]+)/i),
    connection: connectionFrom(extracted) || viaCode,
    amexBooking: amexBookingFrom(notes),
    checkedBag: checkedBagFrom(notes),
    notes,
  }
}

function hotelFrom(record: AirtableRecord): HotelEvent {
  const values = record.fields
  const extracted = textValue(values[FIELDS.hotel.extracted])
  const notes = textValue(values[FIELDS.hotel.notes]) || extracted
  const lead = notes.replace(/^(?:BOOKED(?:\/PAID)?\.?\s*)/i, "")
  const chunks = lead.split(",").map((item) => item.trim())
  const name = textValue(values[FIELDS.hotel.name]) || chunks[0] || "Hotel"
  const address = textValue(values[FIELDS.hotel.address]) || chunks.slice(1, 5).join(", ").split(".")[0]
  return {
    id: record.id,
    kind: "hotel",
    checkInAt: textValue(values[FIELDS.hotel.checkInAt]),
    checkOutAt: textValue(values[FIELDS.hotel.checkOutAt]),
    name,
    address,
    confirmation:
      textValue(values[FIELDS.hotel.confirmation]) ||
      match(notes, /(?:Hotel confirmation|Hotels\.com itinerary):\s*([A-Z0-9-]+)/i),
    bookingReference: match(notes, /Amex Travel booking:\s*([^.;]+)/i),
    roomType: roomTypeFrom(extracted),
    reservationUnder: reservationUnderFrom(extracted),
    authorizedGuest: authorizedGuestFrom(extracted),
    notes,
  }
}

function shootFrom(record: AirtableRecord, notes: EditorNote[]): ShootEvent {
  const values = record.fields
  const intervieweeName = textValue(values[FIELDS.intake.intervieweeName])
  const shootLocation = textValue(values[FIELDS.intake.location])
  const shootZone = zoneFor(shootLocation)
  return {
    id: record.id,
    intakeId: record.id,
    kind: "shoot",
    company: textValue(values[FIELDS.intake.company]) || "Filming",
    // A shoot time is the call time at the filming location, not an instant.
    // See lib/travel/zones.ts for why Airtable cannot store it that way.
    startAt: pegWallClock(textValue(values[FIELDS.intake.startAt]), shootZone),
    endAt: pegWallClock(textValue(values[FIELDS.intake.endAt]), shootZone),
    location: shootLocation,
    mapUrl: textValue(values[FIELDS.intake.mapUrl]),
    contactName: textValue(values[FIELDS.intake.contactName]),
    contactPhone: textValue(values[FIELDS.intake.contactPhone]),
    intervieweeName,
    intervieweeLinkedIn: textValue(values[FIELDS.intake.intervieweeLinkedIn]),
    questions: questionsFrom(values[FIELDS.intake.questions], intervieweeName),
    editorNotes: notes,
  }
}

async function fetchTable(baseId: string, tableId: string, fieldIds: string[]) {
  const token = process.env.AIRTABLE_TOKEN
  if (!token) throw new Error("AIRTABLE_TOKEN is not configured")
  const records: AirtableRecord[] = []
  let offset = ""
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`)
    url.searchParams.set("pageSize", "100")
    url.searchParams.set("returnFieldsByFieldId", "true")
    fieldIds.forEach((fieldId) => url.searchParams.append("fields[]", fieldId))
    if (offset) url.searchParams.set("offset", offset)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "434-media-travel/1.0" },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`Airtable ${tableId} returned ${response.status}`)
    const data = (await response.json()) as { records?: AirtableRecord[]; offset?: string }
    records.push(...(data.records || []))
    offset = data.offset || ""
  } while (offset)
  return records
}

export async function getTravelItinerary({
  baseId,
  projectSlug,
  travelerSlug,
  startDate,
  endDate,
}: {
  baseId: string
  projectSlug: string
  travelerSlug: string
  startDate: string
  endDate: string
}): Promise<TravelItineraryPayload> {
  const [itinerary, flights, hotels, intake, editorNotes] = await Promise.all([
    fetchTable(baseId, TABLES.itinerary, Object.values(FIELDS.itinerary)),
    fetchTable(baseId, TABLES.flights, Object.values(FIELDS.flight)),
    fetchTable(baseId, TABLES.hotels, Object.values(FIELDS.hotel)),
    fetchTable(baseId, TABLES.intake, Object.values(FIELDS.intake)),
    fetchTable(baseId, TABLES.editorNotes, Object.values(FIELDS.editorNote)),
  ])

  const flightById = new Map(flights.map((record) => [record.id, flightFrom(record)]))
  const hotelById = new Map(hotels.map((record) => [record.id, hotelFrom(record)]))
  const notesByIntake = new Map<string, EditorNote[]>()
  for (const record of editorNotes) {
    const values = record.fields
    for (const intakeId of linkedIds(values[FIELDS.editorNote.intake])) {
      const list = notesByIntake.get(intakeId) || []
      list.push({
        id: record.id,
        body: textValue(values[FIELDS.editorNote.body]),
        author: textValue(values[FIELDS.editorNote.author]) || "AJ",
        createdAt: textValue(values[FIELDS.editorNote.createdAt]) || record.createdTime,
      })
      notesByIntake.set(intakeId, list)
    }
  }
  const shootById = new Map(
    intake.map((record) => [record.id, shootFrom(record, notesByIntake.get(record.id) || [])]),
  )

  const days: TravelDay[] = itinerary
    .map((record) => {
      const values = record.fields
      const date = textValue(values[FIELDS.itinerary.date]).slice(0, 10)
      const events = [
        ...linkedIds(values[FIELDS.itinerary.shoots]).map((id) => shootById.get(id)),
        ...linkedIds(values[FIELDS.itinerary.flights]).map((id) => flightById.get(id)),
        ...linkedIds(values[FIELDS.itinerary.hotels]).map((id) => hotelById.get(id)),
      ].filter((event): event is NonNullable<typeof event> => Boolean(event))
      return {
        id: record.id,
        date,
        dayType: textValue(values[FIELDS.itinerary.dayType]),
        events,
      }
    })
    .filter((day) => day.date >= startDate && day.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  return { projectSlug, travelerSlug, syncedAt: new Date().toISOString(), days }
}

export async function createEditorNote({
  baseId,
  intakeId,
  company,
  note,
  author,
}: {
  baseId: string
  intakeId: string
  company: string
  note: string
  author: string
}) {
  const token = process.env.AIRTABLE_TOKEN
  if (!token) throw new Error("AIRTABLE_TOKEN is not configured")
  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${TABLES.editorNotes}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "434-media-travel/1.0",
    },
    body: JSON.stringify({
      records: [
        {
          fields: {
            fldFcmROnvfEnJGFW: `${company} — ${new Date().toISOString()}`,
            [FIELDS.editorNote.body]: note,
            [FIELDS.editorNote.author]: author,
            [FIELDS.editorNote.intake]: [intakeId],
          },
        },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Airtable editor-note write returned ${response.status}`)
  return response.json()
}
