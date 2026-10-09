import type { MetaDestination, MetaManifest } from "./owned-meta-publisher"

// Publisher-only pin; existing analytics stay on their existing version.
export const OWNED_META_GRAPH_VERSION = "v26.0"
export const FORMAT_REVIEWED_AT = "2026-10-09"
export const FORMAT_SOURCES = {
  instagram: "https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media",
  instagramPublishing: "https://developers.facebook.com/documentation/instagram-platform/content-publishing",
  instagramAI: "https://developers.facebook.com/documentation/instagram-platform/changelog#ai-info-label",
  facebookPhotos: "https://developers.facebook.com/docs/graph-api/reference/page/photos/",
  facebookReels: "https://developers.facebook.com/documentation/video-api/guides/reels-publishing",
  facebookVideos: "https://developers.facebook.com/docs/graph-api/reference/page/videos/",
} as const

/** Reviewed constraints, never caller/environment policy. MB uses conservative decimal bytes. */
export const META_FORMAT_RULES = {
  instagramImage: { mimeTypes: ["image/jpeg"], maxBytes: 8_000_000, minAspect: 4/5, maxAspect: 1.91 },
  instagramCarousel: { maxItems: 10 },
  instagramReel: { mimeTypes: ["video/mp4"], maxBytes: 300_000_000, minAspect: 0.01, maxAspect: 10, maxWidth: 1920, minDuration: 3, maxDuration: 900, minFps: 23, maxFps: 60 },
  facebookPhoto: { mimeTypes: ["image/jpeg", "image/png"], maxBytes: 10_000_000 },
  facebookReel: { mimeTypes: ["video/mp4"], aspect: 9/16, minWidth: 540, minHeight: 960, minDuration: 3, maxDuration: 90, minFps: 24, maxFps: 60 },
} as const

/**
 * These checks cover measured bytes/dimensions/duration. Meta also specifies codec,
 * audio, frame-rate and encoding requirements; see the dated sources. We do not
 * claim that the small byte parser verifies GOP/chroma/audio. Meta processing and
 * the separately approved first-live format test remain authoritative for those.
 *
 * IG image widths outside 320–1440 are automatically resized by Meta, not described
 * as rejected. FB ordinary-video size/duration, FB multi-photo count and distinct
 * IG carousel-video limits were not established by the inspected references:
 * there is deliberately no invented numeric limit for those cases. MP4/JPEG/PNG
 * are this adapter's measurable subset, not a claim that Meta rejects other types.
 */
export function checkReviewedFormat(m: MetaManifest, destination: MetaDestination): string | null {
  if(m.destinations.apiVersion!==OWNED_META_GRAPH_VERSION)return "Prepare a new review for the code-reviewed publishing API version"
  if(destination==="instagram") {
    if(m.format==="carousel"&&m.assets.length>META_FORMAT_RULES.instagramCarousel.maxItems)return "Instagram permits at most 10 carousel items"
    for(const asset of m.assets){
      if(asset.mime!=="video/mp4"){
        const rule=META_FORMAT_RULES.instagramImage,aspect=asset.width/asset.height
        if(asset.mime!=="image/jpeg"||asset.size>rule.maxBytes||aspect<rule.minAspect||aspect>rule.maxAspect)return "Instagram API images require JPEG, at most 8 MB and aspect 4:5–1.91:1; use a newly approved export, not a silent conversion"
      }
    }
    if(m.format==="video") {
      const a=m.assets[0],r=META_FORMAT_RULES.instagramReel,aspect=a.width/a.height
      if(a.mime!=="video/mp4"||a.size>r.maxBytes||a.width>r.maxWidth||aspect<r.minAspect||aspect>r.maxAspect||!a.duration||a.duration<r.minDuration||a.duration>r.maxDuration)return "Instagram Reel export is outside the reviewed MP4, 300 MB, 1920 px, 3–900 s or aspect limits"
    }
    if(m.format==="carousel") {
      const first=m.assets[0].width/m.assets[0].height
      if(m.assets.some(a=>Math.abs(a.width/a.height-first)>0.001))return "Instagram may crop later carousel items to the first item's aspect; approve matching exports before automated publication"
    }
    // Official June 22, 2026 changelog: AI parameter on media creation, carousel parent only.
    return null
  }
  if(m.format!=="video"){
    if(m.assets.some(a=>a.mime==="video/mp4"))return "Facebook organic multi-photo posts require stills; approve a different rendition"
    if(m.assets.some(a=>a.size>META_FORMAT_RULES.facebookPhoto.maxBytes))return "Facebook photos cannot exceed 10 MB"
    if(m.aiGenerated)return "Facebook photo/feed AI labeling is unverified; use manual platform handling for this post"
    return null
  }
  if(m.placements.facebook==="reels") {
    const a=m.assets[0],r=META_FORMAT_RULES.facebookReel
    if(a.width*r.minHeight!==a.height*r.minWidth||a.width<r.minWidth||a.height<r.minHeight||!a.duration||a.duration<r.minDuration||a.duration>r.maxDuration)return "Facebook Reel requires 9:16, at least 540×960 and 3–90 s; a changed rendition needs new approval"
    // Official guide Step 3 / Page Video Reels Quick Reference documents the AI flag on finish.
    return null
  }
  // SDK exposes this on ordinary /videos, but the inspected endpoint reference did
  // not confirm the disclosure behavior. This holds only that AI placement.
  return m.aiGenerated ? "Ordinary Facebook video AI labeling needs manual handling; the reviewed automatic AI path is Reels" : null
}
