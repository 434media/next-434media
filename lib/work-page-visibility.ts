/**
 * Whether the Work page is hidden from the public site.
 *
 * `/work` is redirected to `/` in production until the asset pass lands. Two
 * places need to agree about that: the redirect itself in `next.config.ts`, and
 * the navigation, which must not offer a link to a page that redirects away.
 *
 * They are the same condition, so they are the same function. A navigation item
 * pointing at a redirect is the kind of thing that survives for weeks because
 * nothing errors — the visitor simply lands on the homepage and assumes they
 * misclicked.
 *
 * This is evaluated on the server in both callers. `VERCEL_ENV` is not a
 * `NEXT_PUBLIC_` variable, so a client component cannot read it; the navigation
 * receives the answer as a prop from the root layout rather than testing it
 * itself.
 */
export function workPageRedirectsToHome(): boolean {
  return process.env.VERCEL_ENV === "production"
}
