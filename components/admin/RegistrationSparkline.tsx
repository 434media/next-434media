"use client"

import { useId, useMemo } from "react"

interface Props {
  // ISO timestamps — one per registration. Empty/invalid entries are dropped.
  timestamps: string[]
  // The event date itself, drawn as a vertical anchor line so the user can
  // see registration activity *relative* to the event (e.g. "70% registered
  // the day before"). Optional.
  eventDate?: string
  // Optional render height. Width always fills the container.
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
 * Per-day registration trend as a filled area chart + event-day anchor.
 * Buckets registrations into UTC days, fills zero-count days between min and
 * max, and renders a gradient area with a crisp indigo line on top (the stroke
 * uses non-scaling-stroke so it stays 1.5px crisp even though the SVG stretches
 * to its container). The event date, when provided, is a dashed emerald
 * vertical so the eye reads pre-event vs day-of vs post-event activity.
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
  const gradId = useId()
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

    // Walk min→max in UTC-day steps so empty days appear as zero.
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
        // day so the user still sees where it landed.
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

  const n = buckets.length
  // Top padding so the peak never clips the top edge.
  const pad = 6
  const usableH = height - pad
  // x spreads points edge-to-edge; y maps count → pixels (0 at baseline).
  const xFor = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const yFor = (c: number) => height - (c / max) * usableH

  const pts = buckets.map((b, i) => `${xFor(i).toFixed(2)},${yFor(b.count).toFixed(2)}`)
  const linePath = `M${pts.join(" L")}`
  const areaPath = `M${xFor(0).toFixed(2)},${height} L${pts.join(" L")} L${xFor(n - 1).toFixed(2)},${height} Z`
  const eventX = eventBucketIndex >= 0 ? xFor(eventBucketIndex) : null

  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Registrations per day from ${buckets[0].label} to ${buckets[n - 1].label}, peak ${max}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1={0} y1={height - 0.5} x2={100} y2={height - 0.5} stroke="rgb(229,229,229)" strokeWidth={0.5} />

        {/* Event-day anchor — behind the series */}
        {eventX !== null && (
          <line
            x1={eventX}
            y1={0}
            x2={eventX}
            y2={height}
            stroke="rgb(16,185,129)"
            strokeWidth={1}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
            opacity={0.6}
          />
        )}

        {n === 1 ? (
          // Single day — a centered marker so the value is still visible.
          <rect x={47} y={yFor(buckets[0].count)} width={6} height={height - yFor(buckets[0].count)} fill="rgb(99,102,241)" opacity={0.75} />
        ) : (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke="rgb(99,102,241)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* Caption: range + peak + legend — keeps the chart legible without axes */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 tabular-nums">
        <span>{buckets[0].label}</span>
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-px bg-indigo-500" />
            per day
          </span>
          <span>
            peak <span className="text-neutral-700 font-medium">{max}</span>
          </span>
          {eventX !== null && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              event day
            </span>
          )}
        </span>
        <span>{buckets[n - 1].label}</span>
      </div>
    </div>
  )
}
