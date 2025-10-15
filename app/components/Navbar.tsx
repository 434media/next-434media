"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ScrambleText } from "./ScrambleText"
import NavMenu from "./Navmenu"

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 backdrop-blur-md ${
          isScrolled ? "bg-black/80 shadow-lg py-2" : "bg-gradient-to-b from-white/5 to-white/5 py-4"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link
              href="/"
              className="text-white font-menda-black text-base sm:text-xl flex items-center group"
              aria-label="434 Media - Home"
            >
              <ScrambleText
                text="434 MEDIA"
                className="inline-block cursor-pointer transition-transform duration-300 group-hover:scale-105"
                scrambleOnMount={false}
                scrambleOnHover={true}
              />
            </Link>

            <div className="flex items-center">
              <motion.button
                onClick={handleMenuToggle}
                className="relative text-white px-4 py-2 text-sm font-geist-sans rounded-md flex items-center transition-all duration-300 shadow-md hover:shadow-lg border border-white/20 hover:border-white/40"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                aria-controls="nav-menu"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="relative z-10 flex items-center">
                  <span className="mr-2">Action Speaks Louder</span>
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    animate={{ rotate: isMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </motion.svg>
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <NavMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} id="nav-menu" />
    </>
  )
}

