// Portfolio rollup export — CSV + PNG. Mirrors the per-account IG page's
// download pattern but flattens both Web (GA4) and Social (Instagram) into a
// single artifact.

import type { InstagramPortfolioSummary } from "./instagram-portfolio"

// Mirrors the inline interface in PortfolioAnalyticsClientPage. Kept loose
// here so this module doesn't pull a type from a "use client" page file.
interface WebPortfolioPayload {
  total: {
    sessions: number
    users: number
    pageViews: number
    newUsers: number
    engagementRate: number
    averageEngagementTime: number
  }
  totalSessionsChange: number
  totalUsersChange: number
  totalPageViewsChange: number
  totalEngagementRateChange: number
  brands: WebPortfolioBrandRow[]
  configuredCount: number
  totalCount: number
  generatedAt: string
}

interface WebPortfolioBrandRow {
  propertyId: string
  name: string
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  newUsers: number
  engagementRate: number
  averageEngagementTime: number
  sessionsChange: number
  usersChange: number
  pageViewsChange: number
  engagementRateChange: number
  sessionShare: number
  unavailable?: boolean
  error?: string
}

function csvEscape(value: string | number): string {
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function triggerDownload(content: string | Blob, filename: string, mimeType: string) {
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: `${mimeType};charset=utf-8;` })
      : content
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function dateStamp(): string {
  return new Date().toISOString().split("T")[0]
}

// ------------------------------------------------------------
// CSV
// ------------------------------------------------------------

export function downloadPortfolioCSV(
  webData: WebPortfolioPayload | null,
  igData: InstagramPortfolioSummary | null,
  rangeLabel: string,
  rangeKey: string,
) {
  let csv = `434 Media Portfolio Rollup\n`
  csv += `Range,${csvEscape(rangeLabel)}\n`
  csv += `Generated,${csvEscape(new Date().toLocaleString())}\n\n`

  if (webData) {
    csv += `=== WEB (Google Analytics) ===\n`
    csv += `Metric,Value,Δ %\n`
    csv += `Total sessions,${webData.total.sessions},${webData.totalSessionsChange.toFixed(1)}\n`
    csv += `Total users,${webData.total.users},${webData.totalUsersChange.toFixed(1)}\n`
    csv += `Total page views,${webData.total.pageViews},${webData.totalPageViewsChange.toFixed(1)}\n`
    csv += `Engagement rate (%),${(webData.total.engagementRate * 100).toFixed(1)},${webData.totalEngagementRateChange.toFixed(1)}\n`
    csv += `Configured properties,${webData.configuredCount} of ${webData.totalCount},\n\n`

    csv += `Brand,Sessions,Sessions Δ %,Users,Users Δ %,Page views,Page views Δ %,Engagement %,Engagement Δ %,Share %\n`
    for (const b of webData.brands) {
      if (b.unavailable) {
        csv +=
          [csvEscape(b.name), "UNAVAILABLE", "", "", "", "", "", "", "", csvEscape(b.error ?? "")].join(",") + "\n"
        continue
      }
      csv +=
        [
          csvEscape(b.name),
          b.totalSessions,
          b.sessionsChange.toFixed(1),
          b.totalUsers,
          b.usersChange.toFixed(1),
          b.totalPageViews,
          b.pageViewsChange.toFixed(1),
          (b.engagementRate * 100).toFixed(1),
          b.engagementRateChange.toFixed(1),
          (b.sessionShare * 100).toFixed(1),
        ].join(",") + "\n"
    }
    csv += "\n"
  }

  if (igData) {
    csv += `=== SOCIAL (Instagram) ===\n`
    csv += `Metric,Value,Δ %\n`
    csv += `Total followers,${igData.total.followers},${igData.totalFollowersChange.toFixed(1)}\n`
    csv += `Total media count,${igData.total.mediaCount},${igData.totalMediaChange.toFixed(1)}\n`
    csv += `Net follower growth,${igData.total.netFollowerGrowth},\n`
    csv += `Configured accounts,${igData.configuredCount} of ${igData.totalCount},\n\n`

    csv += `Account,Username,Followers,Net growth,Growth %,Posts,Posts added,Share %,Snapshot,Baseline\n`
    for (const b of igData.brands) {
      if (b.unavailable) {
        csv +=
          [csvEscape(b.name), "", "UNAVAILABLE", "", "", "", "", "", "", csvEscape(b.error ?? "")].join(",") + "\n"
        continue
      }
      const hasBaseline = !!b.priorSnapshotDate
      csv +=
        [
          csvEscape(b.name),
          csvEscape(b.username ?? ""),
          b.followersCount,
          hasBaseline ? b.netFollowerGrowth : "",
          hasBaseline ? b.followerGrowthChange.toFixed(2) : "",
          b.mediaCount,
          b.mediaAdded,
          (b.followerShare * 100).toFixed(1),
          csvEscape(b.snapshotDate ?? ""),
          csvEscape(b.priorSnapshotDate ?? ""),
        ].join(",") + "\n"
    }
  }

  triggerDownload(csv, `portfolio-${rangeKey}-${dateStamp()}.csv`, "text/csv")
}

// ------------------------------------------------------------
// PNG (canvas-rendered)
// ------------------------------------------------------------

const PNG_COLORS = {
  bg: "#fafafa",
  card: "#ffffff",
  border: "#e5e5e5",
  text: "#171717",
  muted: "#737373",
  faint: "#a3a3a3",
  accentEmerald: "#10b981",
  accentRed: "#ef4444",
  accentPink: "#ec4899",
}

// Per-row height for brand tables in the PNG. Module-scoped because both
// downloadPortfolioPNG (for canvas-height computation) and drawSection (for
// row positioning) need to read it.
const PNG_ROW_H = 36

function pctText(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

function signedNumber(n: number): string {
  if (n > 0) return `+${n.toLocaleString()}`
  return n.toLocaleString()
}

function fmtCount(n: number): string {
  return n.toLocaleString()
}

export function downloadPortfolioPNG(
  webData: WebPortfolioPayload | null,
  igData: InstagramPortfolioSummary | null,
  rangeLabel: string,
  rangeKey: string,
) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    alert("Unable to create canvas. Please try again.")
    return
  }

  // Layout — width fixed, height computed from content
  const W = 1200
  const PADDING = 60
  const SECTION_GAP = 32

  const webRowCount = webData ? webData.brands.length : 0
  const igRowCount = igData ? igData.brands.length : 0

  const heightForSection = (rowCount: number, hasData: boolean) => {
    if (!hasData) return 0
    return 100 + 100 + rowCount * PNG_ROW_H + 40 // header + totals strip + rows + footer
  }

  let H = 140 // page header
  H += heightForSection(webRowCount, !!webData)
  if (webData && igData) H += SECTION_GAP
  H += heightForSection(igRowCount, !!igData)
  H += 60 // footer
  H = Math.max(H, 600)

  canvas.width = W
  canvas.height = H

  // Background
  ctx.fillStyle = PNG_COLORS.bg
  ctx.fillRect(0, 0, W, H)

  // Page header
  ctx.fillStyle = PNG_COLORS.text
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("434 Media Portfolio", PADDING, 60)

  ctx.fillStyle = PNG_COLORS.muted
  ctx.font = "14px system-ui, -apple-system, sans-serif"
  ctx.fillText(`${rangeLabel} · Generated ${new Date().toLocaleString()}`, PADDING, 88)

  // Divider
  ctx.strokeStyle = PNG_COLORS.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, 110)
  ctx.lineTo(W - PADDING, 110)
  ctx.stroke()

  let y = 140

  if (webData) {
    y = drawSection(ctx, {
      x: PADDING,
      y,
      width: W - PADDING * 2,
      title: "Web — Google Analytics",
      titleColor: PNG_COLORS.accentEmerald,
      totals: [
        { label: "Sessions", value: fmtCount(webData.total.sessions), delta: webData.totalSessionsChange },
        { label: "Users", value: fmtCount(webData.total.users), delta: webData.totalUsersChange },
        { label: "Page views", value: fmtCount(webData.total.pageViews), delta: webData.totalPageViewsChange },
        {
          label: "Engagement",
          value: `${(webData.total.engagementRate * 100).toFixed(1)}%`,
          delta: webData.totalEngagementRateChange,
        },
      ],
      columns: [
        { label: "Brand", width: 0.34, align: "left" },
        { label: "Sessions", width: 0.18, align: "right" },
        { label: "Δ%", width: 0.12, align: "right" },
        { label: "Users", width: 0.18, align: "right" },
        { label: "Share", width: 0.18, align: "right" },
      ],
      rows: webData.brands.map((b) =>
        b.unavailable
          ? [b.name, "—", "—", "—", "—"]
          : [
              b.name,
              fmtCount(b.totalSessions),
              pctText(b.sessionsChange),
              fmtCount(b.totalUsers),
              `${(b.sessionShare * 100).toFixed(1)}%`,
            ],
      ),
      configuredFooter: `${webData.configuredCount} of ${webData.totalCount} properties configured`,
    })
    y += SECTION_GAP
  }

  if (igData) {
    y = drawSection(ctx, {
      x: PADDING,
      y,
      width: W - PADDING * 2,
      title: "Social — Instagram",
      titleColor: PNG_COLORS.accentPink,
      totals: [
        {
          label: "Followers",
          value: fmtCount(igData.total.followers),
          delta: igData.totalFollowersChange,
        },
        {
          label: "Net growth",
          value: signedNumber(igData.total.netFollowerGrowth),
          delta: 0,
        },
        {
          label: "Posts",
          value: fmtCount(igData.total.mediaCount),
          delta: igData.totalMediaChange,
        },
        {
          label: "Accounts",
          value: `${igData.configuredCount}/${igData.totalCount}`,
          delta: 0,
        },
      ],
      columns: [
        { label: "Account", width: 0.34, align: "left" },
        { label: "Followers", width: 0.18, align: "right" },
        { label: "Net growth", width: 0.16, align: "right" },
        { label: "Growth %", width: 0.14, align: "right" },
        { label: "Share", width: 0.18, align: "right" },
      ],
      rows: igData.brands.map((b) => {
        if (b.unavailable) return [b.name, "—", "—", "—", "—"]
        const hasBaseline = !!b.priorSnapshotDate
        return [
          b.name,
          fmtCount(b.followersCount),
          hasBaseline ? signedNumber(b.netFollowerGrowth) : "—",
          hasBaseline ? `${b.followerGrowthChange.toFixed(1)}%` : "—",
          `${(b.followerShare * 100).toFixed(1)}%`,
        ]
      }),
      configuredFooter: `${igData.configuredCount} of ${igData.totalCount} accounts configured`,
    })
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    triggerDownload(blob, `portfolio-${rangeKey}-${dateStamp()}.png`, "image/png")
  }, "image/png")
}

interface SectionTotal {
  label: string
  value: string
  delta: number
}

interface SectionColumn {
  label: string
  /** Fraction of section width (0-1). Columns must sum to ~1. */
  width: number
  align: "left" | "right"
}

interface DrawSectionOptions {
  x: number
  y: number
  width: number
  title: string
  titleColor: string
  totals: SectionTotal[]
  columns: SectionColumn[]
  rows: string[][]
  configuredFooter: string
}

// Draws one section (Web or Social) and returns the y-coordinate after it.
function drawSection(ctx: CanvasRenderingContext2D, opts: DrawSectionOptions): number {
  const { x, y, width, title, titleColor, totals, columns, rows, configuredFooter } = opts

  // Section title with color dot
  ctx.fillStyle = titleColor
  ctx.beginPath()
  ctx.arc(x + 6, y + 8, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = PNG_COLORS.text
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(title.toUpperCase(), x + 20, y + 13)

  let cursor = y + 32

  // Totals strip — equal-width tiles
  const tileWidth = width / totals.length - 8
  for (let i = 0; i < totals.length; i++) {
    const t = totals[i]
    const tx = x + i * (tileWidth + 8)
    // Tile background
    ctx.fillStyle = PNG_COLORS.card
    ctx.strokeStyle = PNG_COLORS.border
    ctx.lineWidth = 1
    roundRect(ctx, tx, cursor, tileWidth, 70, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = PNG_COLORS.muted
    ctx.font = "10px system-ui, -apple-system, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(t.label.toUpperCase(), tx + 12, cursor + 18)

    ctx.fillStyle = PNG_COLORS.text
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif"
    ctx.fillText(t.value, tx + 12, cursor + 48)

    if (t.delta !== 0) {
      ctx.fillStyle = t.delta > 0 ? PNG_COLORS.accentEmerald : PNG_COLORS.accentRed
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif"
      ctx.textAlign = "right"
      ctx.fillText(pctText(t.delta), tx + tileWidth - 12, cursor + 18)
    }
  }
  cursor += 86

  // Table header
  ctx.fillStyle = PNG_COLORS.muted
  ctx.font = "bold 10px system-ui, -apple-system, sans-serif"

  let cx = x
  for (const col of columns) {
    const w = col.width * width
    if (col.align === "right") {
      ctx.textAlign = "right"
      ctx.fillText(col.label.toUpperCase(), cx + w - 12, cursor + 8)
    } else {
      ctx.textAlign = "left"
      ctx.fillText(col.label.toUpperCase(), cx + 12, cursor + 8)
    }
    cx += w
  }
  cursor += 18

  // Header divider
  ctx.strokeStyle = PNG_COLORS.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, cursor)
  ctx.lineTo(x + width, cursor)
  ctx.stroke()
  cursor += 4

  // Rows
  ctx.font = "13px system-ui, -apple-system, sans-serif"
  for (const row of rows) {
    let rcx = x
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const w = col.width * width
      const cell = row[i] ?? ""
      ctx.fillStyle = i === 0 ? PNG_COLORS.text : PNG_COLORS.muted
      if (i === 0) ctx.font = "600 13px system-ui, -apple-system, sans-serif"
      else ctx.font = "13px system-ui, -apple-system, sans-serif"
      if (col.align === "right") {
        ctx.textAlign = "right"
        ctx.fillText(cell, rcx + w - 12, cursor + 22)
      } else {
        ctx.textAlign = "left"
        ctx.fillText(cell, rcx + 12, cursor + 22)
      }
      rcx += w
    }
    cursor += PNG_ROW_H

    // Faint row divider
    ctx.strokeStyle = "#f5f5f5"
    ctx.beginPath()
    ctx.moveTo(x, cursor)
    ctx.lineTo(x + width, cursor)
    ctx.stroke()
  }

  // Footer note
  ctx.fillStyle = PNG_COLORS.faint
  ctx.font = "11px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(configuredFooter, x, cursor + 22)

  return cursor + 38
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
