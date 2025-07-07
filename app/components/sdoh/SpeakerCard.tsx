"use client"

import { useState } from "react"
import Image from "next/image"

interface SpeakerCardProps {
  name: string
  title: string
  company: string
  imageUrl: string
  logoUrl?: string
  role?: string
  href?: string
}

export function SpeakerCard({ name, title, company, imageUrl, logoUrl, role, href }: SpeakerCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const CardContent = () => (
    <div
      className="group block rounded-xl shadow-lg overflow-hidden border border-neutral-200 transition-all duration-500 hover:shadow-2xl hover:border-cyan-200 hover:-translate-y-3 bg-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative overflow-hidden">
        {/* Enhanced image with loading state */}
        <div className="relative aspect-square">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-200 to-neutral-300 animate-pulse flex items-center justify-center">
              <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
          <Image
            src={imageUrl || "/placeholder.svg?height=400&width=400&query=professional headshot"}
            alt={`${name} - ${title}, ${company}`}
            width={400}
            height={400}
            className={`w-full h-full object-cover transition-all duration-700 ${
              isHovered ? "scale-110 brightness-110" : "scale-100"
            } ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Enhanced overlay effects */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-500 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          ></div>

          {/* Animated border effect */}
          <div
            className={`absolute inset-0 transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-yellow-400 to-cyan-400 animate-pulse"></div>
            <div className="absolute inset-[3px] bg-white"></div>
            <Image
              src={imageUrl || "/placeholder.svg?height=400&width=400&query=professional headshot"}
              alt=""
              width={400}
              height={400}
              className="absolute inset-[3px] w-[calc(100%-6px)] h-[calc(100%-6px)] object-cover"
            />
          </div>
        </div>

        {/* Enhanced company logo */}
        {logoUrl && (
          <div
            className={`absolute bottom-4 right-4 transition-all duration-500 ${
              isHovered ? "scale-110 rotate-3" : "scale-100"
            }`}
          >
            <div className="bg-white/95 backdrop-blur-sm rounded-full p-3 shadow-lg border border-white/50">
              <Image
                src={logoUrl || "/placeholder.svg?height=40&width=40&query=company logo"}
                alt={`${company} Logo`}
                width={40}
                height={40}
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>
        )}

        {/* Role badge */}
        {role && (
          <div
            className={`absolute top-4 left-4 transition-all duration-500 ${
              isHovered ? "scale-110 -rotate-1" : "scale-100"
            }`}
          >
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider shadow-lg">
              {role}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced content section */}
      <div className="p-6 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-yellow-500/20"></div>
        </div>

        <div className="relative z-10">
          <h4
            className={`text-xl font-bold transition-all duration-300 mb-2 ${
              isHovered
                ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-yellow-500"
                : "text-neutral-800"
            }`}
          >
            {name}
          </h4>
          <p className="text-neutral-600 text-sm leading-relaxed mb-1">
            <span className="font-medium">{title}</span>
          </p>
          <p className="text-neutral-500 text-sm">{company}</p>

          {/* Animated underline */}
          <div
            className={`h-0.5 bg-gradient-to-r from-cyan-500 to-yellow-500 transition-all duration-500 mt-3 ${
              isHovered ? "w-full" : "w-0"
            }`}
          ></div>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-yellow-500/5 transition-opacity duration-500 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      ></div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 rounded-xl"
      >
        <CardContent />
      </a>
    )
  }

  return <CardContent />
}
