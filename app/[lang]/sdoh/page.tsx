import { i18n } from "../../../i18n-config"
import SDOHClientWrapper from "./SDOHClientWrapper"

// Force static rendering with client-side navigation
export const dynamic = "error"
export const dynamicParams = false

// Pre-render all supported locales at build time
export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// Simplified page component that doesn't rely on params for initial render
export default function SDOHPage() {
  return <SDOHClientWrapper />
}
