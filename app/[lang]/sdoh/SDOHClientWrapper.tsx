"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import type { Locale } from "../../../i18n-config"

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Loading SDOH Page...</h1>
        <p className="mt-4">Please wait while we load the content.</p>
      </div>
    </div>
  )
}

// Dynamically import the client page with no SSR
const SDOHClientPageDynamic = dynamic(() => import("./SDOHClientPage"), {
  ssr: false,
  loading: () => <LoadingFallback />,
})

interface SDOHClientWrapperProps {
  lang: Locale
}

export default function SDOHClientWrapper({ lang }: SDOHClientWrapperProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SDOHClientPageDynamic lang={lang} />
    </Suspense>
  )
}
