"use client"

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
  const CardContent = () => (
    <div className="group block overflow-hidden border border-neutral-200 bg-white hover:border-neutral-900 transition-colors duration-300">
      {/* Image container */}
      <div className="relative">
        <div className="relative aspect-square bg-neutral-100">
          <Image
            src={imageUrl || "/placeholder.svg?height=400&width=400&query=professional headshot"}
            alt={`${name} - ${title}, ${company}`}
            width={400}
            height={400}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Company logo */}
        {logoUrl && (
          <div className="absolute bottom-4 right-4">
            <div className="bg-white p-2 border border-neutral-200">
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
          <div className="absolute top-4 left-4">
            <div className="bg-cyan-500 text-white px-3 py-1 text-xs font-bold tracking-wider">
              {role}
            </div>
          </div>
        )}
      </div>

      {/* Content section */}
      <div className="p-6 border-t border-neutral-200">
        <div className="w-8 h-1 bg-yellow-400 mb-4"></div>
        <h4 className="text-xl font-bold text-neutral-900 mb-2">
          {name}
        </h4>
        <p className="text-neutral-700 text-sm leading-relaxed mb-1">
          <span className="font-medium">{title}</span>
        </p>
        <p className="text-neutral-500 text-sm">{company}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <CardContent />
      </a>
    )
  }

  return <CardContent />
}
