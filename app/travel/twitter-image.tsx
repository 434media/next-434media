// Next parses `runtime`, `size` and `contentType` statically, so they must be
// declared here rather than re-exported — a re-export fails the build with
// "Next.js can't recognize the exported `runtime` field in route."
import OpengraphImage, { alt as opengraphAlt } from "./opengraph-image"

export const runtime = "nodejs"
export const alt = opengraphAlt
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default OpengraphImage
