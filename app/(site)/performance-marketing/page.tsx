import type { Metadata } from "next"
// Client-neutral education page on demand creation, demand capture and
// measurement. Built from the CMO-approved handoff (Version B.1, 2026-10-14)
// and the founder's review rounds; build-sequence parallel item, 434-context#131.
//
// Typography is the generated `t-*` roles and the site's own font variables,
// colour is the generated `--434-*` palette, and the logo and navigation come
// from PublicShell. Nothing here restates a standard.
//
// Not indexed and not in the sitemap: public indexing is a separate founder
// decision from publication (handoff, phase 3). Flip `robots` and add the
// sitemap entry together when it is made.
//
// No call to action: Paid Search and Conversion Optimization are Ntooitive
// services (Policy 2.11), so the page offers no 434 action beside them.
import styles from "./performance-marketing.module.css"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

const description =
  "Performance marketing is broader than PPC. How demand creation, demand capture and measurement work as one system, and why the right mix depends on budget and objectives."

export const metadata: Metadata = {
  title: "Demand Drives Performance",
  description,
  alternates: { canonical: "/performance-marketing" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Demand Drives Performance | 434 MEDIA",
    description,
    url: `${siteUrl}/performance-marketing`,
    siteName: "434 MEDIA",
    // Named explicitly for the same reason as the Work page: an `openGraph`
    // object without `images` suppresses the file-based site card.
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630 }],
    locale: "en_US",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Demand Drives Performance | 434 MEDIA",
    description,
    images: [`${siteUrl}/twitter-image`],
  },
}

const POINTS = [
  {
    title: "Performance marketing is broader than PPC.",
    body: "PPC is a tactic, whereas performance is about measurable business outcomes across channels and activities.",
  },
  {
    title: "Demand creation can improve capture economics.",
    body: "Brand familiarity, preference, and greater market demand can influence the effectiveness of subsequent conversion efforts. The feedback loop helps determine where investment should go next.",
  },
  {
    title: "Do you need every marketing channel?",
    body: "Full-funnel thinking doesn't require a full channel lineup. Start with the tactics your budget and objectives support. Measure their contribution, then adjust.",
  },
]

/** Both loops in one orientation. Decorative: the structure is in the text beside it. */
function LoopArt({ orientation }: { orientation: "tall" | "wide" }) {
  // tall: loops stacked, overlap is the middle band; wide: side by side.
  const [a, b] =
    orientation === "tall"
      ? [{ cx: 50, cy: 33, rx: 50, ry: 33 }, { cx: 50, cy: 67, rx: 50, ry: 33 }]
      : [{ cx: 33, cy: 50, rx: 33, ry: 50 }, { cx: 67, cy: 50, rx: 33, ry: 50 }]
  const clipId = `pm-clip-${orientation}`
  const svg = { viewBox: "0 0 100 100", preserveAspectRatio: "none", focusable: "false" } as const

  return (
    <div className={`${styles.art} ${orientation === "tall" ? styles.artTall : styles.artWide}`} aria-hidden="true">
      {/* Two copies of the plate carry the two halves of the light. */}
      <svg {...svg} className={`${styles.plate} ${styles.plateHi}`}>
        <ellipse {...a} />
        <ellipse {...b} />
      </svg>
      <svg {...svg} className={`${styles.plate} ${styles.plateLo}`}>
        <ellipse {...a} />
        <ellipse {...b} />
      </svg>
      <svg {...svg} className={styles.seam}>
        <ellipse className={styles.ring} {...a} />
        <ellipse className={styles.ring} {...b} />
        <ellipse className={`${styles.flow} ${styles.flowCreation}`} {...a} />
        <ellipse className={`${styles.flow} ${styles.flowCapture}`} {...b} />
      </svg>
      <svg {...svg} className={styles.lift}>
        <defs>
          <clipPath id={clipId}>
            <ellipse {...a} />
          </clipPath>
        </defs>
        <ellipse className={styles.lens} {...b} clipPath={`url(#${clipId})`} />
      </svg>
    </div>
  )
}

export default function PerformanceMarketingPage() {
  return (
    <main className={styles.page}>
      <div className={`${styles.wrap} ${styles.hero}`}>
        <h1 className={`t-display-l ${styles.display}`}>Demand Drives Performance.</h1>
        <p className={`t-display-s ${styles.display} ${styles.statement}`}>
          Performance Marketing{" "}
          <span className={styles.nowrap}>
            <span className={styles.ne}>≠</span> PPC.
          </span>
        </p>
        <p className={`t-body-xl ${styles.lede}`}>
          Just because someone is in the market doesn&apos;t mean they&apos;re in the market for you.{" "}
          <strong>Better acquisition economics begin before the click.</strong>
        </p>

        <figure className={styles.system} aria-labelledby="pm-system-caption">
          <div className={styles.loops}>
            <LoopArt orientation="tall" />
            <LoopArt orientation="wide" />

            <div className={`${styles.fn} ${styles.creation}`}>
              <h2 className="t-heading-m">Demand Creation</h2>
              <p className={`t-body ${styles.what}`}>Grow awareness and preference.</p>
              <p className={`t-label ${styles.label}`}>Representative tactics</p>
              <ul className={styles.chips}>
                <li className="t-body-s">Broadcast Media</li>
                <li className="t-body-s">Sponsorships</li>
              </ul>
            </div>

            <div className={styles.core}>
              <p className={styles.srOnly}>Connecting both:</p>
              <ol className="t-heading-s" aria-label="Measure, learn, reinvest">
                <li>Measure</li>
                <li>
                  <span className={styles.arrow} aria-hidden="true">↓</span> Learn
                </li>
                <li>
                  <span className={styles.arrow} aria-hidden="true">↓</span> Reinvest
                </li>
              </ol>
            </div>

            <div className={`${styles.fn} ${styles.capture}`}>
              <h2 className="t-heading-m">Demand Capture</h2>
              <p className={`t-body ${styles.what}`}>Convert active intent.</p>
              <p className={`t-label ${styles.label}`}>Representative tactics</p>
              <ul className={styles.chips}>
                <li className="t-body-s">Paid Search</li>
                <li className="t-body-s">Conversion Optimization</li>
              </ul>
            </div>
          </div>
          <figcaption id="pm-system-caption" className={`t-body-l ${styles.caption}`}>
            Performance is measured across the <span className={styles.nowrap}>system—not</span> defined by a
            single tactic.
          </figcaption>
        </figure>
      </div>

      <section className={`${styles.wrap} ${styles.why}`} aria-label="Explanation">
        <p className="t-body-l">
          Capturing existing demand can generate sales. Creating demand can expand future opportunity and improve the
          conditions for conversion. The right strategy connects both, measures what works, and directs investment
          where it can create the greatest value.
        </p>

        <div className={styles.points}>
          {POINTS.map((point) => (
            <details key={point.title} className={styles.point}>
              <summary>
                <h2 className="t-heading-s">{point.title}</h2>
                <span className={styles.sign} aria-hidden="true" />
              </summary>
              <p className="t-body">{point.body}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}
