export type TravelEventKind = "flight" | "hotel" | "shoot"

export interface EditorNote {
  id: string
  body: string
  author: string
  createdAt: string
}

export interface FlightEvent {
  id: string
  kind: "flight"
  departureAt: string
  arrivalAt: string
  origin: string
  destination: string
  carrier: string
  flightNumbers: string
  confirmation: string
  bookingReference: string
  /** "ORD · 2 hr 9 min", read from the extracted route. Empty on a nonstop. */
  connection: string
  /** The Amex Travel record locator, which is not the airline confirmation. */
  amexBooking: string
  /** "Expected" or "None"; empty when the booking note says neither. */
  checkedBag: string
  notes: string
}

export interface HotelEvent {
  id: string
  kind: "hotel"
  checkInAt: string
  checkOutAt: string
  name: string
  address: string
  confirmation: string
  bookingReference: string
  /** "Accessible king" — the part of the room type a traveler needs. */
  roomType: string
  /** Whose name the reservation is held under. */
  reservationUnder: string
  /** The guest the hotel authorized to check in, when it is not the booker. */
  authorizedGuest: string
  notes: string
}

export interface ShootEvent {
  id: string
  intakeId: string
  kind: "shoot"
  company: string
  startAt: string
  endAt: string
  location: string
  mapUrl: string
  contactName: string
  contactPhone: string
  intervieweeName: string
  intervieweeLinkedIn: string
  questions: string[]
  editorNotes: EditorNote[]
}

export type TravelEvent = FlightEvent | HotelEvent | ShootEvent

export interface TravelDay {
  id: string
  date: string
  dayType: string
  events: TravelEvent[]
}

export interface TravelItineraryPayload {
  projectSlug: string
  travelerSlug: string
  syncedAt: string
  days: TravelDay[]
}
