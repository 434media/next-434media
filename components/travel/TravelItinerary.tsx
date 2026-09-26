"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  BedDouble,
  ChevronRight,
  CircleAlert,
  Film,
  Linkedin,
  MapPin,
  Navigation,
  Phone,
  Plane,
  X,
} from "lucide-react"
import type {
  FlightEvent,
  HotelEvent,
  ShootEvent,
  TravelEvent,
  TravelEventKind,
  TravelItineraryPayload,
} from "@/lib/travel/types"
import { zoneFor, zoneSource } from "@/lib/travel/zones"
import styles from "./travel-itinerary.module.css"

type Filter = "all" | TravelEventKind | "open"

function time(value: string, location = "") {
  if (!value) return "Time pending"
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneFor(location),
    timeZoneName: "short",
  }).format(new Date(value))
}

function shortDate(value: string, location = "") {
  if (!value) return "Date pending"
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = isDateOnly ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: isDateOnly ? "UTC" : zoneFor(location),
  }).format(parsed)
}

function dayParts(date: string) {
  const value = new Date(`${date}T12:00:00Z`)
  return {
    dow: value.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: value.getUTCDate(),
    month: value.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  }
}

/**
 * The hotel names the guest in full; the itinerary calls him what he goes by.
 * Initials would read "AG" for Augusto Garces, which is nobody — so the roster's
 * display name wins when the names match, and an unrecognised guest is shown as
 * the hotel wrote them rather than quietly renamed.
 */
function guestLabel(authorizedGuest: string, traveler: { name: string; displayName: string }) {
  const same = authorizedGuest.trim().toLowerCase() === traveler.name.trim().toLowerCase()
  return same ? traveler.displayName : authorizedGuest
}

function eventStart(event: TravelEvent) {
  if (event.kind === "flight") return event.departureAt
  if (event.kind === "hotel") return event.checkInAt
  return event.startAt
}

function eventTitle(event: TravelEvent) {
  if (event.kind === "flight") return `${event.origin || "Airport"} → ${event.destination || "Destination"}`
  if (event.kind === "hotel") return event.name || "Hotel"
  return event.company
}

function eventSubtitle(event: TravelEvent) {
  if (event.kind === "flight") {
    return [event.carrier, event.flightNumbers, event.arrivalAt ? `arrives ${time(event.arrivalAt, event.destination)}` : ""]
      .filter(Boolean)
      .join(" · ")
  }
  if (event.kind === "hotel") return event.address
  return event.location
}

function mapHref(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`
}

function dayPlace(events: TravelEvent[], dayType: string) {
  const flight = events.find((event): event is FlightEvent => event.kind === "flight")
  if (flight) return `${flight.origin || "Travel"} → ${flight.destination || "Next stop"}`
  const shoot = events.find((event): event is ShootEvent => event.kind === "shoot")
  if (shoot) return shoot.location.split(",").slice(-2, -1)[0]?.trim() || shoot.company
  const hotel = events.find((event): event is HotelEvent => event.kind === "hotel")
  if (hotel) return hotel.name
  return /off/i.test(dayType) ? "Rest / reset" : "Open itinerary"
}

function badge(dayType: string, events: TravelEvent[]) {
  if (/off/i.test(dayType)) return { label: "Home", className: styles.badgeOff }
  const hasShoot = events.some((event) => event.kind === "shoot")
  const hasFlight = events.some((event) => event.kind === "flight")
  if (hasShoot && hasFlight) return { label: "Shoot + travel", className: styles.badgeBoth }
  if (hasShoot) return { label: "Filming", className: styles.badgeShoot }
  return { label: "Travel", className: styles.badgeTravel }
}

function EventIcon({ kind }: { kind: TravelEventKind }) {
  if (kind === "flight") return <Plane aria-hidden />
  if (kind === "hotel") return <BedDouble aria-hidden />
  return <Film aria-hidden />
}

function FlightDetails({ event }: { event: FlightEvent }) {
  return (
    <>
      <div className={styles.detailGrid}>
        <div><span>Departs</span><strong>{event.origin || "Airport pending"} · {time(event.departureAt, event.origin)}</strong></div>
        <div><span>Arrives</span><strong>{event.destination || "Airport pending"} · {time(event.arrivalAt, event.destination)}</strong></div>
        {/* The flight numbers already read in the card's subtitle; the connection does not. */}
        {event.connection && <div><span>Connection</span><strong>{event.connection}</strong></div>}
        {event.confirmation && <div><span>Confirmation</span><strong>{event.confirmation}</strong></div>}
        {(event.amexBooking || event.bookingReference) && <div><span>Amex booking</span><strong>{event.amexBooking || event.bookingReference}</strong></div>}
        {event.checkedBag && <div><span>Checked bag</span><strong>{event.checkedBag}</strong></div>}
      </div>
      {event.notes && <p className={styles.detailNotes}>{event.notes}</p>}
      {event.origin && <div className={styles.actions}><a href={mapHref(`${event.origin} airport`)} target="_blank" rel="noreferrer"><Navigation /> Directions to {event.origin}</a></div>}
    </>
  )
}

function HotelDetails({ event, traveler }: { event: HotelEvent; traveler: { name: string; displayName: string } }) {
  return (
    <>
      <div className={styles.detailGrid}>
        <div><span>Check-in</span><strong>{shortDate(event.checkInAt, event.address)} · {time(event.checkInAt, event.address)}</strong></div>
        <div><span>Check-out</span><strong>{shortDate(event.checkOutAt, event.address)} · {time(event.checkOutAt, event.address)}</strong></div>
        {event.confirmation && <div><span>Confirmation</span><strong>{event.confirmation}</strong></div>}
        {event.roomType && <div><span>Room</span><strong>{event.roomType}</strong></div>}
        {event.reservationUnder && <div><span>Reservation</span><strong>{event.reservationUnder}</strong></div>}
        {event.authorizedGuest && <div><span>Guest status</span><strong>{guestLabel(event.authorizedGuest, traveler)} authorized</strong></div>}
        {event.bookingReference && <div><span>Amex booking</span><strong>{event.bookingReference}</strong></div>}
      </div>
      {event.notes && <p className={styles.detailNotes}>{event.notes}</p>}
      {event.address && <div className={styles.actions}><a href={mapHref(event.address)} target="_blank" rel="noreferrer"><Navigation /> Directions</a></div>}
    </>
  )
}

function ShootDetails({ event, onAddNote }: { event: ShootEvent; onAddNote: (event: ShootEvent) => void }) {
  const directions = event.mapUrl || (event.location ? mapHref(event.location) : "")
  return (
    <>
      <div className={styles.shootMeta}>
        <div className={styles.infoRow}>
          <div><span>Filming location</span><strong>{event.location || "Not confirmed"}</strong></div>
          {directions && <a href={directions} target="_blank" rel="noreferrer"><MapPin /> Directions</a>}
        </div>
        <div className={styles.infoRow}>
          <div><span>POC</span><strong>{event.contactName || "Not confirmed"}</strong></div>
          {event.contactPhone && <a href={phoneHref(event.contactPhone)}><Phone /> Call</a>}
        </div>
      </div>
      <section className={styles.interview}>
        <div className={styles.interviewHead}>
          <div><span>Interview with</span><strong>{event.intervieweeName || "Not confirmed"}</strong></div>
          {event.intervieweeLinkedIn && <a href={event.intervieweeLinkedIn} target="_blank" rel="noreferrer"><Linkedin /> LinkedIn</a>}
        </div>
        {event.questions.length ? (
          <><h4>Interview questions</h4><ol>{event.questions.map((question) => <li key={question}>{question}</li>)}</ol></>
        ) : <p>Interview questions have not been added yet.</p>}
      </section>
      <section className={styles.editorNotes}>
        <div className={styles.editorNotesHead}>
          <strong>Editor notes{event.editorNotes.length ? ` (${event.editorNotes.length})` : ""}</strong>
          <button type="button" onClick={() => onAddNote(event)}>+ Editor note</button>
        </div>
        {event.editorNotes.length ? (
          <div className={styles.editorNoteList}>{event.editorNotes.map((note) => (
            <article key={note.id}><span>{note.author} · {shortDate(note.createdAt)}</span><p>{note.body}</p></article>
          ))}</div>
        ) : <p className={styles.emptyNote}>No notes captured yet.</p>}
      </section>
    </>
  )
}

export default function TravelItinerary({
  initialItinerary,
  project,
  traveler,
}: {
  initialItinerary: TravelItineraryPayload
  project: { client: string; purpose: string; year: number; startDate: string; endDate: string }
  traveler: { name: string; displayName: string; routeStops: Array<{ code: string; city: string; dates: string; home?: boolean }> }
}) {
  const [itinerary, setItinerary] = useState(initialItinerary)
  const [filter, setFilter] = useState<Filter>("all")
  const [activeNote, setActiveNote] = useState<ShootEvent | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const endpoint = `/api/travel/${itinerary.projectSlug}/${itinerary.travelerSlug}`

  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" })
    if (response.ok) setItinerary(await response.json())
  }, [endpoint])

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const allEvents = useMemo(
    () => itinerary.days.flatMap((day) => day.events).sort((a, b) => eventStart(a).localeCompare(eventStart(b))),
    [itinerary],
  )
  const nextEvent = allEvents.find((event) => new Date(eventStart(event)).getTime() > Date.now())
  const nextEventDay = nextEvent
    ? itinerary.days.find((day) => day.events.some((event) => event.id === nextEvent.id))
    : undefined
  const visibleDays = itinerary.days.filter((day) => {
    if (filter === "all") return true
    if (filter === "open") return day.events.length === 0
    return day.events.some((event) => event.kind === filter)
  })

  async function saveNote(event: FormEvent) {
    event.preventDefault()
    if (!activeNote || !note.trim()) return
    setSaving(true)
    setError("")
    const response = await fetch(`${endpoint}/editor-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeId: activeNote.intakeId, company: activeNote.company, note: note.trim() }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      setError(result.error || "The note could not be saved.")
      setSaving(false)
      return
    }
    setActiveNote(null)
    setNote("")
    await refresh()
    setSaving(false)
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.lockup} aria-label="434 Media"><span>434</span><span>MEDIA</span></div>
          <div><strong>{traveler.displayName} Travel</strong><span>{project.client} {project.purpose}</span></div>
        </div>
        <div className={styles.updated}><i />Live from Airtable<br /><strong>{shortDate(itinerary.syncedAt)}</strong></div>
      </header>

      <main>
        <section className={styles.hero}>
          <div>
            <p>{shortDate(project.startDate)}–{shortDate(project.endDate)} · {project.year}</p>
            <h1>Your route,<br />at a glance.</h1>
            <div className={styles.routeLine}>{traveler.routeStops.slice(0, -1).map((stop, index) => <span key={`${stop.code}-${index}`}>{index > 0 && <b>→</b>}{stop.code}</span>)}</div>
          </div>
          <div className={styles.nextCard}>
            <div className={styles.nextLabel}><i />Next up</div>
            {nextEvent ? <>
              <div className={styles.nextTime}>{time(eventStart(nextEvent), zoneSource(nextEvent))}</div>
              <div className={styles.nextDate}>{new Date(eventStart(nextEvent)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: zoneFor(zoneSource(nextEvent)) })}</div>
              <div className={styles.nextTitle}>{eventTitle(nextEvent)}</div>
              <div className={styles.nextRoute}>{eventSubtitle(nextEvent)}</div>
              <div className={styles.quickRow}>
                <a href={`#day-${nextEventDay?.date || eventStart(nextEvent).slice(0, 10)}`}>View day</a>
                <a className={styles.secondary} href={mapHref(nextEvent.kind === "shoot" ? nextEvent.location : nextEvent.kind === "hotel" ? nextEvent.address : `${nextEvent.origin} airport`)} target="_blank" rel="noreferrer">Open map</a>
              </div>
            </> : <><div className={styles.nextTime}>Pending</div><div className={styles.nextTitle}>Final outbound routing</div></>}
          </div>
        </section>

        <aside className={styles.alert}><CircleAlert /><div><strong>Return from SFO is not booked.</strong><span>ATOMS and the final outbound plan remain open for October 9–10.</span></div></aside>

        <section className={styles.routeSection}>
          <div className={styles.sectionHead}><h2>Trip route</h2><p>Swipe to scan</p></div>
          <div className={styles.routeMap}>{traveler.routeStops.map((stop, index) => (
            <div className={styles.stop} key={`${stop.code}-${index}`}><div className={stop.home ? styles.homeDot : styles.stopDot}>{stop.code}</div><strong>{stop.city}</strong><span>{stop.dates}</span></div>
          ))}</div>
        </section>

        <nav className={styles.filters} aria-label="Filter itinerary">
          {(["all", "flight", "shoot", "hotel", "open"] as Filter[]).map((value) => (
            <button key={value} type="button" className={filter === value ? styles.activeFilter : ""} onClick={() => setFilter(value)} aria-pressed={filter === value}>
              {value === "all" ? "All" : value === "flight" ? "Flights" : value === "shoot" ? "Filming" : value === "hotel" ? "Hotels" : "Open items"}
            </button>
          ))}
        </nav>

        <section className={styles.timeline} aria-label="Full itinerary">
          {visibleDays.map((day) => {
            const parts = dayParts(day.date)
            const dayBadge = badge(day.dayType, day.events)
            const events = filter === "all" || filter === "open" ? day.events : day.events.filter((event) => event.kind === filter)
            return <article className={styles.day} id={`day-${day.date}`} key={day.id}>
              <div className={styles.datebox}><span>{parts.dow}</span><strong>{parts.day}</strong><span>{parts.month}</span></div>
              <div className={styles.dayContent}>
                <div className={styles.dayTop}><h3>{dayPlace(day.events, day.dayType)}</h3><span className={`${styles.badge} ${dayBadge.className}`}>{dayBadge.label}</span></div>
                {events.length ? events.sort((a, b) => eventStart(a).localeCompare(eventStart(b))).map((event) => (
                  <article className={styles.event} key={`${day.id}-${event.kind}-${event.id}`}>
                    <div className={styles.eventIcon}><EventIcon kind={event.kind} /></div>
                    <div className={styles.eventMain}>
                      <div className={styles.eventTime}>{event.kind === "hotel" ? `Check-in ${time(event.checkInAt, event.address)}` : time(eventStart(event), zoneSource(event))}</div>
                      <h4>{eventTitle(event)}</h4>
                      <p>{eventSubtitle(event)}</p>
                      <details><summary>{event.kind === "shoot" ? "Filming details & questions" : event.kind === "flight" ? "Flight details" : "Hotel details"}<ChevronRight /></summary><div className={styles.detailsBody}>{event.kind === "flight" ? <FlightDetails event={event} /> : event.kind === "hotel" ? <HotelDetails event={event} traveler={traveler} /> : <ShootDetails event={event} onAddNote={setActiveNote} />}</div></details>
                    </div>
                  </article>
                )) : <p className={styles.offCopy}>{/off/i.test(day.dayType) ? "Rest and reset at home." : "This day remains open."}</p>}
              </div>
            </article>
          })}
        </section>
      </main>

      <footer className={styles.footer}><div className={styles.footerLockup}><span>434</span><span>MEDIA</span></div><p>Protected production itinerary · Updates sync from Airtable</p></footer>

      {activeNote && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveNote(null) }}>
        <form className={styles.noteModal} onSubmit={saveNote}>
          <button className={styles.close} type="button" onClick={() => setActiveNote(null)} aria-label="Close"><X /></button>
          <h2>Add editor note</h2><p>{activeNote.company} · saved to the production record</p>
          <label htmlFor="editor-note">Note</label>
          <textarea id="editor-note" value={note} onChange={(event) => setNote(event.target.value)} autoFocus required />
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.modalActions}><button type="button" onClick={() => setActiveNote(null)}>Cancel</button><button className={styles.save} disabled={saving}>{saving ? "Saving…" : "Save note"}</button></div>
        </form>
      </div>}
    </div>
  )
}
