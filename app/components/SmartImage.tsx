"use client"

import Image, { ImageProps } from "next/image"

export type SmartImageProps = ImageProps & {
  responsiveSizes?: string
  forceUnoptimized?: boolean
  decorative?: boolean
}

/**
 * SmartImage wrapper:
 * - Disables optimization automatically for animated GIFs
 * - Supplies default responsive sizes for fill images
 * - Adds tiny blur placeholder if none provided
 * - Handles decorative images accessibly
 */
export function SmartImage({
  alt,
  decorative,
  responsiveSizes = "(min-width:1280px) 800px, (min-width:1024px) 600px, (min-width:640px) 50vw, 100vw",
  forceUnoptimized,
  placeholder,
  blurDataURL,
  fill,
  sizes,
  ...rest
}: SmartImageProps) {
  const src = typeof rest.src === "string" ? rest.src : (rest.src as any).src
  const isAnimated = typeof src === "string" && src.toLowerCase().endsWith(".gif")
  const effectiveAlt = decorative ? "" : alt
  const effectivePlaceholder = placeholder || "blur"
  const effectiveBlur =
    blurDataURL ||
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFgwJ/lEnTkwAAAABJRU5ErkJggg=="

  return (
    <Image
      alt={effectiveAlt as string}
      aria-hidden={decorative ? true : undefined}
      unoptimized={forceUnoptimized || isAnimated}
      fill={fill}
      sizes={fill ? sizes || responsiveSizes : sizes}
      placeholder={effectivePlaceholder}
      blurDataURL={effectivePlaceholder === "blur" ? effectiveBlur : blurDataURL}
      {...rest}
    />
  )
}

export default SmartImage
