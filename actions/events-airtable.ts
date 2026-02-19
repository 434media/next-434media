"use server"

import { revalidatePath } from "next/cache"
import type { Event } from "../types/event-types"
import {
  getEventsFromFirestore,
  createEventInFirestore,
  updateEventInFirestore,
  deleteEventFromFirestore,
  getEventByIdFromFirestore,
  testFirestoreEventsConnection,
  markPastEventsInFirestore,
} from "../lib/firestore-events"

// Rate limiting store (in production, use Redis/KV)
const attempts = new Map<string, { count: number; lastAttempt: number }>()

// Timing-safe comparison to prevent timing attacks
function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || "434mediamgr"
  
  if (password.length !== adminPassword.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < password.length; i++) {
    result |= password.charCodeAt(i) ^ adminPassword.charCodeAt(i)
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

    // Test Firestore connection
    const isConnected = await testFirestoreEventsConnection()
    if (!isConnected) {
      throw new Error("Firestore connection failed")
    }

    // Proceed with deletion
    await deleteEventFromFirestore(id)
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

    const isConnected = await testFirestoreEventsConnection()
    if (!isConnected) {
      throw new Error("Firestore connection failed")
    }

    const newEvent = await createEventInFirestore(eventData)
    revalidatePath("/events")

    return {
      success: true,
      event: newEvent,
      message: "Event added successfully!",
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
    const updatedEvent = await updateEventInFirestore(id, updates)
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
    const isConnected = await testFirestoreEventsConnection()
    if (!isConnected) {
      throw new Error("Firestore connection failed")
    }

    // Mark past events automatically
    await markPastEventsInFirestore()

    const allEvents = await getEventsFromFirestore()
    


    return {
      success: true,
      events: allEvents,
      message: `Loaded ${allEvents.length} events from Firestore`,
    }
  } catch (error) {
    console.error("Error fetching events:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch events from Firestore",
      events: [],
    }
  }
}

export async function getEventByIdAction(id: string) {
  try {
    const isConnected = await testFirestoreEventsConnection()
    if (!isConnected) {
      throw new Error("Firestore connection failed")
    }

    const event = await getEventByIdFromFirestore(id)

    if (!event) {
      return {
        success: false,
        error: "Event not found",
        event: null,
      }
    }

    return {
      success: true,
      event,
      message: "Event retrieved successfully from Firestore",
    }
  } catch (error) {
    console.error("Error fetching event by ID:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch event",
      event: null,
    }
  }
}

export async function cleanupPastEventsAction() {
  try {
    const isConnected = await testFirestoreEventsConnection()
    if (!isConnected) {
      throw new Error("Firestore connection failed")
    }

    // Mark events as past
    const markedCount = await markPastEventsInFirestore()

    revalidatePath("/events")

    return {
      success: true,
      message: `Marked ${markedCount} events as past`,
      markedCount,
    }
  } catch (error) {
    console.error("Error marking past events:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark past events",
      markedCount: 0,
    }
  }
}