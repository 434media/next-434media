"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import type { Event } from "../../types/event-types"
import { isEventUpcoming, isEventPast } from "../../lib/event-utils"

interface ClientEventFilterProps {
  allEvents: Event[]
  children: (filteredEvents: Event[]) => React.ReactNode
  showPastEvents?: boolean
}

export function ClientEventFilter({ allEvents, children, showPastEvents = false }: ClientEventFilterProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const filteredEvents = useMemo(() => {
    if (!isClient) {
      // During SSR, return all events to avoid hydration mismatch
      return allEvents
    }

    // Client-side filtering based on local timezone
    if (showPastEvents) {
      return allEvents.filter((event) => isEventPast(event))
    } else {
      return allEvents.filter((event) => isEventUpcoming(event))
    }
  }, [allEvents, isClient, showPastEvents])

  return <>{children(filteredEvents)}</>
}
