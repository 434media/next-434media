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
