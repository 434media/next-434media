/**
 * "Lead with Ops. Layer in AI." (June 18, 2026) — broadcast invite template.
 *
 * Ported from the next-canvas (Digital Canvas) repo for sending the promotional
 * INVITE as a Resend broadcast from this admin app. Only the broadcast invite
 * lives here; the transactional confirmation + know-before-you-go templates stay
 * in next-canvas (they fire from the registration flow there).
 *
 * Broadcast adaptation: the shell footer carries an unsubscribe line
 * (`unsubscribeUrl`) — required for compliant marketing email. Everything else
 * (Carroll Strategy & Operations palette, flyer, CTA) is unchanged from source.
 *
 * inviteEmailHtml() returns a complete HTML document; pass to Resend `html`.
 */

interface InviteOpts {
  firstName?: string
  registrationUrl: string
  /** Per-recipient unsubscribe URL (signed). Required for the broadcast. */
  unsubscribeUrl: string
}

const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/digital-canvas-dark.svg?alt=media"
const FLYER_URL =
  "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/digitalcanvas%2FInvitation%20only%20Limited%20Executive%20Seating.PNG?alt=media"
const FONT_URL = "https://www.digitalcanvas.community/fonts/GeistPixel-Square.ttf"

const PIXEL_STACK = "'GeistPixelSquare', 'Courier New', monospace"
const SANS_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Carroll Strategy & Operations color system. */
const C = {
  white: "#FFFFFF",
  black: "#000000",
  navy: "#041C32",
  gray: "#6F7883",
  border: "#E1E4EA",
  offWhite: "#F4F6F9",
  emerald: "#1AAD9B",
  mint: "#0CBB83",
  coral: "#FF5757",
}

/** Escape user-provided strings before interpolating into HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Shared light-theme shell. `unsubscribeUrl` adds the compliant footer line. */
function shell(opts: {
  title: string
  previewText: string
  body: string
  unsubscribeUrl: string
}): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
  <style>
    @font-face {
      font-family: 'GeistPixelSquare';
      src: url('${FONT_URL}') format('truetype');
      font-weight: 400 800;
      font-style: normal;
      font-display: swap;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${C.white}; font-family: ${SANS_STACK}; color: ${C.navy};">
  <span style="display: none; max-height: 0; overflow: hidden; opacity: 0; visibility: hidden; color: transparent;">${opts.previewText}</span>
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${C.white};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">

          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <img src="${LOGO_URL}" alt="Digital Canvas" width="200" height="62" style="display: block; max-width: 200px; height: auto; border: 0;" />
            </td>
          </tr>

          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background-color: ${C.border};"></div>
            </td>
          </tr>

          ${opts.body}

          <tr>
            <td style="padding: 32px;">
              <div style="height: 1px; background-color: ${C.border}; margin-bottom: 24px;"></div>
              <p style="margin: 0 0 8px 0; font-family: ${PIXEL_STACK}; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${C.gray}; font-weight: 700;">
                Presented by Digital Canvas &middot; 434 Media
              </p>
              <p style="margin: 0; font-size: 12px; color: ${C.gray};">
                Questions? <a href="mailto:VIP@434MEDIA.COM" style="color: ${C.emerald}; text-decoration: none; font-weight: 600;">VIP@434MEDIA.COM</a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 11px; color: ${C.gray};">
                &copy; ${year} Digital Canvas &middot; 434 Media. All rights reserved.
              </p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: ${C.gray};">
                You're receiving this because you opted in to the 434 Media network.
                <a href="${opts.unsubscribeUrl}" style="color: ${C.gray}; text-decoration: underline;">Unsubscribe</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const EVENT_DETAILS_BLOCK = `
<table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid ${C.border}; background-color: ${C.white};">
  <tr>
    <td style="padding: 20px 24px;">
      <p style="margin: 0 0 14px 0; font-family: ${PIXEL_STACK}; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: ${C.gray}; font-weight: 700;">
        Event Details
      </p>
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${C.border};">
            <span style="font-family: ${PIXEL_STACK}; font-size: 11px; color: ${C.gray}; text-transform: uppercase;">Date</span>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${C.border}; text-align: right;">
            <span style="font-size: 14px; color: ${C.navy}; font-weight: 600;">June 18, 2026</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${C.border};">
            <span style="font-family: ${PIXEL_STACK}; font-size: 11px; color: ${C.gray}; text-transform: uppercase;">Time</span>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${C.border}; text-align: right;">
            <span style="font-size: 14px; color: ${C.navy}; font-weight: 600;">11:30 AM &ndash; 1:00 PM</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <span style="font-family: ${PIXEL_STACK}; font-size: 11px; color: ${C.gray}; text-transform: uppercase;">Location</span>
          </td>
          <td style="padding: 8px 0; text-align: right;">
            <span style="font-size: 14px; color: ${C.navy}; font-weight: 600;">VelocityTX CRC</span>
            <br /><span style="font-size: 12px; color: ${C.gray};">1305 E. Houston St.</span>
            <br /><span style="font-size: 12px; color: ${C.gray};">Lunch provided</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim()

/** Promotional invite (broadcast). */
export function inviteEmailHtml(opts: InviteOpts): string {
  const greeting = opts.firstName ? `Hi ${escapeHtml(opts.firstName)},` : "Hi there,"
  const body = `
<tr>
  <td style="padding: 32px 32px 0 32px;">
    <p style="margin: 0 0 0 0; font-family: ${PIXEL_STACK}; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: ${C.gray}; font-weight: 700;">
      Executive Working Lunch &nbsp;&middot;&nbsp; June 18 &nbsp;&middot;&nbsp; VelocityTX CRC
    </p>
  </td>
</tr>

<tr>
  <td style="padding: 24px 32px 0 32px;">
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.7; color: ${C.navy};">
      ${greeting}
    </p>
    <p style="margin: 0 0 18px 0; font-size: 16px; line-height: 1.7; color: ${C.navy}; font-weight: 500;">
      Most organizations aren&rsquo;t struggling to find AI tools.
    </p>
    <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.7; color: ${C.gray};">
      They&rsquo;re struggling to determine where AI fits into their business, how to prioritize opportunities, and how to align implementation with measurable outcomes.
    </p>
  </td>
</tr>

<tr>
  <td style="padding: 0 32px 28px 32px;">
    <a href="${opts.registrationUrl}" style="text-decoration: none; display: block; border: 1px solid ${C.border};">
      <img src="${FLYER_URL}" alt="Lead with Ops. Layer in AI. — Executive Working Lunch, June 18, 2026, VelocityTX CRC" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border: 0;" />
    </a>
  </td>
</tr>

<tr>
  <td style="padding: 0 32px 0 32px;">
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.7; color: ${C.gray};">
      On <strong style="color: ${C.navy};">June 18</strong>, we&rsquo;re hosting <strong style="color: ${C.navy};">Adam Carroll, Founder of Carroll Strategy &amp; Operations</strong>, for a practical discussion focused on the intersection of operations, technology, and execution.
    </p>
    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.7; color: ${C.gray};">
      This session is designed for CEOs, Presidents, Founders, and Operations Leaders who want a framework for evaluating AI investments through the lens of business strategy&mdash;not hype.
    </p>
    <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.7; color: ${C.gray};">
      Space is intentionally limited to encourage meaningful discussion among attendees.
    </p>
  </td>
</tr>

<tr>
  <td style="padding: 0 32px 24px 32px;">
    ${EVENT_DETAILS_BLOCK}
  </td>
</tr>

<tr>
  <td style="padding: 0 32px 0 32px;">
    <p style="margin: 0 0 16px 0; font-family: ${PIXEL_STACK}; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: ${C.coral}; font-weight: 700;">
      Executive seating is limited
    </p>
    <table role="presentation" style="border-collapse: collapse;">
      <tr>
        <td style="background-color: ${C.coral}; padding: 14px 28px;">
          <a href="${opts.registrationUrl}" style="font-family: ${PIXEL_STACK}; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: ${C.navy}; text-decoration: none; display: inline-block;">
            Reserve Your Seat &rarr;
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 16px 0 0 0; font-size: 12px; line-height: 1.5; color: ${C.gray};">
      Or copy the link: <a href="${opts.registrationUrl}" style="color: ${C.emerald}; word-break: break-all; text-decoration: none;">${opts.registrationUrl}</a>
    </p>
  </td>
</tr>

<tr>
  <td style="padding: 28px 32px 8px 32px;">
    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: ${C.navy};">
      We hope you&rsquo;ll join us.
    </p>
  </td>
</tr>
`.trim()

  return shell({
    title: "Limited Seating: Lead with Ops. Layer in AI. featuring Adam Carroll | June 18",
    previewText:
      "Most organizations aren't struggling to find AI tools. They're struggling to align implementation with measurable outcomes.",
    body,
    unsubscribeUrl: opts.unsubscribeUrl,
  })
}
