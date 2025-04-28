import type React from "react"
import "../globals.css"
import "remixicon/fonts/remixicon.css"
import { i18n } from "../../i18n-config"




// Generate static params for all supported locales
export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
   
      <div
        className="antialiased min-h-screen flex flex-col"
      >
        {children}
      </div>
  )
}
