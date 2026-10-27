/**
 * Offline. "Share with vendor" (plan v11.2.1 Step 4 item 4) and the send command's guardrails (item 5): the one send
 * path with a fake store and a fake mailer. No network, no Firestore, no Resend.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { DAILY_SHARE_CAP, chicagoDay, countryCode, excludedDomain, isAutomatedOpen, hashShareToken, isShareToken, newShareToken, shareRefusal, shareState } from "../brand-share"
import { sendBrandShare, type ShareDeps, type ShareRequest } from "../brand-share-send"
import type { BrandShare, BrandShareStore, NewBrandShare, ShareGuard } from "../firestore-brand-shares"

const NOW = new Date("2026-10-27T15:00:00Z")

/** The store's contract, in memory. reserve runs with no await between its check and its write, as a transaction would. */
function fakeStore(): BrandShareStore & { all: BrandShare[]; viewsOf: Record<string, string[]>; counts: Record<string, number> } {
  const all: BrandShare[] = [], viewsOf: Record<string, string[]> = {}, counts: Record<string, number> = {}, keys: Record<string, { id: string; at: string }> = {}
  let n = 0
  const find = (id: string) => all.find(s => s.id === id) ?? null
  const cap = (e: string, day: string) => `${e}|${day}`
  return {
    all, viewsOf, counts,
    async reserve(s: NewBrandShare, g: ShareGuard) {
      const used = counts[cap(s.sender_email, g.day)] ?? 0, k = keys[g.key]
      if (k && Date.parse(s.created_at) - Date.parse(k.at) < g.windowMs) return { ok: false as const, reason: "repeat" as const, shareId: k.id }
      if (used >= g.cap) return { ok: false as const, reason: "cap" as const, used }
      const share: BrandShare = { ...s, id: `share${++n}`, status: "pending", resend_message_id: null, error: null, revoked: false, revoked_by: null, revoked_at: null, view_count: 0, last_viewed_at: null }
      all.push(share); counts[cap(s.sender_email, g.day)] = used + 1; keys[g.key] = { id: share.id, at: s.created_at }
      return { ok: true as const, share: { ...share } }
    },
    async markSent(id, m) { Object.assign(find(id)!, { status: "sent", resend_message_id: m }) },
    async markFailed(id, e, g) { const s = find(id)!; Object.assign(s, { status: "failed", error: e }); counts[cap(s.sender_email, g.day)]--; if (keys[g.key]?.id === id) delete keys[g.key] },
    usedOn: async (e, day) => counts[cap(e, day)] ?? 0,
    async byTokenHash(h) { return all.find(s => s.token_hash === h) ?? null },
    get: async id => find(id),
    forBrand: async b => all.filter(s => s.brand_id === b).sort((x, y) => y.created_at.localeCompare(x.created_at)),
    async revoke(id, actor, at) { const s = find(id); if (s && !s.revoked) Object.assign(s, { revoked: true, revoked_by: actor, revoked_at: at }); return s },
    async recordView(id, at) { (viewsOf[id] ??= []).push(at); const s = find(id)!; s.view_count++; s.last_viewed_at = at },
    views: async id => (viewsOf[id] ?? []).map(at => ({ at })),
  }
}

function deps(over: Partial<ShareDeps> = {}) {
  const store = fakeStore(), mails: { to: string; replyTo: string; subject: string; text: string; html: string }[] = []
  let t = 0
  const d: ShareDeps = {
    shares: store,
    book: async id => id === "milcity" ? { ok: true, book: { label: "MilCityUSA", versionId: "milcity@v10", n: 10 } } : { ok: false, reason: "no visual standard has been generated into the profile" },
    isSuppressed: async e => e === "gone@suppressed.example",
    sendMail: async m => { mails.push(m); return { id: `msg-${mails.length}` } },
    origin: "https://www.434media.com",
    now: () => new Date(NOW.getTime() + (t++) * 60_000 * 11),
    newToken: newShareToken,
    ...over,
  }
  return { d, store, mails }
}
const req = (over: Partial<ShareRequest> = {}): ShareRequest => ({ brandId: "milcity", recipientName: "Pat Vendor", recipientEmail: "Pat@Vendor.example", country: "United States", via: "button", sender: { email: "staff@434media.com", name: "Staff Person" }, ...over })

test("a share stores the token's hash, never the token, and mails the link through the one send path", async () => {
  const { d, store, mails } = deps()
  const out = await sendBrandShare(req(), d)
  assert.equal(out.ok, true)
  assert.equal(mails.length, 1)
  const m = mails[0]
  assert.equal(m.to, "pat@vendor.example")
  assert.equal(m.replyTo, "staff@434media.com")
  const token = /\/share\/brand-book\/([A-Za-z0-9_-]{43})/.exec(m.text)![1]
  assert.ok(isShareToken(token))
  assert.ok(m.html.includes(token), "the HTML part carries the same link")
  const rec = store.all[0]
  assert.equal(rec.token_hash, hashShareToken(token))
  assert.equal(JSON.stringify(rec).includes(token), false, "the token appears nowhere in the record")
  assert.deepEqual([rec.status, rec.resend_message_id, rec.version_id, rec.version_n, rec.recipient_country, rec.via, rec.sender_email], ["sent", "msg-1", "milcity@v10", 10, "US", "button", "staff@434media.com"])
  // 14 days by default.
  assert.equal(Date.parse(rec.expires_at) - Date.parse(rec.created_at), 14 * 86_400_000)
  // The landing page's lookup: the token's hash finds it.
  assert.equal((await store.byTokenHash(hashShareToken(token)))?.id, rec.id)
})

test("jurisdiction, the address's country domain and suppression are refused before anything is stored or sent", async () => {
  for (const [over, why] of [
    [{ country: "Germany" }, /Germany/],
    [{ country: "CA" }, /Canada/],
    [{ country: "United Kingdom" }, /United Kingdom/],
    [{ country: "uk" }, /United Kingdom/],
    [{ country: "European Union" }, /European Union/],
    [{ recipientEmail: "gone@suppressed.example" }, /suppression/],
  ] as const) {
    const { d, store, mails } = deps()
    const out = await sendBrandShare(req(over), d)
    assert.equal(out.ok, false)
    if (!out.ok) { assert.equal(out.code, "refused"); assert.match(out.error, why); assert.match(out.error, /Nothing was sent/) }
    assert.equal(store.all.length, 0); assert.equal(mails.length, 0)
  }
  const { d } = deps()
  for (const over of [{ recipientEmail: "not-an-email" }, { country: "Atlantis" }]) {
    const out = await sendBrandShare(req(over), d)
    assert.equal(out.ok || out.code, "invalid")
  }
})

test("a brand with no brand book cannot be shared", async () => {
  const { d, mails } = deps()
  const out = await sendBrandShare(req({ brandId: "txmx" }), d)
  assert.equal(out.ok || out.code, "no_book")
  assert.equal(mails.length, 0)
})

test("the daily cap refuses the next send, button and command together; a repeat within minutes is refused", async () => {
  const { d, mails } = deps()
  for (let i = 0; i < DAILY_SHARE_CAP; i++) assert.equal((await sendBrandShare(req({ recipientEmail: `v${i}@vendor.example`, via: i % 2 ? "command" : "button" }), d)).ok, true)
  const over = await sendBrandShare(req({ recipientEmail: "eleven@vendor.example", via: "command" }), d)
  assert.equal(over.ok || over.code, "cap")
  assert.equal(mails.length, DAILY_SHARE_CAP)
  // Another requester is not capped by this one.
  assert.equal((await sendBrandShare(req({ recipientEmail: "eleven@vendor.example", sender: { email: "other@434media.com", name: "Other" } }), d)).ok, true)

  // A double click: two sends at the same moment, one mail.
  const fixed = deps({ now: () => NOW })
  const both = await Promise.all([sendBrandShare(req(), fixed.d), sendBrandShare(req(), fixed.d)])
  assert.deepEqual(both.map(o => o.ok || o.code).sort(), [true, "repeat"].sort())
  assert.equal(fixed.mails.length, 1)
  assert.equal(await fixed.store.usedOn("staff@434media.com", "2026-10-27"), 1)
})

test("a mail Resend refuses marks the share failed, and a failed share never opens", async () => {
  const { d, store } = deps({ sendMail: async () => { throw new Error("domain not verified") } })
  const out = await sendBrandShare(req(), d)
  assert.equal(out.ok || out.status, 502)
  assert.equal(store.all[0].status, "failed")
  // It gives back its place under the cap and its repeat key, so a retry can go.
  assert.equal(await store.usedOn("staff@434media.com", "2026-10-27"), 0)
  assert.equal((await sendBrandShare(req(), { ...d, sendMail: async () => ({ id: "msg-retry" }) })).ok, true)
  assert.equal(shareState(store.all[0], NOW), "failed")
})

test("a share's state: active until it expires or is revoked; each opening is a view with its time", async () => {
  const { d, store } = deps({ now: () => NOW })
  await sendBrandShare(req(), d)
  const s = store.all[0]
  assert.equal(shareState(s, NOW), "active")
  assert.equal(shareState(s, new Date(Date.parse(s.expires_at))), "expired")
  await store.recordView(s.id, "2026-10-27T15:01:00Z"); await store.recordView(s.id, "2026-10-27T15:02:00Z")
  assert.deepEqual((await store.views(s.id)).map(v => v.at), ["2026-10-27T15:01:00Z", "2026-10-27T15:02:00Z"])
  await store.revoke(s.id, "staff@434media.com", "2026-10-27T16:00:00Z")
  assert.equal(shareState(s, NOW), "revoked")
})

test("countries, country domains, the cap's day and the token's shape", () => {
  // An address's own country domain: an excluded jurisdiction's (and .eu) refuses even when the stated country passes.
  assert.deepEqual(["studio.de", "agency.eu", "firm.co.uk", "media.ca", "vendor.com", "estudio.mx", "x.io"].map(excludedDomain), ["de", "eu", "uk", "ca", null, null, null])
  assert.deepEqual(["US", "us", "United States", "uk", "Germany", "Atlantis", ""].map(countryCode), ["US", "US", "US", "GB", "DE", null, null])
  assert.equal(shareRefusal({ email: "a@vendor.example", country: "Mexico" }, false), null)
  // The cap's day is San Antonio's (CDT, UTC-5, on 2026-10-27).
  assert.equal(chicagoDay(new Date("2026-10-27T15:00:00Z")), "2026-10-27")
  assert.equal(chicagoDay(new Date("2026-10-27T03:00:00Z")), "2026-10-26")
  const t = newShareToken()
  assert.ok(isShareToken(t)); assert.equal(isShareToken(t + "x"), false); assert.equal(isShareToken("../x"), false)
  assert.notEqual(newShareToken(), t)
})

test("the send command's prefill is read from the fragment only, trimmed and bounded", async () => {
  const { commandPrefill } = await import("../brand-share-link")
  assert.equal(commandPrefill(""), null)
  assert.equal(commandPrefill("#history"), null)
  assert.deepEqual(commandPrefill("#share&email=pat%40vendor.example&name=Pat%20Vendor&country=United%20States&days=7"), { email: "pat@vendor.example", name: "Pat Vendor", country: "United States", days: "7" })
  assert.deepEqual(commandPrefill("#share?email=a%40vendor.example&days=seven"), { email: "a@vendor.example", name: undefined, country: undefined, days: undefined })
  assert.equal(commandPrefill(`#share&name=${"x".repeat(300)}`)!.name!.length, 100)
})

test("a prefetch or a link scanner is not a view; a person's browser is", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null })
  const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
  assert.equal(isAutomatedOpen(h({ "user-agent": chrome })), false)
  assert.equal(isAutomatedOpen(h({ "user-agent": chrome, "sec-purpose": "prefetch;prerender" })), true)
  assert.equal(isAutomatedOpen(h({ "user-agent": chrome, purpose: "prefetch" })), true)
  for (const ua of ["Mozilla/5.0 (compatible; Slackbot-LinkExpanding 1.0; +https://api.slack.com/robots)", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko; Google-Safety) Chrome", "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)", "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17928; Pro)", "facebookexternalhit/1.1", ""])
    assert.equal(isAutomatedOpen(h({ "user-agent": ua })), true, ua)
})
