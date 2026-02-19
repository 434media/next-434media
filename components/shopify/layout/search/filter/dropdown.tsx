"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { ListItem } from "."
import { FilterItem } from "./item"

export default function FilterItemDropdown({ list }: { list: ListItem[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState("")
  const [openSelect, setOpenSelect] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpenSelect(false)
      }
    }

    window.addEventListener("click", handleClickOutside)
    return () => window.removeEventListener("click", handleClickOutside)
  }, [])

  useEffect(() => {
    list.forEach((item) => {
      if ("path" in item) {
        if (pathname === item.path) setActive(item.title)
      } else if (searchParams.get("sort") === item.slug) {
        setActive(item.title)
      }
    })
  }, [pathname, searchParams, list])

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => {
          setOpenSelect(!openSelect)
        }}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-white bg-neutral-700 rounded-md cursor-pointer"
      >
        <div>{active || "Select option"}</div>
        <ChevronDown className={`w-4 transition-transform ${openSelect ? "rotate-180" : ""}`} />
      </div>
      {openSelect && (
        <div className="absolute z-40 w-full p-2 mt-1 bg-neutral-800 rounded-md shadow-lg">
          <div className="flex flex-col gap-2">
            {list.map((item: ListItem, i) => (
              <div
                key={i}
                onClick={() => {
                  setOpenSelect(false)
                }}
              >
                <FilterItem item={item} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}