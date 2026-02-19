import type React from "react"
import clsx from "clsx"
import Image from "next/image"
import Label from "../label"

export function GridTileImage({
  isInteractive = true,
  active,
  label,
  ...props
}: {
  isInteractive?: boolean
  active?: boolean
  label?: {
    title: string
    amount: string
    currencyCode: string
    position?: "bottom" | "center"
  }
} & React.ComponentProps<typeof Image>) {
  return (
    <div
      className={clsx(
        "group flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-neutral-900 hover:border-emerald-600",
        {
          relative: label,
          "border-2 border-emerald-600": active,
          "border-neutral-700": !active,
          "transition-all duration-300": isInteractive,
        },
      )}
    >
      {props.src ? (
        <Image
          className={clsx("relative h-full w-full object-contain", {
            "transition duration-300 ease-in-out group-hover:scale-105": isInteractive,
          })}
          {...{
            ...props,
            alt: props.alt || label?.title || "Product image",
          }}
        />
      ) : null}
      {label ? (
        <Label title={label.title} amount={label.amount} currencyCode={label.currencyCode} position={label.position} />
      ) : null}
    </div>
  )
}
