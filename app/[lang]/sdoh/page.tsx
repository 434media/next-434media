import { getDictionary } from "@/app/lib/dictionary"
import type { Locale } from "@/i18n-config"
import { LanguageProvider } from "@/app/context/language-context"
import SDOHClientPage from "./SDOHClientPage"
import type { Metadata } from "next"

// Accept params possibly as a Promise (Next may supply a thenable) and await inside.
export async function generateMetadata(props: { params: Promise<{ lang: Locale }> | { lang: Locale } }): Promise<Metadata> {
  const awaited = 'then' in props.params ? await props.params : props.params
  const { lang } = awaited
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"
  const isSpanish = lang === 'es'
  const title = isSpanish ? '¿Qué es SDOH? Salud Comunitaria y Determinantes Sociales de la Salud' : 'What is SDOH? Community Health & Social Determinants of Health'
  const description = isSpanish
    ? 'Aprende sobre los determinantes sociales de la salud (SDOH) y cómo impactan el bienestar comunitario. Recursos, eventos y oportunidades.'
    : 'Learn about Social Determinants of Health (SDOH) and how they impact community well-being. Resources, events, and opportunities.'
  return {
    title: `${title} | 434 MEDIA`,
    description,
    alternates: {
      canonical: `${baseUrl}/${lang}/sdoh`,
      languages: {
        'en-US': `${baseUrl}/en/sdoh`,
        'es-ES': `${baseUrl}/es/sdoh`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${lang}/sdoh`,
      siteName: '434 MEDIA',
      type: 'website',
      images: [
        {
          url: `${baseUrl}/opengraph-image.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}/opengraph-image.png`],
    },
  }
}

export default async function SDOHPage(props: { params: Promise<{ lang: Locale }> | { lang: Locale } }) {
  const awaited = 'then' in props.params ? await props.params : props.params
  const { lang } = awaited
  const dictionary = await getDictionary(lang)

  return (
    <LanguageProvider dictionary={dictionary} locale={lang}>
      <SDOHClientPage />
    </LanguageProvider>
  )
}
