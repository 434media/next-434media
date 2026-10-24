import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react"

// Moved from the Digital Canvas site (founder, 2026-10-24). The session took
// place on June 18, 2026, so the page is kept as the record of it: registration
// is closed (its route and emails were not carried over) and attendees are
// pointed to the feedback form.
//
// On 434media.com this is 434's own page: palette tokens and the visual
// system's type roles. The Carroll Strategy & Operations colours the Digital
// Canvas version used are not carried over; Carroll's identity appears only in
// the flyer, which is content (coordinator, 2026-10-24).

const FLYER_URL =
  "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/digitalcanvas%2FInvitation%20only%20Limited%20Executive%20Seating.PNG?alt=media"

const QUESTIONS = [
  "How does AI support business strategy?",
  "Where can AI create measurable ROI?",
  "How do you implement AI across the enterprise?",
]

const DETAILS = [
  { icon: Calendar, label: "Date", value: "June 18, 2026" },
  { icon: Clock, label: "Time", value: "11:30 AM – 1:00 PM" },
  { icon: MapPin, label: "Location", value: "VelocityTX" },
]

export default function LeadWithOpsPage() {
  return (
    <main className="bg-[var(--434-background)] text-[var(--434-text)] min-h-screen">
      <section className="pt-28 md:pt-32 pb-20 md:pb-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-7 space-y-12">
            <div className="space-y-6">
              <p className="t-label text-neutral-500">Executive working lunch · Held June 18, 2026</p>
              <h1 className="font-ggx88 t-display-l text-neutral-900">
                Lead with Ops. <span className="block text-neutral-500">Layer in AI.</span>
              </h1>
              <p className="t-body-l text-neutral-700 max-w-2xl">
                A practical executive working lunch with{" "}
                <span className="font-semibold text-neutral-900">
                  Adam Carroll, Founder of Carroll Strategy &amp; Operations
                </span>{" "}
                — clarity on aligning AI initiatives with business strategy, operational priorities, and measurable
                outcomes.
              </p>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-3 border border-neutral-200 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200">
              {DETAILS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-5 flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0 text-neutral-600" aria-hidden="true" />
                  <div>
                    <dt className="t-label text-neutral-500 mb-1">{label}</dt>
                    <dd className="t-body-s font-semibold text-neutral-900">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div>
              <h2 className="t-label text-neutral-500 mb-5">What we explored</h2>
              <ul className="space-y-3">
                {QUESTIONS.map((q) => (
                  <li key={q} className="t-heading-s text-neutral-900 pl-4 border-l-2 border-[var(--434-color-03)]">
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-l-2 border-[var(--434-color-02-black)] pl-5 max-w-2xl">
              <p className="t-body-l font-semibold text-neutral-900">Not a product demo or software pitch.</p>
              <p className="t-body text-neutral-600 mt-2">
                An executive-level conversation for CEOs, Presidents, Operators, and business leaders looking for
                clarity before making AI investments.
              </p>
            </div>

            <div className="relative aspect-4/5 w-full max-w-md border border-neutral-200">
              <Image
                src={FLYER_URL}
                alt="Lead with Ops. Layer in AI. — Executive Working Lunch, June 18, 2026, VelocityTX"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 448px"
              />
            </div>

            <div>
              <h2 className="t-label text-neutral-500 mb-4">Featured speaker</h2>
              <p className="t-heading-xl text-neutral-900 mb-5">
                Adam Carroll.{" "}
                <span className="text-neutral-500">Founder, Carroll Strategy &amp; Operations.</span>
              </p>
              <p className="t-body text-neutral-700 mb-5 max-w-2xl">
                Adam works with operators to align technology decisions with business outcomes. The session focuses on
                practical frameworks — how to lead with operations, layer in AI where it creates measurable ROI, and
                avoid investing in tools without strategic anchor.
              </p>
              <p className="t-body text-neutral-700 max-w-2xl">
                Designed for CEOs, Presidents, Operators, Founders, and business leaders. Off-the-record, peer-level
                conversation.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-neutral-200">
              <span className="t-label text-neutral-500">Presented by</span>
              <span className="t-body-s font-semibold text-neutral-900">Digital Canvas · 434 MEDIA</span>
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24 border border-neutral-200 p-7 md:p-9">
              <p className="t-label text-neutral-500 mb-4">Registration closed</p>
              <h2 className="t-heading-l text-neutral-900 mb-4">This session has taken place.</h2>
              <p className="t-body text-neutral-700 mb-6">
                This working lunch took place on June 18, 2026 at VelocityTX. If you attended, ninety seconds of
                feedback shapes the next session.
              </p>
              <Link
                href="/workshops/lead-with-ops/feedback"
                className="t-control-emphasis group flex items-center justify-between gap-3 w-full py-4 px-6 bg-[var(--434-color-02-black)] text-[var(--434-white)] hover:bg-neutral-800 transition-colors"
              >
                Share feedback
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <p className="t-body-s text-neutral-600 mt-6">
                Interested in the next session? Write to{" "}
                <a href="mailto:VIP@434MEDIA.COM" className="text-neutral-900 font-semibold hover:underline">
                  VIP@434MEDIA.COM
                </a>
                .
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
