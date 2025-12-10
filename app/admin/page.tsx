"use client"

import type React from "react"

import { motion } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { ChevronRight, ChevronLeft, Bot } from "lucide-react"

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
    id: "analytics-hub",
    title: "ANALYTICS HUB",
    subtitle: "GA4 • Instagram • Mailchimp",
    href: "/admin/analytics",
    icon: <GA4Icon className="w-8 h-8" />,
    delay: 0.1,
    size: "large",
    description: "Unified dashboards for website traffic, social engagement, and email marketing performance in one place",
  },
  {
    id: "feed-form",
    title: "THE FEED",
    subtitle: "Submit Feed Items",
    href: "/admin/feed-form",
    icon: <FileTextIcon className="w-8 h-8" />,
    delay: 0.15,
    size: "large",
    description: "Submit new feed items that will be sent to Airtable for Digital Canvas distribution",
  },
]

const testingSections: AdminSection[] = [
  {
    id: "ai-assistant",
    title: "AI ASSISTANT",
    subtitle: "RAG Chatbot Testing",
    href: "/admin/ai-assistant",
    icon: <Bot className="w-8 h-8" />,
    delay: 0.1,
    size: "large",
    description: "Test and interact with the AI assistant powered by retrieval-augmented generation for accurate responses",
  },
]

export default function AdminPage() {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeView, setActiveView] = useState<'admin' | 'testing'>('admin')

  useEffect(() => {
    setMounted(true)
  }, [])

  const getSquareClasses = (size: string) => {
    switch (size) {
      case "large":
        return "col-span-1 sm:col-span-2 lg:row-span-2 h-40 sm:h-48 md:h-56 lg:h-64"
      case "medium":
        return "col-span-1 row-span-1 h-32 sm:h-36 md:h-40"
      default:
        return "col-span-1 sm:col-span-2 row-span-1 h-24 sm:h-28 md:h-32"
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  const currentSections = activeView === 'admin' ? adminSections : testingSections

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pt-24 sm:pt-28 md:pt-24">
        {/* Top Navigation - Mobile First Design */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-6 mb-12 md:flex-row md:items-center md:justify-between"
        >
          {/* Back to Home - Above tabs on mobile, top left on desktop */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300 text-lg group justify-start"
          >
            <motion.span className="group-hover:-translate-x-1 transition-transform duration-300">
              <ChevronLeft className="inline-block" />
            </motion.span>
            Back to Home
          </Link>

          {/* Navigation Tabs - Full width on mobile, centered on desktop */}
          <div className="flex items-center gap-4 md:gap-8 justify-start md:justify-center">
            <button
              onClick={() => setActiveView('admin')}
              className={`text-lg md:text-xl lg:text-2xl font-ggx88 transition-all duration-300 relative ${
                activeView === 'admin' 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ADMIN PANEL
              {activeView === 'admin' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-2 left-0 right-0 h-0.5 bg-white"
                  transition={{ duration: 0.3 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveView('testing')}
              className={`text-lg md:text-xl lg:text-2xl font-ggx88 transition-all duration-300 relative ${
                activeView === 'testing' 
                  ? 'text-white' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              TESTING PLAYGROUND
              {activeView === 'testing' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-2 left-0 right-0 h-0.5 bg-white"
                  transition={{ duration: 0.3 }}
                />
              )}
            </button>
          </div>

          {/* Spacer for balance - hidden on mobile */}
          <div className="hidden md:block md:w-32"></div>
        </motion.div>

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12 text-left md:text-center"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-ggx88 text-white mb-4 md:mb-6 leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-white">
              {activeView === 'admin' ? 'ADMIN PANEL' : 'TESTING PLAYGROUND'}
            </span>
          </h1>
          <motion.p
            className="text-gray-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed text-left md:text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {activeView === 'admin' 
              ? 'Access to 434 SOP Documentation, Analytics and management tools'
              : 'Explore concept workflows built with different AI Models and integrations'
            }
          </motion.p>
        </motion.div>

        {/* Sections Grid */}
        <motion.div 
          key={activeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`grid gap-3 sm:gap-4 md:gap-6 lg:gap-8 auto-rows-min max-w-full mb-12 ${
            activeView === 'admin' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
          }`}
        >
          {currentSections.map((section) => (
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
                <div className="relative h-full flex flex-col justify-center items-start sm:items-center p-4 sm:p-6 md:p-8 z-10 text-left sm:text-center">
                  <div className="flex flex-col items-start sm:items-center justify-center space-y-2 sm:space-y-3 w-full">
                    {/* Icon */}
                    <motion.div
                      className="text-white mb-1 sm:mb-2"
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
                      className="font-ggx88 text-base sm:text-lg md:text-xl lg:text-2xl text-white leading-tight mb-1"
                      animate={{
                        y: hoveredSection === section.id ? -2 : 0,
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {section.title}
                    </motion.h3>

                    {/* Subtitle */}
                    <motion.p
                      className="font-geist-sans text-xs sm:text-sm md:text-base text-gray-400 leading-relaxed"
                      initial={{ opacity: 0.8 }}
                      animate={{
                        opacity: hoveredSection === section.id ? 1 : 0.8,
                        y: hoveredSection === section.id ? -1 : 0,
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      {section.subtitle}
                    </motion.p>

                    {/* Description - only show on large cards when hovered or on mobile */}
                    {section.size === "large" && (
                      <motion.p
                        className="font-geist-sans text-xs text-gray-500 leading-relaxed mt-1 sm:mt-2 max-w-xs block sm:hidden md:block"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                          opacity: hoveredSection === section.id ? 1 : 0.7,
                          height: hoveredSection === section.id || window.innerWidth < 640 ? "auto" : 0,
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

// GA4 svg icon
function GA4Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.84 2.998v17.999a2.983 2.983 0 01-2.967 2.998 2.98 2.98 0 01-.368-.02 3.06 3.06 0 01-2.61-3.1V3.12A3.06 3.06 0 0119.51.02a2.983 2.983 0 013.329 2.978zM4.133 18.055a2.973 2.973 0 100 5.945 2.973 2.973 0 000-5.945zm7.872-9.01h-.05a3.06 3.06 0 00-2.892 3.126v7.985c0 2.167.954 3.482 2.35 3.763a2.978 2.978 0 003.57-2.927v-8.959a2.983 2.983 0 00-2.978-2.988z" />
    </svg>
  )
}

// mailchimp svg icon
export function MailchimpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M11.267 0C6.791-.015-1.82 10.246 1.397 12.964l.79.669a3.88 3.88 0 00-.22 1.792c.084.84.518 1.644 1.22 2.266.666.59 1.542.964 2.392.964 1.406 3.24 4.62 5.228 8.386 5.34 4.04.12 7.433-1.776 8.854-5.182.093-.24.488-1.316.488-2.267 0-.956-.54-1.352-.885-1.352-.01-.037-.078-.286-.172-.586-.093-.3-.19-.51-.19-.51.375-.563.382-1.065.332-1.35-.053-.353-.2-.653-.496-.964-.296-.311-.902-.63-1.753-.868l-.446-.124c-.002-.019-.024-1.053-.043-1.497-.014-.32-.042-.822-.197-1.315-.186-.668-.508-1.253-.911-1.627 1.112-1.152 1.806-2.422 1.804-3.511-.003-2.095-2.576-2.729-5.746-1.416l-.672.285A678.22 678.22 0 0012.7.504C12.304.159 11.817.002 11.267 0zm.073.873c.166 0 .322.019.465.058.297.084 1.28 1.224 1.28 1.224s-1.826 1.013-3.52 2.426c-2.28 1.757-4.005 4.311-5.037 7.082-.811.158-1.526.618-1.963 1.253-.261-.218-.748-.64-.834-.804-.698-1.326.761-3.902 1.781-5.357C5.834 3.44 9.37.867 11.34.873zm3.286 3.273c.04-.002.06.05.028.074-.143.11-.299.26-.413.414a.04.04 0 00.031.064c.659.004 1.587.235 2.192.574.041.023.012.103-.034.092-.915-.21-2.414-.369-3.97.01-1.39.34-2.45.863-3.224 1.426-.04.028-.086-.023-.055-.06.896-1.035 1.999-1.935 2.987-2.44.034-.018.07.019.052.052-.079.143-.23.447-.278.678-.007.035.032.063.062.042.615-.42 1.684-.868 2.622-.926zm3.023 3.205l.056.001a.896.896 0 01.456.146c.534.355.61 1.216.638 1.845.015.36.059 1.229.074 1.478.034.571.184.651.487.751.17.057.33.098.563.164.706.198 1.125.4 1.39.658.157.162.23.333.253.497.083.608-.472 1.36-1.942 2.041-1.607.746-3.557.935-4.904.785l-.471-.053c-1.078-.145-1.693 1.247-1.046 2.201.417.615 1.552 1.015 2.688 1.015 2.604 0 4.605-1.111 5.35-2.072a.987.987 0 00.06-.085c.036-.055.006-.085-.04-.054-.608.416-3.31 2.069-6.2 1.571 0 0-.351-.057-.672-.182-.255-.1-.788-.344-.853-.891 2.333.72 3.801.039 3.801.039a.072.072 0 00.042-.072.067.067 0 00-.074-.06s-1.911.283-3.718-.378c.197-.64.72-.408 1.51-.345a11.045 11.045 0 003.647-.394c.818-.234 1.892-.697 2.727-1.356.281.618.38 1.299.38 1.299s.219-.04.4.073c.173.106.299.326.213.895-.176 1.063-.628 1.926-1.387 2.72a5.714 5.714 0 01-1.666 1.244c-.34.18-.704.334-1.087.46-2.863.935-5.794-.093-6.739-2.3a3.545 3.545 0 01-.189-.522c-.403-1.455-.06-3.2 1.008-4.299.065-.07.132-.153.132-.256 0-.087-.055-.179-.102-.243-.374-.543-1.669-1.466-1.409-3.254.187-1.284 1.31-2.189 2.357-2.135.089.004.177.01.266.015.453.027.85.085 1.223.1.625.028 1.187-.063 1.853-.618.225-.187.405-.35.71-.401.028-.005.092-.028.215-.028zm.022 2.18a.42.42 0 00-.06.005c-.335.054-.347.468-.228 1.04.068.32.187.595.32.765.175-.02.343-.022.498 0 .089-.205.104-.557.024-.942-.112-.535-.261-.872-.554-.868zm-3.66 1.546a1.724 1.724 0 00-1.016.326c-.16.117-.311.28-.29.378.008.032.031.056.088.063.131.015.592-.217 1.122-.25.374-.023.684.094.923.2.239.104.386.173.443.113.037-.038.026-.11-.031-.204-.118-.192-.36-.387-.618-.497a1.601 1.601 0 00-.621-.129zm4.082.81c-.171-.003-.313.186-.317.42-.004.236.131.43.303.432.172.003.314-.185.318-.42.004-.236-.132-.429-.304-.432zm-3.58.172c-.05 0-.102.002-.155.008-.311.05-.483.152-.593.247-.094.082-.152.173-.152.237a.075.075 0 00.075.076c.07 0 .228-.063.228-.063a1.98 1.98 0 011.001-.104c.157.018.23.027.265-.026.01-.016.022-.049-.01-.1-.063-.103-.311-.269-.66-.275zm2.26.4c-.127 0-.235.051-.283.148-.075.154.035.363.246.466.21.104.443.063.52-.09.075-.155-.035-.364-.246-.467a.542.542 0 00-.237-.058zm-11.635.024c.048 0 .098 0 .149.003.73.04 1.806.6 2.052 2.19.217 1.41-.128 2.843-1.449 3.069-.123.02-.248.029-.374.026-1.22-.033-2.539-1.132-2.67-2.435-.145-1.44.591-2.548 1.894-2.811.117-.024.252-.04.398-.042zm-.07.927a1.144 1.144 0 00-.847.364c-.38.418-.439.988-.366 1.19.027.073.07.094.1.098.064.008.16-.039.22-.2a1.2 1.2 0 00.017-.052 1.58 1.58 0 01.157-.37.689.689 0 01.955-.199c.266.174.369.5.255.81-.058.161-.154.469-.133.721.043.511.357.717.64.738.274.01.466-.143.515-.256.029-.067.005-.107-.011-.125-.043-.053-.113-.037-.18-.021a.638.638 0 01-.16.022.347.347 0 01-.294-.148c-.078-.12-.073-.3.013-.504.011-.028.025-.058.04-.092.138-.308.368-.825.11-1.317-.195-.37-.513-.602-.894-.65a1.135 1.135 0 00-.138-.01z" />
    </svg>
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

//airtable svg icon
function AirtableIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 002.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 00-1.272-.257zM23.4 8.056a.589.589 0 00-.222.045l-10.012 3.877a.612.612 0 00-.38.564v8.896a.6.6 0 00.821.552L23.62 18.1a.583.583 0 00.38-.551V8.653a.6.6 0 00-.6-.596zM.676 8.095a.644.644 0 00-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 00-.207-.044z" />
    </svg>
  )
}

//openai svg icon
function OpenAIIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08-4.778 2.758a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

// FileText svg icon
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  )
}
