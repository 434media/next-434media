/**
 * Reading the detail the booking records carry as prose.
 *
 * Airtable holds a connection, a checked-bag allowance, a room type and who the
 * reservation is under inside two free-text fields — `Flight Details Extracted`
 * and `Accommodation Details Extracted` — plus the human `Notes`. There are no
 * columns for them. The itinerary needs them on the card, so they are read out
 * here rather than retyped into the page.
 *
 * **This is a reader, not a source.** Prose parsing is guesswork that happens to
 * work: it depends on whoever wrote the note keeping the same shape, and it
 * fails silently when they don't. Every function here returns an empty string
 * rather than a wrong value, so a card drops a row instead of showing a
 * confident mistake. The durable fix is columns in Airtable for the five facts
 * below; until those exist, this keeps the page honest about what it knows.
 */

/** `Key: value` lines, lowercased keys, in one of the extracted blobs. */
export function extractedPairs(text = ""): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const at = line.indexOf(":")
    if (at <= 0) continue
    const key = line.slice(0, at).trim().toLowerCase()
    const value = line.slice(at + 1).trim()
    if (key && value && !/^information not found/i.test(value)) out[key] = value
  }
  return out
}

/**
 * "Route: LAX to MCW (via ORD, 2 hr 9 min layover in Chicago …)" → "ORD · 2 hr 9 min".
 * A nonstop has no parenthetical, so it returns "" and the row disappears.
 */
export function connectionFrom(extracted = ""): string {
  const route = extractedPairs(extracted)["route"] || ""
  const airport = route.match(/via\s+([A-Z]{3})/)
  const duration = route.match(/(\d+\s*hr(?:\s*\d+\s*min)?|\d+\s*min)\s*layover/i)
  if (!airport) return ""
  return duration ? `${airport[1]} · ${duration[1].replace(/\s+/g, " ")}` : airport[1]
}

/** "Amex Travel booking: ZO-AX1086-71298" in the notes. */
export function amexBookingFrom(notes = ""): string {
  return notes.match(/Amex(?:\s+Travel)?\s+booking:\s*([A-Z0-9-]+)/i)?.[1] ?? ""
}

/** "one checked bag expected" / "no checked bag". Silent when the note says neither. */
export function checkedBagFrom(notes = ""): string {
  if (/no\s+checked\s+bag/i.test(notes)) return "None"
  if (/checked\s+bag[^.]*expected/i.test(notes) || /expected[^.]*checked\s+bag/i.test(notes)) return "Expected"
  return ""
}

/** "Accessible non-smoking king room" → "Accessible king": the part a traveler needs. */
export function roomTypeFrom(extracted = ""): string {
  const raw = extractedPairs(extracted)["room type"] || ""
  if (!raw) return ""
  const trimmed = raw.replace(/\bnon-?smoking\b/gi, "").replace(/\broom\b/gi, "").replace(/\s{2,}/g, " ").trim()
  const short = trimmed.replace(/\s*,\s*$/, "")
  return short.charAt(0).toUpperCase() + short.slice(1)
}

/** Whose name the hotel holds the booking under. */
export function reservationUnderFrom(extracted = ""): string {
  return extractedPairs(extracted)["reservation under"] || ""
}

/** The guest the hotel has authorized to check in, when it is not the booker. */
export function authorizedGuestFrom(extracted = ""): string {
  return extractedPairs(extracted)["authorized guest"] || ""
}
