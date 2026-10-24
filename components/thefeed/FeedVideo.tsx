"use client"

import { useEffect, useState } from "react"

// The Digital Canvas reel beside The Feed: web derivatives of the 6-second
// HEVC source (digitalcanvas.mov in storage, 10.6 MB), smaller encoding first
// (MP4 648 KB, WebM 726 KB), muted and looped. Reduced motion gets no video
// element at all (Display and Design Standard 3.0). It does not autoplay: the
// Standard allows autoplay only with an approved poster (section 4), and none is
// approved yet. Until one is, it loads metadata only and plays on request.
export function FeedVideo() {
  const [reduced, setReduced] = useState<boolean | null>(null)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  if (reduced !== false) return <div className="w-full h-full bg-black" aria-hidden="true" />

  return (
    <video className="w-full h-full object-cover" muted loop playsInline controls preload="metadata" aria-label="Digital Canvas reel">
      <source src="/thefeed/thefeed-digitalcanvas.mp4" type="video/mp4" />
      <source src="/thefeed/thefeed-digitalcanvas.webm" type="video/webm" />
    </video>
  )
}
