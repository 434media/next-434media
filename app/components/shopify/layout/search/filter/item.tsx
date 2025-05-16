"use client"

import clsx from "clsx"
import type { SortFilterItem } from "../../../../../lib/constants"
import { createUrl } from "../../../../../lib/utils"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

export default function FilterItem({ item }: { item: SortFilterItem }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get("sort") === item.slug
  const q = searchParams.get("q")
  const href = createUrl(
    pathname,
    new URLSearchParams({
      ...(q && { q }),
      ...(item.slug && { sort: item.slug }),
    }),
  )
  const DynamicTag = active ? "p" : Link

  return (
    <li className="mt-2 flex text-sm text-gray-400" key={item.slug}>
      <DynamicTag
        href={href}
        className={clsx("w-full hover:text-gray-800 dark:hover:text-gray-100", {
          "text-gray-600 dark:text-gray-400": !active,
          "font-semibold text-black dark:text-white": active,
        })}
      >
        {item.title}
      </DynamicTag>
    </li>
  )
}
