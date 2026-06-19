import type { Metadata } from "next"
import { UnderwriterIntakeClient } from "./UnderwriterIntakeClient"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  title: "Underwriter Intake | Digital Canvas",
  description:
    "Submit a real operational problem to the Digital Canvas Builder Program. We turn venture-credible industry pain points into builder challenges for our cohorts.",
  alternates: { canonical: "/underwriter-intake" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Underwriter Intake | Digital Canvas",
    description:
      "Submit a real operational problem to the Digital Canvas Builder Program.",
    url: `${siteUrl}/underwriter-intake`,
  },
}

export default function UnderwriterIntakePage() {
  return (
    <main className="min-h-dvh bg-white text-gray-900 pt-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
        <p className="font-geist-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 mb-3">
          Digital Canvas · Underwriter Intake
        </p>
        <h1 className="font-ggx88 font-black text-4xl sm:text-5xl text-gray-900 leading-[0.95] tracking-tighter mb-4">
          Bring us a real problem.
        </h1>
        <p className="font-geist-sans text-base text-gray-500 leading-relaxed max-w-xl mb-8">
          Digital Canvas turns the operational problems your organization actually faces into challenges our builder
          cohorts solve. The more specific and venture-credible the pain, the better the build. Tell us what's broken.
        </p>
        <UnderwriterIntakeClient />
      </div>
    </main>
  )
}
