import type React from "react"
import { PublicShell } from "@/components/PublicShell"

/**
 * Unmatched URLs render inside the root layout, which no longer carries the
 * public chrome, so the 404 wraps itself in PublicShell and keeps the page a
 * visitor sees — navbar, footer, trackers — as it was before the layout split
 * (2b fix 9).
 *
 * The body reproduces Next's built-in 404 (HTTPAccessErrorFallback in Next
 * 16.3.5) element for element, so the page is unchanged. It is local rather
 * than imported because Next does not export that component; importing it
 * meant reaching into next/dist, which an upgrade can move.
 */

const styles: Record<"error" | "desc" | "h1" | "h2", React.CSSProperties> = {
  error: {
    fontFamily:
      'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
    height: "100vh",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  desc: { display: "inline-block" },
  h1: {
    display: "inline-block",
    margin: "0 20px 0 0",
    padding: "0 23px 0 0",
    fontSize: 24,
    fontWeight: 500,
    verticalAlign: "top",
    lineHeight: "49px",
  },
  h2: { fontSize: 14, fontWeight: 400, lineHeight: "49px", margin: 0 },
}

const css =
  "body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"

export default function RootNotFound() {
  return (
    <PublicShell>
      <title>404: This page could not be found.</title>
      <div style={styles.error}>
        <div>
          <style dangerouslySetInnerHTML={{ __html: css }} />
          <h1 className="next-error-h1" style={styles.h1}>
            404
          </h1>
          <div style={styles.desc}>
            <h2 style={styles.h2}>This page could not be found.</h2>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
