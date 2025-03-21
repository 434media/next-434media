"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useState, useRef } from "react"
import { ScrambleText } from "./ScrambleText"
import { ContactForm } from "./ContactForm"

interface NavMenuProps {
  isOpen: boolean
  onClose: () => void
  id?: string
}

export default function NavMenu({ isOpen, onClose, id = "nav-menu" }: NavMenuProps) {
  const [menuMounted, setMenuMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const renderMenuItems = useCallback(() => {
    const items = [
      "Discuss a ROI-driven media strategy",
      "Explore our brand storytelling services",
      "Get a quote for video or event production",
    ]

    return items.map((item, index) => (
      <motion.li
        key={index}
        className="flex items-start gap-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 * index }}
      >
        <i className="ri-check-line h-5 w-5 flex-none text-emerald-500 mt-1" aria-hidden="true" />
        <span className="flex-1">{item}</span>
      </motion.li>
    ))
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "hidden"
      // Set a small delay to ensure the menu is visible in the DOM
      setTimeout(() => {
        setMenuMounted(true)
      }, 100)
    } else {
      document.body.style.overflow = "unset"
      setMenuMounted(false)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-menu-title"
          id={id}
        >
          <div className="relative w-full h-full">
            <div className="absolute inset-0 md:grid md:grid-cols-2">
              <motion.div
                ref={menuRef}
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 36, stiffness: 300 }}
                className="relative h-full bg-white overflow-y-auto shadow-2xl"
              >
                <div className="p-4 md:p-8 h-full flex flex-col">
                  <header className="flex justify-between items-center mb-8">
                    <Link
                      href="/"
                      className="text-2xl font-menda-black focus:outline-none focus:ring-2 focus:ring-neutral-300 rounded-md"
                      onClick={onClose}
                      aria-label="434 Media - Home"
                    >
                      <ScrambleText
                        text="434 MEDIA"
                        className="inline-block cursor-pointer"
                        scrambleOnMount={false}
                        scrambleOnHover={true}
                      />
                    </Link>
                    <motion.button
                      onClick={onClose}
                      className="relative text-neutral-900 p-2.5 rounded-full z-50 md:mr-6 focus:outline-none focus:ring-2 focus:ring-neutral-300 group"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label="Close menu"
                    >
                      <i className="ri-close-line h-7 w-7 relative z-10" />
                      <span
                        className="absolute inset-0 rounded-full bg-neutral-100 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        aria-hidden="true"
                      ></span>
                    </motion.button>
                  </header>
                  <div className="flex-grow overflow-y-auto px-4 md:px-0 md:pr-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <h2
                        id="nav-menu-title"
                        className="text-3xl sm:text-4xl font-ggx88 text-neutral-900 mb-6 leading-tight"
                      >
                        Take the next step
                      </h2>
                      <p className="text-neutral-600 text-lg mb-8 max-w-xl leading-relaxed">
                        We partner with venture capital firms, accelerators, startups, and industry leaders to create
                        bold, strategic content that delivers results.
                      </p>
                      <h3 className="text-xl font-semibold text-neutral-800 mb-4">How can we help?</h3>
                      <ul className="space-y-4 text-base text-neutral-600 mb-8">{renderMenuItems()}</ul>

                      <ContactForm isVisible={menuMounted} />
                    </motion.div>
                  </div>
                </div>
                <div
                  className="hidden md:block absolute top-0 right-0 w-[100px] h-full bg-white transform translate-x-1/2"
                  aria-hidden="true"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden md:block relative h-full bg-neutral-900 overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ rotate: -180, scale: 0, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1.5, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    duration: 1.5,
                  }}
                  aria-hidden="true"
                >
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
                    alt="434 Media Logo"
                    width={600}
                    height={600}
                    className="object-contain w-full h-full max-w-[80%]"
                    priority
                  />
                </motion.div>
                <div
                  className="absolute top-0 left-0 w-[100px] h-full bg-neutral-900 transform -translate-x-1/2"
                  aria-hidden="true"
                />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden absolute inset-0 bg-white -z-10"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

