import type React from "react"
import { Geist, Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import "../globals.css"
import "remixicon/fonts/remixicon.css"
import { i18n } from "../../i18n-config"




// Generate static params for all supported locales
export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  return (
   
      <div
        className="antialiased min-h-screen flex flex-col"
      >
        {children}
      </div>
  )
}
