import Image from "next/image"
import { isOptimizableImage } from "@/lib/image-hosts"

/**
 * A Feed image filling its positioned parent. Feed URLs are authored in
 * /admin/feed-form and can point anywhere; next/image throws on a host that is
 * not in REMOTE_IMAGE_PATTERNS, so an unlisted host is rendered as a plain
 * <img> instead of taking the page down. lib/thefeed.ts has already dropped
 * anything that is not http(s).
 */
export function FeedImage({
  src,
  alt,
  sizes,
  className,
  priority,
  unoptimized,
}: {
  src: string
  alt: string
  sizes?: string
  className?: string
  priority?: boolean
  unoptimized?: boolean
}) {
  if (isOptimizableImage(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} unoptimized={unoptimized} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- host not in REMOTE_IMAGE_PATTERNS
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className ?? ""}`}
    />
  )
}
