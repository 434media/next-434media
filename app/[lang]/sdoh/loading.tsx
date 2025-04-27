import type { Metadata } from "next"
import SDOHClientPage from "./SDOHClientPage"
import { getDictionary } from "../../lib/dictionary"
import type { Locale } from "../../../i18n-config"
import ClientLayout from "../ClientLayout"

type Props = {
  params: { lang: Locale }
}

// Generate metadata at build time
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Get the dictionary for the current locale
  const dict = await getDictionary(params.lang)

  return {
    title: dict.sdoh?.title || "¿Qué es SDOH? | Social Determinants of Health Panel",
    description:
      dict.sdoh?.intro1 ||
      "Join us for a panel discussion on Social Determinants of Health (SDOH) during RGV Startup Week. Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.",
    openGraph: {
      title: dict.sdoh?.title || "¿Qué es SDOH? | Social Determinants of Health Panel",
      description:
        dict.sdoh?.intro1 ||
        "Join us for a panel discussion on Social Determinants of Health (SDOH) during RGV Startup Week. Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.",
      images: ["/images/sdoh/sdoh-og-image.jpg"],
    },
  }
}

export default async function SDOHPage({ params }: Props) {
  // Get the dictionary for the current locale
  const dict = await getDictionary(params.lang)

  return (
    <ClientLayout params={{ lang: params.lang }}>
      <main className="min-h-screen bg-white">
        <SDOHClientPage lang={params.lang} dict={dict} />
      </main>
    </ClientLayout>
  )
}
