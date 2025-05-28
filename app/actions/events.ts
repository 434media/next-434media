"use server"

import { revalidatePath } from "next/cache"
import type { Event } from "../types/event-types"
import { createEvent, updateEvent, deleteEvent, getEvents, initializeDatabase, testConnection } from "../lib/db"
import { isEventPast } from "../lib/event-utils"

// Rate limiting store (in production, use Redis/KV)
const attempts = new Map<string, { count: number; lastAttempt: number }>()

// Timing-safe comparison to prevent timing attacks
function verifyAdminPassword(password: string): boolean {
  if (!process.env.ADMIN_PASSWORD || password.length !== process.env.ADMIN_PASSWORD.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < password.length; i++) {
    result |= password.charCodeAt(i) ^ process.env.ADMIN_PASSWORD.charCodeAt(i)
  }

  return result === 0
}

export async function deleteEventAction(id: string, adminPassword: string, turnstileToken?: string) {
  try {
    // Get client IP (in production, use headers)
    const clientIP = "127.0.0.1" // Replace with actual IP detection

    // Rate limiting check
    const now = Date.now()
    const clientAttempts = attempts.get(clientIP)

    if (clientAttempts && clientAttempts.count > 5 && now - clientAttempts.lastAttempt < 3600000) {
      // 1 hour
      return {
        success: false,
        error: "Too many deletion attempts. Please try again later.",
      }
    }

    // Verify admin password
    if (!verifyAdminPassword(adminPassword)) {
      // Track failed attempt
      const current = attempts.get(clientIP) || { count: 0, lastAttempt: 0 }
      attempts.set(clientIP, { count: current.count + 1, lastAttempt: now })

      return {
        success: false,
        error: "Invalid admin password",
      }
    }

    // Verify Turnstile token (in production)
    if (process.env.NODE_ENV === "production" && turnstileToken) {
      const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY!,
          response: turnstileToken,
        }),
      })

      const result = await verification.json()
      if (!result.success) {
        return {
          success: false,
          error: "Security verification failed",
        }
      }
    }

    // Reset attempts on successful verification
    attempts.delete(clientIP)

    // Proceed with deletion
    await deleteEvent(id)
    revalidatePath("/events")

    return {
      success: true,
      message: "Event deleted successfully!",
    }
  } catch (error) {
    console.error("Error deleting event:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete event",
    }
  }
}

export async function addEventAction(eventData: Omit<Event, "id">, adminPassword: string) {
  try {
    // Verify admin password
    if (!verifyAdminPassword(adminPassword)) {
      return {
        success: false,
        error: "Invalid admin password",
      }
    }

    const isConnected = await testConnection()
    if (!isConnected) {
      throw new Error("Database connection failed")
    }

    await initializeDatabase()
    const newEvent = await createEvent(eventData)
    revalidatePath("/events")

    return {
      success: true,
      event: newEvent,
      message: "Event added successfully to Neon database!",
    }
  } catch (error) {
    console.error("Error adding event:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add event",
    }
  }
}

export async function updateEventAction(id: string, updates: Partial<Event>) {
  try {
    const updatedEvent = await updateEvent(id, updates)
    revalidatePath("/events")

    return {
      success: true,
      event: updatedEvent,
      message: "Event updated successfully!",
    }
  } catch (error) {
    console.error("Error updating event:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update event",
    }
  }
}

export async function getEventsAction() {
  try {
    const isConnected = await testConnection()
    if (!isConnected) {
      throw new Error("Database connection failed")
    }

    await initializeDatabase()
    const allEvents = await getEvents()

    return {
      success: true,
      events: allEvents,
      message: `Loaded ${allEvents.length} events from Neon database`,
    }
  } catch (error) {
    console.error("Error fetching events:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch events",
      events: [],
    }
  }
}

export async function cleanupPastEventsAction() {
  try {
    const isConnected = await testConnection()
    if (!isConnected) {
      throw new Error("Database connection failed")
    }

    const allEvents = await getEvents()
    const pastEvents = allEvents.filter((event) => isEventPast(event))

    let deletedCount = 0
    for (const pastEvent of pastEvents) {
      try {
        await deleteEvent(pastEvent.id)
        deletedCount++
      } catch (error) {
        console.error(`Failed to delete past event ${pastEvent.id}:`, error)
      }
    }

    revalidatePath("/events")

    return {
      success: true,
      message: `Cleaned up ${deletedCount} past events`,
      deletedCount,
    }
  } catch (error) {
    console.error("Error cleaning up past events:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cleanup past events",
      deletedCount: 0,
    }
  }
}
