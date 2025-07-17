"use client"

import { GridTileImage } from "../grid/tile"
import { useProduct, useUpdateURL } from "./product-context"
import Image from "next/image"
import { motion } from "motion/react"
import clsx from "clsx"

export function Gallery({ images }: { images: { src: string; altText: string }[] }) {
  const { state, updateImage } = useProduct()
  const updateURL = useUpdateURL()
  const imageIndex = state.image ? Number.parseInt(state.image) : 0

  const nextImageIndex = imageIndex + 1 < images.length ? imageIndex + 1 : 0
  const previousImageIndex = imageIndex === 0 ? images.length - 1 : imageIndex - 1

  const buttonClassName =
    "h-full px-4 transition-all ease-in-out hover:scale-110 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black border-2 border-white bg-black text-white hover:bg-white hover:text-black font-black"

  return (
    <form>
      <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden">
        {images[imageIndex] && (
          <motion.div
            key={imageIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full w-full relative"
          >
            <Image
              className="h-full w-full object-contain bg-black"
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              alt={images[imageIndex]?.altText as string}
              src={(images[imageIndex]?.src as string) || "/placeholder.svg"}
              priority={true}
            />

            {/* TXMX-style overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          </motion.div>
        )}

        {images.length > 1 ? (
          <div className="absolute bottom-6 left-0 right-0 flex w-full justify-center">
            <div className="mx-auto flex h-12 items-center border-2 border-white bg-black text-white backdrop-blur-sm">
              <button
                formAction={() => {
                  const newState = updateImage(previousImageIndex.toString())
                  updateURL(newState)
                }}
                aria-label="Previous product image"
                className={buttonClassName}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="mx-1 h-8 w-px bg-white"></div>
              <button
                formAction={() => {
                  const newState = updateImage(nextImageIndex.toString())
                  updateURL(newState)
                }}
                aria-label="Next product image"
                className={buttonClassName}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-3 overflow-auto py-1 lg:mb-0">
          {images.map((image, index) => {
            const isActive = index === imageIndex

            return (
              <li key={image.src} className="h-20 w-20">
                <button
                  formAction={() => {
                    const newState = updateImage(index.toString())
                    updateURL(newState)
                  }}
                  aria-label={`Select product image ${index + 1}`}
                  className={clsx("h-full w-full border-2 transition-all duration-300 relative overflow-hidden group", {
                    "border-white bg-white": isActive,
                    "border-white/50 bg-black hover:border-white": !isActive,
                  })}
                >
                  {!isActive && (
                    <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  )}
                  <div className="relative z-10">
                    <GridTileImage
                      alt={image.altText}
                      src={image.src}
                      width={80}
                      height={80}
                      active={isActive}
                      className={
                        isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                      }
                    />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </form>
  )
}
