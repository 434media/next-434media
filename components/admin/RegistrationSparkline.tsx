"use client"

import { useMemo } from "react"

interface Props {
  // ISO timestamps — one per registration. Empty/invalid entries are dropped.
  timestamps: string[]
  // The event date itself, drawn as a vertical anchor line so the user can
  // see registration activity *relative* to the event (e.g. "70% registered
  // the day before"). Optional.
  eventDate?: string
  // Optional render width. Defaults to 100% of container.
  width?: number
  height?: number
  className?: string
}

interface Bucket {
  // Day key, e.g. "2026-03-13"
  day: string
  // Localized short date, e.g. "Mar 13"
  label: string
  count: number
}

const MS_PER_DAY = 86_400_000

function dayKey(ms: number): string {
  const d = new Date(ms)
  // Use UTC date parts so a registration at 2am local doesn't shift days.
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function shortLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Per-day registration sparkline + event-day anchor. Buckets registrations
 * into UTC days, fills in zero-count days between min and max, and renders an
 * SVG bar chart sized to fill its container. The event date (if provided) is
 * drawn as a vertical dashed line so the eye can read pre-event vs day-of vs
 * post-event activity at a glance.
 *
 * Returns null when there's no usable data — the caller can render its own
 * empty state if needed.
 */
export function RegistrationSparkline({
  timestamps,
  eventDate,
  height = 56,
  className = "",
}: Props) {
  const { buckets, max, eventBucketIndex } = useMemo(() => {
    const days = new Map<string, number>()
    let minMs = Infinity
    let maxMs = -Infinity
    for (const ts of timestamps) {
      if (!ts) continue
      const t = new Date(ts).getTime()
      if (!Number.isFinite(t)) continue
      if (t < minMs) minMs = t
      if (t > maxMs) maxMs = t
      const k = dayKey(t)
      days.set(k, (days.get(k) ?? 0) + 1)
    }
    if (!Number.isFinite(minMs)) {
      return { buckets: [] as Bucket[], max: 0, eventBucketIndex: -1 }
    }

    // Walk min→max in UTC-day steps so empty days appear as zero bars.
    const startMs = Date.UTC(
      new Date(minMs).getUTCFullYear(),
      new Date(minMs).getUTCMonth(),
      new Date(minMs).getUTCDate(),
    )
    const endMs = Date.UTC(
      new Date(maxMs).getUTCFullYear(),
      new Date(maxMs).getUTCMonth(),
      new Date(maxMs).getUTCDate(),
    )
    const out: Bucket[] = []
    for (let t = startMs; t <= endMs; t += MS_PER_DAY) {
      const k = dayKey(t)
      out.push({ day: k, label: shortLabel(t), count: days.get(k) ?? 0 })
    }

    let evIdx = -1
    if (eventDate) {
      const evMs = new Date(eventDate).getTime()
      if (Number.isFinite(evMs)) {
        const evKey = dayKey(evMs)
        evIdx = out.findIndex((b) => b.day === evKey)
        // If the event falls outside the registration range, append a marker
        // bar with count 0 so the user still sees where it landed.
        if (evIdx < 0) {
          if (evMs < startMs) {
            out.unshift({ day: evKey, label: shortLabel(evMs), count: 0 })
            evIdx = 0
          } else if (evMs > endMs) {
            out.push({ day: evKey, label: shortLabel(evMs), count: 0 })
            evIdx = out.length - 1
          }
        }
      }
    }

    const m = out.reduce((acc, b) => Math.max(acc, b.count), 0)
    return { buckets: out, max: m, eventBucketIndex: evIdx }
  }, [timestamps, eventDate])

  if (buckets.length === 0 || max === 0) return null

  // SVG viewBox uses normalized 0..100 width / 0..1 height so the bars scale
  // fluidly to whatever container width Tailwind hands us. Bar gap is a small
  // pixel rhythm — too tight at high counts, too sparse below ~8 days.
  const colW = 100 / buckets.length
  const gap = buckets.length > 60 ? 0.15 : buckets.length > 30 ? 0.4 : 0.8

  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Registrations per day from ${buckets[0].label} to ${buckets[buckets.length - 1].label}, peak ${max}`}
      >
        {/* Baseline */}
        <line x1={0} y1={height - 0.5} x2={100} y2={height - 0.5} stroke="rgb(229,229,229)" strokeWidth={0.5} />

        {/* Event-day anchor — drawn behind the bars */}
        {eventBucketIndex >= 0 && (
          <line
            x1={(eventBucketIndex + 0.5) * colW}
            y1={0}
            x2={(eventBucketIndex + 0.5) * colW}
            y2={height}
            stroke="rgb(16,185,129)"
            strokeWidth={0.6}
            strokeDasharray="1.5 1"
            opacity={0.55}
          />
        )}

        {/* Bars */}
        {buckets.map((b, i) => {
          const h = b.count === 0 ? 0 : Math.max(1.5, (b.count / max) * (height - 4))
          const x = i * colW + gap / 2
          const w = Math.max(0.4, colW - gap)
          const y = height - h
          return (
            <rect
              key={b.day}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={0.4}
              className="fill-neutral-400"
            >
              <title>
                {b.label}: {b.count} registration{b.count === 1 ? "" : "s"}
              </title>
            </rect>
          )
        })}
      </svg>

      {/* Caption: range + peak — keeps the chart legible without axis labels */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 tabular-nums">
        <span>{buckets[0].label}</span>
        <span>
          peak <span className="text-neutral-700 font-medium">{max}</span>/day
          {eventBucketIndex >= 0 && (
            <>
              {" "}·{" "}
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                event day
              </span>
            </>
          )}
        </span>
        <span>{buckets[buckets.length - 1].label}</span>
      </div>
    </div>
  )
}
