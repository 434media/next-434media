"use client"

import { ContactForm } from "@/components/ContactForm"
import { BRAND_RECORDS } from "@/lib/brand-records"

/**
 * /contact, in the Work page's grammar (app/(site)/work/redesign).
 *
 * It used to be its own world: a dotted canvas on a grey gradient, an even
 * two-column split, and the form in a bordered card floating on it. Home and
 * Work are flat, uncarded and edge to edge, and Work sets its type on a 1.2 : 1
 * grid. This page now takes the same opening (headline left, the definition
 * right, the same padding and split) and the form follows as numbered
 * sections, exactly like Work's "01 / Original IP" headers, so the two pages
 * read as one site.
 */
export function ContactPageClient() {
  return (
    <div className="min-h-dvh bg-(--434-white) text-(--434-color-02-black) pt-(--site-header-h)">
      {/* Opening: Work's .opening. Stacked with 28px / 24px padding, two
          columns and 40px from 680px, 1.2 : 1 from 1000px. */}
      <div className="grid items-center gap-4 px-6 py-7 type:grid-cols-2 type:gap-10 type:p-10 min-[1000px]:grid-cols-[1.2fr_1fr]">
        <div className="@container">
          {/* Display L is sized to the viewport, but in a column it has to fit
              the column: "production." is 8.62em in Menda, so 11.4cqi fits the
              word with ~2% to spare. Never larger than Display L (3.0). */}
          <h1
            className="t-display-l m-0"
            style={{
              fontSize: "clamp(28px, min(11.4cqi, var(--434-type-display-l-size)), 72px)",
              lineHeight: 0.92,
            }}
          >
            Start a production.
          </h1>
        </div>

        {/* Master 1.1, verbatim. Never reword, shorten or split it. */}
        <p className="t-body type:t-body-l m-0 text-balance">{BRAND_RECORDS.canonicalDefinition}</p>
      </div>

      <ContactForm />
    </div>
  )
}
