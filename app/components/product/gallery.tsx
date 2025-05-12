"use client"

import { GridTileImage } from "../../components/grid/tile"
import { useProduct, useUpdateURL } from "./product-context"
import Image from "next/image"
import { motion } from "motion/react"

export function Gallery({ images }: { images: { src: string; altText: string }[] }) {
  const { state, updateImage } = useProduct()
  const updateURL = useUpdateURL()
  const imageIndex = state.image ? Number.parseInt(state.image) : 0

  const nextImageIndex = imageIndex + 1 < images.length ? imageIndex + 1 : 0
  const previousImageIndex = imageIndex === 0 ? images.length - 1 : imageIndex - 1

  const buttonClassName =
    "h-full px-4 transition-all ease-in-out hover:scale-110 hover:text-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black"

  return (
    <form>
      <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden rounded-lg">
        {images[imageIndex] && (
          <motion.div
            key={imageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <Image
              className="h-full w-full object-contain"
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              alt={images[imageIndex]?.altText as string}
              src={(images[imageIndex]?.src as string) || "/placeholder.svg"}
              priority={true}
            />
          </motion.div>
        )}

        {images.length > 1 ? (
          <div className="absolute bottom-4 left-0 right-0 flex w-full justify-center">
            <div className="mx-auto flex h-10 items-center rounded-full border border-neutral-700 bg-black/80 text-neutral-400 backdrop-blur-sm">
              <button
                formAction={() => {
                  const newState = updateImage(previousImageIndex.toString())
                  updateURL(newState)
                }}
                aria-label="Previous product image"
                className={buttonClassName}
              >
                <i className="ri-arrow-left-s-line h-5 w-5" aria-hidden="true"></i>
              </button>
              <div className="mx-1 h-5 w-px bg-neutral-700"></div>
              <button
                formAction={() => {
                  const newState = updateImage(nextImageIndex.toString())
                  updateURL(newState)
                }}
                aria-label="Next product image"
                className={buttonClassName}
              >
                <i className="ri-arrow-right-s-line h-5 w-5" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-2 overflow-auto py-1 lg:mb-0">
          {images.map((image, index) => {
            const isActive = index === imageIndex

            return (
              <li key={image.src} className="h-16 w-16">
                <button
                  formAction={() => {
                    const newState = updateImage(index.toString())
                    updateURL(newState)
                  }}
                  aria-label={`Select product image ${index + 1}`}
                  className="h-full w-full"
                >
                  <GridTileImage alt={image.altText} src={image.src} width={64} height={64} active={isActive} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </form>
  )
}