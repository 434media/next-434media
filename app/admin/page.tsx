"use client"

import type React from "react"

import { motion } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ChevronRight, FileText, ImageIcon, Database, TrendingUp, ChevronLeft } from "lucide-react"

interface AdminSection {
  id: string
  title: string
  subtitle: string
  href: string
  icon: React.ReactNode
  delay: number
  size: "large" | "medium"
  description: string
}

const adminSections: AdminSection[] = [
  {
    id: "analytics-web",
    title: "GA4 DASHBOARD",
    subtitle: "Google Analytics 4 Insights",
    href: "/analytics-web",
    icon: <GA4Icon className="w-8 h-8" />,
    delay: 0.1,
    size: "large",
    description: "View comprehensive website analytics, traffic sources, and user behavior data",
  },
  {
    id: "analytics-instagram",
    title: "META INSIGHTS",
    subtitle: "Instagram Analytics Dashboard",
    href: "/analytics-instagram",
    icon: <InstagramIcon className="w-8 h-8" />,
    delay: 0.15,
    size: "large",
    description: "Monitor Instagram performance, engagement metrics, and audience insights",
  },
  {
    id: "blog-admin",
    title: "BLOG ADMIN",
    subtitle: "Content Management",
    href: "/admin/blog",
    icon: <FileText className="w-8 h-8" />,
    delay: 0.2,
    size: "large",
    description: "Create, edit, and manage blog posts with rich text editor",
  },
  {
    id: "media-admin",
    title: "MEDIA ADMIN",
    subtitle: "Blog Asset Management Hub",
    href: "/admin/blog/media",
    icon: <ImageIcon className="w-8 h-8" />,
    delay: 0.25,
    size: "large",
    description: "Upload, organize, and manage media assets and images",
  },
  {
    id: "data-admin",
    title: "DATA ADMIN",
    subtitle: "CSV File Management",
    href: "/admin/insert-data",
    icon: <Database className="w-8 h-8" />,
    delay: 0.3,
    size: "large",
    description: "CSV upload and management for data collection",
  },
]

export default function AdminPage() {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const getSquareClasses = (size: string) => {
    switch (size) {
      case "large":
        return "col-span-2 row-span-2 h-48 md:h-56 lg:h-64"
      case "medium":
        return "col-span-2 row-span-1 h-24 md:h-28 lg:h-32"
      default:
        return "col-span-2 row-span-1 h-24 md:h-28 lg:h-32"
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 pt-32 md:pt-24">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12 text-center"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-ggx88 text-white mb-6 leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-white">
              ADMIN PANEL
            </span>
          </h1>
          <motion.p
            className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Centralized management dashboard for analytics, content, and system administration
          </motion.p>
        </motion.div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-4 gap-4 md:gap-6 lg:gap-8 auto-rows-min max-w-full mb-12">
          {adminSections.map((section) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{
                duration: 0.7,
                delay: section.delay,
                type: "spring",
                stiffness: 120,
                damping: 15,
              }}
              className={`group relative overflow-hidden rounded-3xl ${getSquareClasses(section.size)} border border-gray-800`}
              onMouseEnter={() => setHoveredSection(section.id)}
              onMouseLeave={() => setHoveredSection(null)}
            >
              <Link href={section.href} className="block relative w-full h-full">
                {/* Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"
                  animate={{
                    scale: hoveredSection === section.id ? 1.05 : 1,
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />

                {/* 434 Media Logo Background Pattern */}
                <div
                  className="absolute inset-0 opacity-5"
                  style={{
                    backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
                    backgroundSize: "60px 60px",
                    backgroundRepeat: "repeat",
                    backgroundPosition: "center",
                  }}
                />

                {/* Hover glow effect */}
                <motion.div
                  className="absolute inset-0 bg-white/5 rounded-3xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredSection === section.id ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />

                {/* Content Container */}
                <div className="relative h-full flex flex-col justify-center items-center p-6 md:p-8 z-10 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    {/* Icon */}
                    <motion.div
                      className="text-white mb-2"
                      animate={{
                        y: hoveredSection === section.id ? -4 : 0,
                        scale: hoveredSection === section.id ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {section.icon}
                    </motion.div>

                    {/* Title */}
                    <motion.h3
                      className="font-ggx88 text-lg md:text-xl lg:text-2xl text-white leading-tight mb-1"
                      animate={{
                        y: hoveredSection === section.id ? -2 : 0,
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {section.title}
                    </motion.h3>

                    {/* Subtitle */}
                    <motion.p
                      className="font-geist-sans text-sm md:text-base text-gray-400 leading-relaxed"
                      initial={{ opacity: 0.8 }}
                      animate={{
                        opacity: hoveredSection === section.id ? 1 : 0.8,
                        y: hoveredSection === section.id ? -1 : 0,
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {section.subtitle}
                    </motion.p>

                    {/* Description - only show on large cards when hovered */}
                    {section.size === "large" && (
                      <motion.p
                        className="font-geist-sans text-xs text-gray-500 leading-relaxed mt-2 max-w-xs"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: hoveredSection === section.id ? 1 : 0,
                          height: hoveredSection === section.id ? "auto" : 0,
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        {section.description}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Animated border */}
                <motion.div
                  className="absolute inset-0 border-2 border-gray-700 rounded-3xl"
                  animate={{
                    borderColor: hoveredSection === section.id ? "rgba(255,255,255,0.3)" : "rgba(107,114,128,1)",
                    scale: hoveredSection === section.id ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                />

                {/* Arrow indicator */}
                <motion.div
                  className="absolute top-4 right-4"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: hoveredSection === section.id ? 1 : 0,
                    x: hoveredSection === section.id ? 0 : -10,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </motion.div>

                {/* Shimmer effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
                  animate={{
                    translateX: hoveredSection === section.id ? "200%" : "-100%",
                  }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Back to Home Link */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300 text-lg group"
          >
            <motion.span className="group-hover:-translate-x-1 transition-transform duration-300">
                <ChevronLeft className="inline-block" />
            </motion.span>
            Back to Home
          </Link>
        </motion.div>

        {/* Footer Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0 }}
          className="fixed bottom-8 right-8 w-16 h-16 opacity-20"
        >
          <Image
            src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
            alt="434 Media Logo"
            width={64}
            height={64}
            className="object-contain w-full h-full"
          />
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-2 h-2 bg-white rounded-full animate-pulse opacity-30" />
        <div className="absolute top-40 right-20 w-1 h-1 bg-gray-400 rounded-full animate-pulse delay-1000 opacity-20" />
        <div className="absolute bottom-32 left-10 w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-500 opacity-25" />
      </div>
    </div>
  )
}

// instagram svg icon
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 00-2.124 1.388 5.878 5.878 0 00-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 002.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 002.123-1.388 5.881 5.881 0 001.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 00-1.387-2.123 5.857 5.857 0 00-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 01-1.382-.895 3.695 3.695 0 01-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 011.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 01-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 101.437-1.442 1.44 1.44 0 00-1.437 1.442M5.839 12.012a6.161 6.161 0 1012.323-.024 6.162 6.162 0 00-12.323.024M8 12.008A4 4 0 1112.008 16 4 4 0 018 12.008" />
    </svg>
  )
}

// ga4 svg icon
function GA4Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.84 2.998v17.999a2.983 2.983 0 01-2.967 2.998 2.98 2.98 0 01-.368-.02 3.06 3.06 0 01-2.61-3.1V3.12A3.06 3.06 0 0119.51.02a2.983 2.983 0 013.329 2.978zM4.133 18.055a2.973 2.973 0 100 5.945 2.973 2.973 0 000-5.945zm7.872-9.01h-.05a3.06 3.06 0 00-2.892 3.126v7.985c0 2.167.954 3.482 2.35 3.763a2.978 2.978 0 003.57-2.927v-8.959a2.983 2.983 0 00-2.978-2.988z" />
    </svg>
  )
}