"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { ScrambleText } from "./ScrambleText"
import NavMenu from "./Navmenu"

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
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
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 backdrop-blur-md ${
          isScrolled ? "bg-black/70" : "bg-black/30"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-white font-menda-black text-base sm:text-xl flex items-center">
              <ScrambleText
                text="434 MEDIA"
                className="inline-block cursor-pointer"
                scrambleOnMount={false}
                scrambleOnHover={true}
              />
            </Link>
            <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
              <motion.button
                onClick={handleMenuToggle}
                className={`text-white px-2 sm:px-3 py-2 text-xs sm:text-sm md:text-md font-geist-sans focus:outline-none transition-colors duration-300 rounded-md flex items-center hover:bg-white/10`}
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="flex items-center">
                  <span className="mr-1 sm:mr-2">Actions Speak Louder</span>
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 sm:h-5 sm:w-5"
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
              {/* Mobile menu button */}
              <button
                onClick={handleMobileMenuToggle}
                className="md:hidden text-white"
                aria-expanded={isMobileMenuOpen}
                aria-label="Toggle mobile menu"
              >
                <i className={`ri-${isMobileMenuOpen ? "close" : "menu"}-line text-2xl`}></i>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black bg-opacity-90 pt-16">
          <div className="px-4 py-6 space-y-4">
            <Link href="/services" className="block text-white py-2 text-lg" onClick={() => setIsMobileMenuOpen(false)}>
              <ScrambleText text="Services" scrambleOnMount={false} />
            </Link>
            <Link href="/work" className="block text-white py-2 text-lg" onClick={() => setIsMobileMenuOpen(false)}>
              <ScrambleText text="Work" scrambleOnMount={false} />
            </Link>
            <Link href="/about" className="block text-white py-2 text-lg" onClick={() => setIsMobileMenuOpen(false)}>
              <ScrambleText text="About" scrambleOnMount={false} />
            </Link>
            <Link href="/contact" className="block text-white py-2 text-lg" onClick={() => setIsMobileMenuOpen(false)}>
              <ScrambleText text="Contact" scrambleOnMount={false} />
            </Link>
          </div>
        </div>
      )}

      <NavMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  )
}

