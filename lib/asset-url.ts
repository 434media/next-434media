// Shared asset-URL helpers used by the Studio, GeneratePanel, and the asset
// library picker. Kept framework-free so both client and server can import.

// Allow only http/https URLs (defends against javascript:/data: in stored urls).
export function sanitizeAssetUrl(url: string | undefined): string {
  if (!url) return ""
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : ""
  } catch {
    return ""
  }
}

// Force a true one-click download. Browsers ignore the <a download> attribute on
// cross-origin links, and our assets live on Vercel Blob (a different origin) —
// so a plain link just opens the file in a tab. Vercel Blob honors a `download`
// query param by responding with Content-Disposition: attachment, which makes
// the browser save the file (with its original name) instead. Returns "" for
// invalid input so callers can fall back to "#".
export function toDownloadUrl(url: string | undefined): string {
  const safe = sanitizeAssetUrl(url)
  if (!safe) return ""
  try {
    const u = new URL(safe)
    u.searchParams.set("download", "1")
    return u.toString()
  } catch {
    return safe
  }
}
