import Airtable from "airtable"
import type { Event } from "../types/event-types"

// Initialize Airtable base for Events
const airtableEventsBaseId = process.env.AIRTABLE_EVENTS_BASE_ID
const airtableEventsApiKey = process.env.AIRTABLE_EVENTS_API_KEY

if (!airtableEventsBaseId || !airtableEventsApiKey) {
  throw new Error("Airtable Events configuration is missing. Please set AIRTABLE_EVENTS_BASE_ID and AIRTABLE_EVENTS_API_KEY")
}

const eventsBase = new Airtable({ apiKey: airtableEventsApiKey }).base(airtableEventsBaseId)

// Map Airtable record to Event interface
function mapAirtableToEvent(record: any): Event {
  const fields = record.fields
  

  
  // Handle image field - could be URL string or Airtable attachment array
  let imageUrl: string | undefined = undefined
  
  // Check for "Event Image" field (attachment type) - this is the correct field name
  if (fields["Event Image"]) {
    if (Array.isArray(fields["Event Image"]) && fields["Event Image"].length > 0) {
      const attachment = fields["Event Image"][0]
      imageUrl = attachment.url || attachment.thumbnails?.large?.url || attachment.thumbnails?.small?.url
    }
  }
  
  // Check for "Image URL" field (text field) as fallback
  if (!imageUrl && fields["Image URL"]) {
    if (typeof fields["Image URL"] === "string") {
      imageUrl = fields["Image URL"]
    } else if (Array.isArray(fields["Image URL"]) && fields["Image URL"].length > 0) {
      imageUrl = fields["Image URL"][0].url || fields["Image URL"][0].thumbnails?.large?.url
    }
  }
  
  // Check for "Image" field (attachment type) as fallback
  if (!imageUrl && fields.Image) {
    if (Array.isArray(fields.Image) && fields.Image.length > 0) {
      const attachment = fields.Image[0]
      imageUrl = attachment.url || attachment.thumbnails?.large?.url || attachment.thumbnails?.small?.url
    }
  }
  
  return {
    id: record.id,
    title: fields.Title || "",
    description: fields.Description || undefined,
    date: fields.Date || "",
    time: fields.Time || undefined,
    location: fields.Location || undefined,
    organizer: fields.Organizer || undefined,
    image: imageUrl,
    url: fields["Event URL"] || undefined,
    tags: fields.Tags || undefined,
    isPast: fields["Is Past"] || false,
    created_at: record._createdTime,
    updated_at: fields["Last Modified"] || record._createdTime,
    // Map legacy fields for compatibility
    category: "other" as const,
    source: "manual" as const,
    attendees: undefined,
    price: undefined,
  }
}

// Map Event interface to Airtable fields
function mapEventToAirtable(event: Omit<Event, "id" | "created_at" | "updated_at">): any {
  return {
    Title: event.title,
    Description: event.description || "",
    Date: event.date,
    Time: event.time || "",
    Location: event.location || "",
    Organizer: event.organizer || "",
    // Note: "Event Image" is an attachment field, can't be set via API with URLs
    // Use "Image URL" for text-based image URLs if needed
    "Image URL": event.image || "",
    "Event URL": event.url || "",
    Tags: event.tags || "",
    "Is Past": event.isPast || false,
  }
}

// Get all events from Airtable
export async function getEventsFromAirtable(): Promise<Event[]> {
  try {
    const records = await eventsBase("Events")
      .select({
        sort: [{ field: "Date", direction: "asc" }],
      })
      .all()

    return records.map(mapAirtableToEvent)
  } catch (error) {
    console.error("Error fetching events from Airtable:", error)
    throw new Error("Failed to fetch events from Airtable")
  }
}

// Create a new event in Airtable
export async function createEventInAirtable(eventData: Omit<Event, "id" | "created_at" | "updated_at">): Promise<Event> {
  try {
    const airtableData = mapEventToAirtable(eventData)
    
    const records = await eventsBase("Events").create([
      {
        fields: airtableData,
      },
    ])

    if (records.length === 0) {
      throw new Error("No records created")
    }

    return mapAirtableToEvent(records[0])
  } catch (error) {
    console.error("Error creating event in Airtable:", error)
    throw new Error("Failed to create event in Airtable")
  }
}

// Update an event in Airtable
export async function updateEventInAirtable(id: string, updates: Partial<Event>): Promise<Event> {
  try {
    const airtableUpdates = mapEventToAirtable(updates as any)
    
    // Remove undefined values and ensure proper types for Airtable
    const cleanUpdates: any = {}
    for (const [key, value] of Object.entries(airtableUpdates)) {
      if (value !== undefined && value !== null && value !== "") {
        cleanUpdates[key] = value
      }
    }

    const records = await eventsBase("Events").update([
      {
        id,
        fields: cleanUpdates,
      },
    ])

    if (!records || records.length === 0) {
      throw new Error("No records updated")
    }

    return mapAirtableToEvent(records[0])
  } catch (error) {
    console.error("Error updating event in Airtable:", error)
    throw new Error("Failed to update event in Airtable")
  }
}

// Delete an event from Airtable
export async function deleteEventFromAirtable(id: string): Promise<void> {
  try {
    await eventsBase("Events").destroy([id])
  } catch (error) {
    console.error("Error deleting event from Airtable:", error)
    throw new Error("Failed to delete event from Airtable")
  }
}

// Get a specific event by ID from Airtable
export async function getEventByIdFromAirtable(id: string): Promise<Event | null> {
  try {
    const record = await eventsBase("Events").find(id)
    return mapAirtableToEvent(record)
  } catch (error) {
    console.error("Error fetching event by ID from Airtable:", error)
    return null
  }
}

// Mark past events automatically
export async function markPastEvents(): Promise<number> {
  try {
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD format
    
    // Get events that should be marked as past
    const records = await eventsBase("Events")
      .select({
        filterByFormula: `AND({Date} < "${today}", {Is Past} = FALSE())`,
      })
      .all()

    if (records.length === 0) {
      return 0
    }

    // Update records to mark as past
    const updates = records.map((record) => ({
      id: record.id,
      fields: {
        "Is Past": true,
      },
    }))

    await eventsBase("Events").update(updates)
    return records.length
  } catch (error) {
    console.error("Error marking past events:", error)
    throw new Error("Failed to mark past events")
  }
}

// Test Airtable connection
export async function testAirtableConnection(): Promise<boolean> {
  try {
    await eventsBase("Events")
      .select({ maxRecords: 1 })
      .firstPage()
    return true
  } catch (error) {
    console.error("Airtable connection test failed:", error)
    return false
  }
}