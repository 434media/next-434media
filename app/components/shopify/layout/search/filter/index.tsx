import type { SortFilterItem } from "../../../../../lib/constants"
import { Suspense } from "react"
import FilterItemDropdown from "./dropdown"
import { FilterItem } from "./item"

export type ListItem = SortFilterItem | PathFilterItem
export type PathFilterItem = { title: string; path: string }

function FilterItemList({ list }: { list: ListItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {list.map((item: ListItem, i) => (
        <FilterItem key={i} item={item} />
      ))}
    </div>
  )
}

export default function FilterList({ list, title }: { list: ListItem[]; title?: string }) {
  return (
    <nav className="w-full">
      {title ? <h3 className="text-base font-semibold text-white mb-4 uppercase tracking-wider">{title}</h3> : null}
      <div className="hidden md:block">
        <Suspense fallback={null}>
          <FilterItemList list={list} />
        </Suspense>
      </div>
      <div className="md:hidden">
        <Suspense fallback={null}>
          <FilterItemDropdown list={list} />
        </Suspense>
      </div>
    </nav>
  )
}