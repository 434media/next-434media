"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

export function FilterItem({
  item,
}: {
  item:
    | {
        title: string
        path: string
      }
    | {
        title: string
        slug: string
      }
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if ("path" in item) {
      const itemPath = item.path.split("?")[0]
      setActive(pathname === itemPath)
    } else {
      setActive(searchParams.get("sort") === item.slug)
    }
  }, [pathname, searchParams, item])

  if ("path" in item) {
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

  function clsx(...classes: any[]) {
    return classes.filter(Boolean).join(" ")
  }

  return (
    <div className="w-full">
      <Link
        href={{
          pathname,
          query: {
            sort: item.slug,
          },
        }}
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
