"use client"

import type React from "react"

import { useEffect, useState } from "react"
import type { Event } from "../../types/event-types"
import { isEventUpcoming } from "../../lib/event-utils"

interface ClientEventWrapperProps {
  children: (events: Event[], isClient: boolean) => React.ReactNode
  serverEvents: Event[]
}

export function ClientEventWrapper({ children, serverEvents }: ClientEventWrapperProps) {
  const [isClient, setIsClient] = useState(false)
  const [clientEvents, setClientEvents] = useState<Event[]>(serverEvents)

  useEffect(() => {
    setIsClient(true)
    // Filter events on the client side using local timezone
    const upcomingEvents = serverEvents.filter((event) => isEventUpcoming(event))
    setClientEvents(upcomingEvents)
  }, [serverEvents])

  return <>{children(clientEvents, isClient)}</>
}
