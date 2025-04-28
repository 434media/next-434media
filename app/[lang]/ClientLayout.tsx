"use client"

import type React from "react"
import { useEffect } from "react"
import { i18n } from "../../i18n-config"

export default function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  // Ensure lang is a valid locale
  const lang = i18n.locales.includes(params.lang as any) ? params.lang : i18n.defaultLocale

  // Set language in document
  useEffect(() => {
    // Don't modify the DOM directly in useEffect to avoid hydration mismatches
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`
  }, [lang])

  return <>{children}</>
}
