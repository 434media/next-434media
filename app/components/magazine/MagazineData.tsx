import type React from "react"
import { Calendar, Zap, Sparkles, Rocket } from "lucide-react"

export interface MagazineSection {
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
  mobileClassName: string
  icon: React.ReactNode
  date?: string
  author?: string
  gallery?: string[]
  events?: Array<{
    title: string
    date: string
    location: string
    description: string
    image: string
  }>
}

export const magazineSections: MagazineSection[] = [
  {
    id: "founders-note",
    title: "Founder's Note",
    subtitle: "Actions Speak Louder",
    description:"This month, we focus on the actions that define our community.",
    content: `Whether it's SDOH work in the Valley, closing the digital gap with Tech Bloc, supporting ecosystem builders at Emerge and Rise, or sharing a message with a connected community - it all comes back to one thing: access.
    
    Access to health, tech, capital, or simply a seat at the table. The stories we tell are about real people building real things. Actions Speak Louder!`,
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/Marcos+Headshot+3.jpg",
    bgColor: "#1a1a2e",
    textColor: "#ffffff",
    category: "Leadership",
    className: "absolute top-10 left-[15%] rotate-[-8deg]",
    mobileClassName: "relative",
    icon: <Rocket className="h-6 w-6" />,
    author: "Marcos Resendez",
    date: "June 2025",
    gallery: [
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
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
    image: "/placeholder.svg?height=1350&width=1080",
    bgColor: "#6366f1",
    textColor: "#ffffff",
    category: "Technology",
    className: "absolute top-32 left-[35%] rotate-[5deg]",
    mobileClassName: "relative",
    icon: <Sparkles className="h-6 w-6" />,
    author: "Tech Innovation Team",
    date: "June 2025",
    gallery: [
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
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
    image: "/placeholder.svg?height=1350&width=1080",
    bgColor: "#10b981",
    textColor: "#ffffff",
    category: "Releases",
    className: "absolute top-8 left-[55%] rotate-[-3deg]",
    mobileClassName: "relative",
    icon: <Zap className="h-6 w-6" />,
    author: "Product Review Team",
    date: "June 2025",
    gallery: [
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
      "/placeholder.svg?height=1350&width=1080",
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
    image: "/placeholder.svg?height=1350&width=1080",
    bgColor: "#f59e0b",
    textColor: "#ffffff",
    category: "Events",
    className: "absolute top-24 right-[25%] rotate-[7deg]",
    mobileClassName: "relative",
    icon: <Calendar className="h-6 w-6" />,
    author: "Events Team",
    date: "June 2025",
    events: [
      {
        title: "CreativeTech Summit 2025",
        date: "March 15-17, 2025",
        location: "San Francisco, CA",
        description:
          "The premier conference for creative technologists, featuring the latest in AI, design, and innovation.",
        image: "/placeholder.svg?height=1350&width=1080",
      },
      {
        title: "AI & Design Workshop",
        date: "February 28, 2025",
        location: "Virtual Event",
        description: "Hands-on workshop exploring the intersection of artificial intelligence and creative design.",
        image: "/placeholder.svg?height=1350&width=1080",
      },
      {
        title: "Startup Founders Retreat",
        date: "April 5-7, 2025",
        location: "Austin, TX",
        description: "Intensive retreat for early-stage founders focusing on product development and team building.",
        image: "/placeholder.svg?height=1350&width=1080",
      },
      {
        title: "Digital Art & NFT Expo",
        date: "March 22-24, 2025",
        location: "New York, NY",
        description: "Showcase of digital art, NFT innovations, and blockchain technology for creators.",
        image: "/placeholder.svg?height=1350&width=1080",
      },
    ],
  },
]
