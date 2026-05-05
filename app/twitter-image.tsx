import OpengraphImage from "./opengraph-image"
import { BRAND } from "@/lib/seo/brand"

export const runtime = "nodejs"
export const alt = `${BRAND.name} — ${BRAND.shortTagline} ${BRAND.description}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default OpengraphImage
