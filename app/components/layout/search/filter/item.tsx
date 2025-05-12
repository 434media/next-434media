"use client"

import clsx from "clsx"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { ListItem } from "."
import { useEffect, useState } from "react"

export function FilterItem({ item }: { item: ListItem }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const newParams = new URLSearchParams(searchParams.toString())

  useEffect(() => {
    if ("path" in item) {
      const itemPath = item.path.split("?")[0]
      setActive(pathname === itemPath)
    } else {
      setActive(searchParams.get("sort") === item.slug)
    }
  }, [pathname, searchParams, item])

  if ("path" in item) {
    const itemPath = item.path.split("?")[0]

    return (
      <div className="w-full">
        <Link
          href={item.path}
          className={clsx("block w-full px-4 py-2 text-sm font-medium rounded-md transition-colors", {
            "bg-emerald-600 text-white hover:bg-emerald-500": active,
            "bg-neutral-700 text-white hover:bg-neutral-600": !active,
          })}
        >
          {item.title}
        </Link>
      </div>
    )
  }

  newParams.set("sort", item.slug ?? "")

  return (
    <div className="w-full">
      <Link
        href={`${pathname}?${newParams.toString()}`}
        className={clsx("block w-full px-4 py-2 text-sm font-medium rounded-md transition-colors", {
          "bg-emerald-600 text-white hover:bg-emerald-500": active,
          "bg-neutral-700 text-white hover:bg-neutral-600": !active,
        })}
      >
        {item.title}
      </Link>
    </div>
  )
}