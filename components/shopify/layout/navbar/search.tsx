"use client"

import Form from "next/form"
import { useSearchParams } from "next/navigation"
import { Search as SearchIcon } from "lucide-react"

export default function Search() {
  const searchParams = useSearchParams()

  return (
    <Form action="/search" className="w-max-[550px] relative w-full lg:w-80 xl:w-full">
      <input
        key={searchParams?.get("q")}
        type="text"
        name="q"
        placeholder="Search for products..."
        autoComplete="off"
        defaultValue={searchParams?.get("q") || ""}
        className="text-md w-full rounded-lg border border-neutral-700 bg-black/50 px-4 py-2 text-white placeholder:text-neutral-400 md:text-sm"
      />
      <div className="absolute right-0 top-0 mr-3 flex h-full items-center text-white">
        <SearchIcon className="h-4 w-4" aria-hidden="true" />
      </div>
    </Form>
  )
}

export function SearchSkeleton() {
  return (
    <form className="w-max-[550px] relative w-full lg:w-80 xl:w-full">
      <input
        placeholder="Search for products..."
        className="w-full rounded-lg border border-neutral-700 bg-black px-4 py-2 text-sm text-white placeholder:text-neutral-400"
      />
      <div className="absolute right-0 top-0 mr-3 flex h-full items-center">
        <SearchIcon className="h-4 w-4" aria-hidden="true" />
      </div>
    </form>
  )
}