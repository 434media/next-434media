# Events Calendar API Integration

This document describes how to integrate with the public Events API to fetch AIMS SATX events from Firestore.

## Overview

The 434media platform manages events for both **434 Media** and **AIM SATX** through a unified admin interface. Events are stored in Firestore and exposed via a public API endpoint for external consumption.

### Data Flow

```
┌─────────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Admin Dashboard   │ ──▶  │    Firestore     │ ◀──  │  Public API     │
│  (434media.com)     │      │  events_aims     │      │  /api/public/   │
└─────────────────────┘      └──────────────────┘      └─────────────────┘
                                                              │
                                                              ▼
                                                       ┌─────────────────┐
                                                       │   aimsatx.com   │
                                                       │   Events Page   │
                                                       └─────────────────┘
```

---

## API Endpoints

### Base URL

```
https://434media.com/api/public/events
```

> Replace `434media.com` with your actual deployment domain.

---

### GET `/api/public/events`

Fetch all AIMS SATX events.

#### Query Parameters

| Parameter | Type   | Default | Description                                      |
|-----------|--------|---------|--------------------------------------------------|
| `filter`  | string | `"all"` | Filter events: `"upcoming"`, `"past"`, or `"all"` |
| `limit`   | number | —       | Maximum number of events to return               |

#### Example Requests

```bash
# Fetch all events
curl https://434media.com/api/public/events

# Fetch only upcoming events
curl https://434media.com/api/public/events?filter=upcoming

# Fetch next 5 upcoming events
curl https://434media.com/api/public/events?filter=upcoming&limit=5

# Fetch past events
curl https://434media.com/api/public/events?filter=past
```

#### Response Format

```json
{
  "success": true,
  "events": [
    {
      "id": "abc123",
      "title": "AIMS Monthly Meetup",
      "description": "Join us for networking and discussions...",
      "date": "2026-01-15",
      "time": "18:00",
      "location": "Tech Hub, San Antonio, TX",
      "organizer": "AIMS ATX",
      "category": "networking",
      "attendees": 50,
      "price": "Free",
      "url": "https://meetup.com/event/...",
      "source": "manual",
      "image": "https://...",
      "tags": "networking,tech,community",
      "isPast": false,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-05T12:00:00.000Z"
    }
  ],
  "count": 1,
  "timestamp": "2026-01-05T15:30:00.000Z"
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Failed to fetch events",
  "events": [],
  "count": 0
}
```

---

### GET `/api/public/events/[id]`

Fetch a single event by ID.

#### Example Request

```bash
curl https://434media.com/api/public/events/abc123
```

#### Response Format

```json
{
  "success": true,
  "event": {
    "id": "abc123",
    "title": "AIMS Monthly Meetup",
    "description": "...",
    "date": "2026-01-15",
    "time": "18:00",
    "location": "Tech Hub, San Antonio, TX",
    "organizer": "AIMS ATX",
    "category": "networking",
    "price": "Free",
    "url": "https://...",
    "image": "https://...",
    "isPast": false,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-05T12:00:00.000Z"
  }
}
```

#### 404 Response

```json
{
  "success": false,
  "error": "Event not found"
}
```

---

## Event Type Definition

```typescript
interface Event {
  id: string
  title: string
  description: string
  date: string           // YYYY-MM-DD format
  time: string           // HH:MM format
  location: string
  organizer: string
  category: "conference" | "workshop" | "meetup" | "networking" | "other"
  attendees?: number
  price: string
  url: string
  source: "meetup" | "eventbrite" | "luma" | "manual"
  image: string
  tags: string           // Comma-separated tags
  isPast: boolean
  created_at: string     // ISO 8601 timestamp
  updated_at: string     // ISO 8601 timestamp
}
```

---

## Integration Examples

### Next.js Server Action

```typescript
// app/actions/events.ts
"use server"

import type { Event } from "@/types/event"

const API_BASE_URL = process.env.EVENTS_API_URL || "https://434media.com"
const API_KEY = process.env.EVENTS_API_KEY

export async function getEventsAction(): Promise<{
  success: boolean
  events: Event[]
  error?: string
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/events`, {
      headers: {
        "X-API-Key": API_KEY || "",
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch events")
    }

    return {
      success: true,
      events: data.events,
    }
  } catch (error) {
    console.error("[Events] Error fetching events:", error)
    return {
      success: false,
      events: [],
      error: error instanceof Error ? error.message : "Failed to load events",
    }
  }
}
```

### React Hook (Client-Side)

```typescript
// hooks/useEvents.ts
import { useState, useEffect } from "react"
import type { Event } from "@/types/event"

const API_BASE_URL = process.env.NEXT_PUBLIC_EVENTS_API_URL || "https://434media.com"

export function useEvents(filter: "all" | "upcoming" | "past" = "all") {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/public/events?filter=${filter}`
        )
        const data = await response.json()

        if (data.success) {
          setEvents(data.events)
        } else {
          throw new Error(data.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [filter])

  return { events, isLoading, error }
}
```

### Vanilla JavaScript / Fetch

```javascript
async function fetchEvents() {
  const response = await fetch("https://434media.com/api/public/events?filter=upcoming")
  const data = await response.json()

  if (data.success) {
    console.log(`Found ${data.count} events:`, data.events)
    return data.events
  } else {
    console.error("Error:", data.error)
    return []
  }
}
```

---

## Environment Variables

### On 434media (API Server)

Add these to your `.env.local` or Vercel environment:

```env
# Public Events API Protection (for AIMS ATX integration)
# Set to 'true' to require API key for all requests
EVENTS_API_REQUIRE_KEY=true
# API key for aimsatx.com to use (share this securely)
EVENTS_API_SECRET=NV4OXBFkxgZCnVvS64UnTVlvsS5FNOsiBMl44mV/NDw=
# Allowed origins (comma-separated). Use * for all origins, or specific domains
EVENTS_API_ALLOWED_ORIGINS=https://aimsatx.com,https://www.aimsatx.com,http://localhost:3000
```

### On aimsatx.com (Consumer)

Add these to your `.env.local` file:

```env
# Server-side API URL
EVENTS_API_URL=https://434media.com
# API key (must match EVENTS_API_SECRET on 434media)
EVENTS_API_KEY=NV4OXBFkxgZCnVvS64UnTVlvsS5FNOsiBMl44mV/NDw=
```

---

## Authentication

The API supports three methods of authentication:

### 1. X-API-Key Header (Recommended)

```bash
curl -H "X-API-Key: YOUR_API_KEY" https://434media.com/api/public/events
```

### 2. Bearer Token

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://434media.com/api/public/events
```

### 3. Query Parameter (Not recommended for production)

```bash
curl "https://434media.com/api/public/events?api_key=YOUR_API_KEY"
```

---

## CORS Configuration

The public events API is configured with permissive CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

This allows the API to be consumed from any domain, including:
- `aimsatx.com`
- `localhost:3000` (development)
- Any other frontend application

---

## Caching & Performance

### Server-Side Caching

The API includes a 30-second in-memory cache on the 434media server to reduce Firestore reads.

### Client-Side Recommendations

- Use `next: { revalidate: 60 }` for ISR (Incremental Static Regeneration)
- Implement client-side caching with SWR or React Query
- Consider caching responses in localStorage for offline support

### Example with SWR

```typescript
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useEvents() {
  const { data, error, isLoading } = useSWR(
    "https://434media.com/api/public/events",
    fetcher,
    { refreshInterval: 60000 } // Refresh every 60 seconds
  )

  return {
    events: data?.events ?? [],
    isLoading,
    error: error?.message || data?.error,
  }
}
```

---

## Utility Function: isEventUpcoming

Use this helper to determine if an event is upcoming based on client timezone:

```typescript
// lib/event-utils.ts
import type { Event } from "@/types/event"

export function isEventUpcoming(event: Event): boolean {
  const eventDate = new Date(event.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return eventDate >= today
}
```

---

## Migration from Airtable

If you're migrating from the previous Airtable-based API, update your API route:

**Before (Airtable):**
```typescript
import { getAllEvents } from "@/lib/airtable/events"

export async function GET() {
  const events = await getAllEvents()
  return NextResponse.json({ events })
}
```

**After (Firestore via 434media API):**
```typescript
export async function GET() {
  const response = await fetch("https://434media.com/api/public/events")
  const data = await response.json()
  return NextResponse.json({ events: data.events })
}
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Ensure you're using `https://` in production |
| Empty events array | Check that events exist in the admin dashboard |
| Stale data | Clear cache or wait for revalidation period |
| 500 errors | Check 434media server logs for Firestore issues |

### Debug Logging

Add logging to track API responses:

```typescript
const response = await fetch(`${API_BASE_URL}/api/public/events`)
const data = await response.json()

console.log("[Events API]", {
  success: data.success,
  count: data.count,
  timestamp: data.timestamp,
})
```

---

## Contact

For API issues or questions, contact the 434media development team.
