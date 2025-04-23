import type { Metadata } from "next"
import SDOHClientPage from "./SDOHClientPage"
import { FadeIn } from "../components/FadeIn"

export const metadata: Metadata = {
  title: "¿Qué es SDOH? | Social Determinants of Health Panel",
  description:
    "Join us for a panel discussion on Social Determinants of Health (SDOH) during RGV Startup Week. Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.",
  openGraph: {
    title: "¿Qué es SDOH? | Social Determinants of Health Panel",
    description:
      "Join us for a panel discussion on Social Determinants of Health (SDOH) during RGV Startup Week. Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.",
    images: ["/images/sdoh/sdoh-og-image.jpg"],
  },
}

export default function SDOHPage() {
  return (
    <FadeIn>
      <main className="min-h-screen bg-white">
        <SDOHClientPage />
      </main>
    </FadeIn>
  )
}
