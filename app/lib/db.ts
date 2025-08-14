import { Pool } from "pg"
import type { Event } from "../types/event-types"
// Bring in lead table init lazily to avoid circular import
import { initLeadTable } from "./lead-db"

// Configure pg to return DATE columns as strings instead of Date objects
// This prevents timezone conversion issues
import { types } from "pg"

// Set the parser for DATE type (OID 1082) to return raw string
types.setTypeParser(1082, (value: string) => value)

// Create a connection pool for Neon PostgreSQL
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Initialize database table if it doesn't exist
export async function initializeDatabase() {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        time TIME,
        location VARCHAR(500),
        organizer VARCHAR(255),
        category VARCHAR(50) DEFAULT 'other',
        attendees INTEGER,
        price VARCHAR(100),
        url TEXT,
        image TEXT,
        source VARCHAR(50) DEFAULT 'manual',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    `)

    console.log("Neon database initialized successfully")
    try {
      await initLeadTable()
      console.log("Leads table ensured")
    } catch (e) {
      console.error("Lead table init error", e)
    }
  } catch (error) {
    console.error("Database initialization error:", error)
    throw error
  } finally {
    client.release()
  }
}

export async function createEvent(eventData: Omit<Event, "id">): Promise<Event> {
  const client = await pool.connect()

  try {
    // Validate date format
    if (!eventData.date || !isValidDateFormat(eventData.date)) {
      throw new Error("Invalid date format. Expected YYYY-MM-DD")
    }

    const query = `
      INSERT INTO events (
        title, description, date, time, location, 
        organizer, category, attendees, price, url, image, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `

    const values = [
      eventData.title,
      eventData.description || null,
      eventData.date,
      eventData.time || null,
      eventData.location || null,
      eventData.organizer || null,
      eventData.category,
      eventData.attendees || null,
      eventData.price || null,
      eventData.url || null,
      eventData.image || null,
      eventData.source,
    ]

    const result = await client.query(query, values)
    return mapRowToEvent(result.rows[0])
  } catch (error) {
    console.error("Error creating event:", error)
    throw new Error("Failed to create event")
  } finally {
    client.release()
  }
}

export async function getEvents(): Promise<Event[]> {
  const client = await pool.connect()

  try {
    // Get ALL events - let client handle date filtering based on local timezone
    // With the type parser configured, row.date will be a "YYYY-MM-DD" string
    const query = `
      SELECT * FROM events 
      ORDER BY date ASC, time ASC NULLS LAST
    `

    const result = await client.query(query)
    return result.rows.map(mapRowToEvent)
  } catch (error) {
    console.error("Error fetching events:", error)
    throw new Error("Failed to fetch events")
  } finally {
    client.release()
  }
}

export async function getEventById(id: string): Promise<Event | null> {
  const client = await pool.connect()

  try {
    const query = `SELECT * FROM events WHERE id = $1`
    const result = await client.query(query, [id])

    return result.rows.length > 0 ? mapRowToEvent(result.rows[0]) : null
  } catch (error) {
    console.error("Error fetching event:", error)
    throw new Error("Failed to fetch event")
  } finally {
    client.release()
  }
}

export async function updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
  const client = await pool.connect()

  try {
    // Validate date format if provided
    if (updates.date && !isValidDateFormat(updates.date)) {
      throw new Error("Invalid date format. Expected YYYY-MM-DD")
    }

    const query = `
      UPDATE events 
      SET 
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        date = COALESCE($4, date),
        time = COALESCE($5, time),
        location = COALESCE($6, location),
        organizer = COALESCE($7, organizer),
        category = COALESCE($8, category),
        attendees = COALESCE($9, attendees),
        price = COALESCE($10, price),
        url = COALESCE($11, url),
        image = COALESCE($12, image),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `

    const values = [
      id,
      updates.title,
      updates.description,
      updates.date,
      updates.time,
      updates.location,
      updates.organizer,
      updates.category,
      updates.attendees,
      updates.price,
      updates.url,
      updates.image,
    ]

    const result = await client.query(query, values)

    if (result.rows.length === 0) {
      throw new Error("Event not found")
    }

    return mapRowToEvent(result.rows[0])
  } catch (error) {
    console.error("Error updating event:", error)
    throw new Error("Failed to update event")
  } finally {
    client.release()
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const client = await pool.connect()

  try {
    const query = `DELETE FROM events WHERE id = $1`
    const result = await client.query(query, [id])

    if (result.rowCount === 0) {
      throw new Error("Event not found")
    }
  } catch (error) {
    console.error("Error deleting event:", error)
    throw new Error("Failed to delete event")
  } finally {
    client.release()
  }
}

export async function deleteOldEvents(): Promise<number> {
  const client = await pool.connect()

  try {
    // Only delete events that are definitely old (30+ days) to avoid timezone issues
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0]

    const query = `DELETE FROM events WHERE date < $1 RETURNING id`
    const result = await client.query(query, [cutoffDate])

    const deletedCount = result.rowCount || 0
    console.log(`Deleted ${deletedCount} events older than 30 days`)
    return deletedCount
  } catch (error) {
    console.error("Error deleting old events:", error)
    throw new Error("Failed to delete old events")
  } finally {
    client.release()
  }
}

export async function getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
  const client = await pool.connect()

  try {
    // Validate date formats
    if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
      throw new Error("Invalid date format. Expected YYYY-MM-DD")
    }

    const query = `
      SELECT * FROM events 
      WHERE date BETWEEN $1 AND $2
      ORDER BY date ASC, time ASC NULLS LAST
    `

    const result = await client.query(query, [startDate, endDate])
    return result.rows.map(mapRowToEvent)
  } catch (error) {
    console.error("Error fetching events by date range:", error)
    throw new Error("Failed to fetch events")
  } finally {
    client.release()
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  const client = await pool.connect()

  try {
    await client.query("SELECT NOW()")
    console.log("✅ Neon database connection successful")
    return true
  } catch (error) {
    console.error("❌ Neon database connection failed:", error)
    return false
  } finally {
    client.release()
  }
}

// Helper function to map database row to Event type
// With the type parser configured, row.date will now be a "YYYY-MM-DD" string
function mapRowToEvent(row: any): Event {
  return {
    id: row.id.toString(),
    title: row.title,
    description: row.description || undefined,
    date: row.date, // This is now a "YYYY-MM-DD" string, not a Date object
    time: row.time || undefined,
    location: row.location || undefined,
    organizer: row.organizer || undefined,
    category: row.category,
    attendees: row.attendees || undefined,
    price: row.price || undefined,
    url: row.url || undefined,
    image: row.image || undefined,
    source: row.source,
  }
}

// Helper function to validate date format (YYYY-MM-DD)
function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr) return false

  // Check format using regex
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr)) return false

  // Check if it's a valid date
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(year, month - 1, day) // Create local date
  return (
    !isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

// Graceful shutdown
process.on("SIGINT", () => {
  pool.end(() => {
    console.log("Neon database pool has ended")
    process.exit(0)
  })
})
