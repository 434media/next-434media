"use client"

import Link from "next/link"
import type { Locale } from "../../../i18n-config"

export default function SDOHLanguageToggle({ currentLocale }: { currentLocale: Locale }) {
  return (
    <div className="bg-white p-2 rounded shadow-md">
      <div className="flex gap-2">
        <Link
          href="/en/sdoh"
          className={`px-3 py-1 rounded ${currentLocale === "en" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
        >
          EN
        </Link>
        <Link
          href="/es/sdoh"
          className={`px-3 py-1 rounded ${currentLocale === "es" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
        >
          ES
        </Link>
      </div>
    </div>
  )
}
