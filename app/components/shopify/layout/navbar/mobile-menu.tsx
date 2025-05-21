"use client"

import { Dialog, Transition, DialogPanel, TransitionChild } from "@headlessui/react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Fragment, Suspense, useEffect, useState } from "react"

import type { Menu } from "../../../../lib/shopify/types"
import Search, { SearchSkeleton } from "./search"

export default function MobileMenu({ menu }: { menu: Menu[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const openMobileMenu = () => setIsOpen(true)
  const closeMobileMenu = () => setIsOpen(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isOpen])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname, searchParams])

  return (
    <>
      <button
        onClick={openMobileMenu}
        aria-label="Open mobile menu"
        className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-700 text-white transition-colors md:hidden"
      >
        <i className="ri-menu-line h-4 w-4" aria-hidden="true"></i>
      </button>
      <Transition show={isOpen}>
        <Dialog onClose={closeMobileMenu} className="relative z-50">
          <TransitionChild
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="opacity-0 backdrop-blur-none"
            enterTo="opacity-100 backdrop-blur-[.5px]"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="opacity-100 backdrop-blur-[.5px]"
            leaveTo="opacity-0 backdrop-blur-none"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </TransitionChild>
          <TransitionChild
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="translate-x-[-100%]"
            enterTo="translate-x-0"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-[-100%]"
          >
            <DialogPanel className="fixed bottom-0 left-0 right-0 top-0 flex h-full w-full flex-col bg-black pb-6">
              <div className="p-4">
                <button
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-neutral-700 text-white transition-colors"
                  onClick={closeMobileMenu}
                  aria-label="Close mobile menu"
                >
                  <i className="ri-close-line h-6 w-6" aria-hidden="true"></i>
                </button>

                <div className="mb-4 w-full">
                  <Suspense fallback={<SearchSkeleton />}>
                    <Search />
                  </Suspense>
                </div>
                {menu.length ? (
                  <ul className="flex w-full flex-col">
                    {menu.map((item: Menu) => (
                      <li className="py-2 text-xl text-white transition-colors hover:text-neutral-500" key={item.title}>
                        <Link href={item.path} prefetch={true} onClick={closeMobileMenu}>
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </>
  )
}