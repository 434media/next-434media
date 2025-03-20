"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect } from "react"
import { ScrambleText } from "./ScrambleText"
import { ContactForm } from "./ContactForm"

interface NavMenuProps {
  isOpen: boolean
  onClose: () => void
}

export default function NavMenu({ isOpen, onClose }: NavMenuProps) {
  const renderMenuItems = useCallback(() => {
    const items = [
      "Ask about our services and capabilities",
      "Discuss a project or partnership",
      "Get a quote or proposal",
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

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen &&
        (
          <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-menu-title"
        >
          <div className="relative w-full h-full">
            <div className="absolute inset-0 md:grid md:grid-cols-2">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative h-full bg-white overflow-y-auto"
              >
                <div className="p-4 md:p-8 h-full flex flex-col">
                  <header className="flex justify-between items-center mb-8">
                    <Link href="/" className="text-2xl font-menda-black" onClick={onClose}>
                      <ScrambleText text="434 MEDIA" className="inline-block cursor-pointer" />
                    </Link>
                    <motion.button
                      onClick={onClose}
                      className="text-neutral-900 hover:text-neutral-600 transition-colors p-2 rounded-full hover:bg-neutral-100 z-50 md:mr-6"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label="Close menu"
                    >
                      <i className="ri-close-line h-8 w-8" />
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
                        className="text-3xl sm:text-4xl font-geist-sans text-neutral-900 mb-6 leading-tight"
                      >
                        Take the next step
                      </h2>
                      <ul className="space-y-4 text-base text-neutral-600 mb-8">{renderMenuItems()}</ul>
                      
                      <ContactForm />
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
                  animate={{ rotate: 0, scale: 1.2, opacity: 1 }}
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
                    width={400}
                    height={400} 
                    className="object-contain"
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

