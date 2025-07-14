"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "motion/react"
import { DraggableCardBody, DraggableCardContainer } from "./DraggableCard"
import { MagazineModal } from "./MagazineModal"
import { Calendar, Users, Zap, Star, Sparkles, Rocket } from "lucide-react"

interface MagazineSection {
  id: string
  title: string
  subtitle: string
  description: string
  content: string
  image: string
  bgColor: string
  textColor: string
  category: string
  className: string
  icon: React.ReactNode
  date?: string
  author?: string
  readTime?: string
  tags?: string[]
  gallery?: string[]
  events?: Array<{
    title: string
    date: string
    location: string
    description: string
    image: string
  }>
}

export function DigitalMagazineBook() {
  const [selectedSection, setSelectedSection] = useState<MagazineSection | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const magazineSections: MagazineSection[] = [
    {
      id: "founders-mode",
      title: "Founder's Mode",
      subtitle: "Building the Future",
      description:
        "An exclusive look into the minds of visionary founders who are reshaping industries and creating the future we'll all live in.",
      content: `Welcome to Founder's Mode - where we dive deep into the entrepreneurial mindset that drives innovation and change.

In this edition, we explore the unique challenges and opportunities that founders face in today's rapidly evolving digital landscape. From AI-powered startups to sustainable technology solutions, we're witnessing a new generation of entrepreneurs who aren't just building companies - they're building the future.

Our featured founders share their insights on everything from raising capital in uncertain times to building teams that can scale globally. We examine the tools, strategies, and mindsets that separate successful founders from the rest.

Key topics covered:
• The psychology of successful entrepreneurship
• Building resilient teams in remote-first environments
• Navigating regulatory challenges in emerging technologies
• Creating sustainable business models for the digital age

This isn't just about business strategy - it's about the human stories behind the innovations that are changing our world. Each founder we feature has faced moments of doubt, breakthrough insights, and the relentless pursuit of a vision that others couldn't see.`,
      image: "/placeholder.svg?height=400&width=600",
      bgColor: "#1a1a2e",
      textColor: "#ffffff",
      category: "Leadership",
      className: "absolute top-10 left-[15%] rotate-[-8deg]",
      icon: <Rocket className="h-6 w-6" />,
      author: "Digital Canvas Editorial",
      date: "January 2025",
      readTime: "12 min read",
      tags: ["entrepreneurship", "leadership", "startups", "innovation"],
      gallery: [
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
      ],
    },
    {
      id: "month-in-motion",
      title: "Month in Motion",
      subtitle: "AI & Creative Revolution",
      description:
        "This month's deep dive into how artificial intelligence is transforming creative industries and empowering artists worldwide.",
      content: `Month in Motion captures the pulse of our rapidly evolving creative landscape, where artificial intelligence isn't replacing human creativity - it's amplifying it.

This month, we're witnessing unprecedented developments in AI-powered creative tools. From generative art platforms that respond to emotional input to AI writing assistants that help authors overcome creative blocks, technology is becoming an extension of human imagination rather than a replacement for it.

Featured Developments:
• New AI art generation models that understand artistic style and emotion
• Music composition tools that collaborate with human musicians
• Video editing AI that can understand narrative structure
• Writing assistants that maintain authentic voice while enhancing creativity

We've interviewed leading artists, musicians, writers, and designers who are pioneering the integration of AI into their creative processes. Their stories reveal not just technical innovation, but a fundamental shift in how we think about creativity itself.

The Creative AI Revolution includes:
- Real-time collaboration between human and artificial intelligence
- Democratization of professional-grade creative tools
- New forms of interactive and responsive art
- Ethical considerations in AI-generated content

This isn't about technology taking over creativity - it's about expanding the boundaries of what's possible when human imagination meets artificial intelligence.`,
      image: "/placeholder.svg?height=400&width=600",
      bgColor: "#6366f1",
      textColor: "#ffffff",
      category: "Technology",
      className: "absolute top-32 left-[35%] rotate-[5deg]",
      icon: <Sparkles className="h-6 w-6" />,
      author: "Tech Innovation Team",
      date: "January 2025",
      readTime: "15 min read",
      tags: ["AI", "creativity", "digital-art", "innovation", "technology"],
      gallery: [
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
      ],
    },
    {
      id: "the-drop",
      title: "The Drop",
      subtitle: "Latest Releases & Updates",
      description:
        "Your curated guide to the newest tools, platforms, and creative resources that are reshaping the digital landscape.",
      content: `The Drop is your essential guide to the latest releases, updates, and launches that matter in the creative and tech world.

This month's highlights include groundbreaking new platforms, major updates to existing tools, and emerging technologies that are just hitting the market. We don't just list what's new - we analyze what it means for creators, entrepreneurs, and innovators.

Featured Releases:

New Platform Launches:
• CreativeFlow 3.0 - The next generation of collaborative design tools
• AIStudio Pro - Professional-grade AI content creation suite
• StreamCraft - Revolutionary live streaming and content creation platform
• CodeCanvas - Visual programming environment for creative coding

Major Updates:
• Adobe Creative Cloud's new AI integration features
• Figma's enhanced real-time collaboration tools
• Notion's advanced database and automation capabilities
• Shopify's new creator economy features

Emerging Technologies:
• WebXR development tools for immersive experiences
• Blockchain-based creator monetization platforms
• Advanced motion capture for content creators
• Real-time language translation for global collaboration

Each release is evaluated on innovation, usability, and potential impact on creative workflows. We provide hands-on reviews, use case scenarios, and integration tips to help you make informed decisions about adopting new tools.

The Drop also features exclusive previews of upcoming releases and beta access opportunities for our community.`,
      image: "/placeholder.svg?height=400&width=600",
      bgColor: "#10b981",
      textColor: "#ffffff",
      category: "Releases",
      className: "absolute top-8 left-[55%] rotate-[-3deg]",
      icon: <Zap className="h-6 w-6" />,
      author: "Product Review Team",
      date: "January 2025",
      readTime: "10 min read",
      tags: ["releases", "tools", "software", "updates", "reviews"],
      gallery: [
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
        "/placeholder.svg?height=300&width=400",
      ],
    },
    {
      id: "featured-events",
      title: "Featured Events",
      subtitle: "Connect & Create",
      description:
        "Discover upcoming conferences, workshops, and networking events where the creative and tech communities converge.",
      content: `Featured Events brings you the most important gatherings, conferences, and workshops where innovation happens and communities connect.

From intimate workshops with industry leaders to massive conferences that shape the future of technology and creativity, we curate events that offer real value for professionals, creators, and entrepreneurs.

This month's event highlights span across multiple disciplines and formats - from virtual reality showcases to AI ethics symposiums, from startup pitch competitions to creative coding bootcamps.

Upcoming Highlights:

Major Conferences:
• CreativeTech Summit 2025 - San Francisco, March 15-17
• AI & Design Conference - Virtual, February 28
• Startup Founders Retreat - Austin, April 5-7
• Digital Art & NFT Expo - New York, March 22-24

Workshops & Masterclasses:
• Advanced Prompt Engineering for Creatives
• Building Sustainable Creator Businesses
• Web3 Development for Beginners
• Motion Design with AI Tools

Networking Events:
• Monthly Creator Meetups in 15+ cities
• Virtual Coffee Chats with Industry Leaders
• Startup Founder Speed Networking
• Designer & Developer Collaboration Sessions

Community Initiatives:
• Open Source Project Collaborations
• Mentorship Program Launches
• Creative Challenge Competitions
• Knowledge Sharing Sessions

Each event listing includes detailed information about speakers, agenda, networking opportunities, and how to maximize your experience. We also provide post-event coverage and key takeaways for those who couldn't attend.`,
      image: "/placeholder.svg?height=400&width=600",
      bgColor: "#f59e0b",
      textColor: "#ffffff",
      category: "Events",
      className: "absolute top-24 right-[25%] rotate-[7deg]",
      icon: <Calendar className="h-6 w-6" />,
      author: "Events Team",
      date: "January 2025",
      readTime: "8 min read",
      tags: ["events", "conferences", "networking", "workshops", "community"],
      events: [
        {
          title: "CreativeTech Summit 2025",
          date: "March 15-17, 2025",
          location: "San Francisco, CA",
          description:
            "The premier conference for creative technologists, featuring the latest in AI, design, and innovation.",
          image: "/placeholder.svg?height=200&width=300",
        },
        {
          title: "AI & Design Workshop",
          date: "February 28, 2025",
          location: "Virtual Event",
          description: "Hands-on workshop exploring the intersection of artificial intelligence and creative design.",
          image: "/placeholder.svg?height=200&width=300",
        },
        {
          title: "Startup Founders Retreat",
          date: "April 5-7, 2025",
          location: "Austin, TX",
          description: "Intensive retreat for early-stage founders focusing on product development and team building.",
          image: "/placeholder.svg?height=200&width=300",
        },
        {
          title: "Digital Art & NFT Expo",
          date: "March 22-24, 2025",
          location: "New York, NY",
          description: "Showcase of digital art, NFT innovations, and blockchain technology for creators.",
          image: "/placeholder.svg?height=200&width=300",
        },
      ],
    },
  ]

  const handleCardClick = (section: MagazineSection) => {
    setSelectedSection(section)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedSection(null)
  }

  return (
    <>
      <DraggableCardContainer className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Animated background shapes */}
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-200/30 to-purple-200/30 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              rotate: -360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 25,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-green-200/30 to-blue-200/30 rounded-full blur-3xl"
          />
        </div>

        {/* Central Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none"
        >
          <h1 className="text-4xl md:text-6xl font-black text-gray-800/20 mb-4">DIGITAL CANVAS</h1>
          <p className="text-lg md:text-xl text-gray-600/40 font-medium">
            Drag the cards • Click to explore • Experience the future
          </p>
        </motion.div>

        {/* Magazine Section Cards */}
        {magazineSections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: index * 0.2,
              type: "spring",
              stiffness: 100,
              damping: 15,
            }}
          >
            <DraggableCardBody className={section.className} onClick={() => handleCardClick(section)}>
              {/* Card Header */}
              <div
                className="absolute inset-0 rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${section.bgColor} 0%, ${section.bgColor}dd 100%)`,
                }}
              />

              {/* Card Content */}
              <div className="relative z-10 h-full flex flex-col">
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                    {section.icon}
                    <span className="text-sm font-medium text-white">{section.category}</span>
                  </div>
                  <Star className="h-5 w-5 text-white/60" />
                </div>

                {/* Main Image */}
                <div className="flex-1 mb-4 rounded-lg overflow-hidden">
                  <img
                    src={section.image || "/placeholder.svg"}
                    alt={section.title}
                    className="w-full h-48 object-cover"
                  />
                </div>

                {/* Text Content */}
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white leading-tight">{section.title}</h3>
                  <p className="text-sm text-white/80 leading-relaxed">{section.subtitle}</p>
                  <p className="text-xs text-white/70 line-clamp-2">{section.description}</p>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Users className="h-3 w-3" />
                    <span>{section.readTime}</span>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium text-white"
                  >
                    Read More
                  </motion.div>
                </div>
              </div>
            </DraggableCardBody>
          </motion.div>
        ))}

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-gray-500 text-sm"
        >
          <p>Drag cards around • Click to open detailed view • Explore interactive content</p>
        </motion.div>
      </DraggableCardContainer>

      {/* Modal */}
      <MagazineModal section={selectedSection} isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  )
}
