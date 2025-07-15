export interface MagazineSection {
  id: string
  title: string
  subtitle: string
  color: string
  preview: string
  content: {
    fullText: string
    images?: string[]
    videos?: string[]
    links?: Array<{
      title: string
      url: string
    }>
    events?: Array<{
      title: string
      date: string
      location: string
      description: string
    }>
    gallery?: Array<{
      src: string
      alt: string
      caption: string
    }>
  }
}

// Volume 1:
const volume1Content: MagazineSection[] = [
  {
    id: "founders-note-v1",
    title: "FOUNDER'S NOTE",
    subtitle: "Proximity Matters",
    color: "bg-gradient-to-br from-purple-500 to-pink-600",
    preview:
      "The Road to RGV Startup Week",
    content: {
      fullText: `Welcome to Digital Canvas Volume #001 - The Road to RGVSW.

You can’t tell meaningful stories from a distance which is why our team headed to Brownsville for RGV Startup Week 2025. This wasn’t a one-off trip. We’ve been building relationships in the Rio Grande Valley for months.

At 434 Media, we believe storytelling is a team sport. It takes care, consistency, and cultural awareness to bring someone else’s vision to life, especially when those stories are shaping the future of public health, economic opportunity, and innovation.

Whether it’s SDOH work in the Valley, closing the digital gap with TechBloc, supporting ecosystem builders at Emerge and Rise, or sharing a message with a connected community — it all comes back to one thing: access. Access to health, tech, capital, or simply a seat at the table. The stories we tell are about real people building real things. Actions Speak Louder!

- Marcos Resendez, Founder
434 MEDIA`,
      images: ["https://ampd-asset.s3.us-east-2.amazonaws.com/Marcos+Headshot+3.jpg"],
      links: [
        { title: "434 MEDIA Website", url: "https://434media.com" },
      ],
    },
  },
  {
    id: "month-in-motion-v1",
    title: "MONTH IN MOTION",
    subtitle: "June 2025 Highlights",
    color: "bg-gradient-to-br from-blue-500 to-cyan-600",
    preview: "A visual journey through the most impactful moments of June 2025",
    content: {
      fullText: `At 434 MEDIA, we believe storytelling is a team sport

Key Highlights:
• Emerge and Rise Open House
• Cine Las Americas
• Closing the Digital Gap
• The Road to RGVSW: Proximity Matters

This visual narrative captures not just the events, but the energy, passion, and determination that defines our community. Each frame tells a story of innovation, collaboration, and the relentless pursuit of turning ideas into reality.

The momentum built in June 2025 will ripple through the entire year, setting new standards for what's possible in the Rio Grande Valley.`,
      images: ["https://ampd-asset.s3.us-east-2.amazonaws.com/Marcos+Headshot+3.jpg"],
      links: [
        { title: "434 MEDIA Website", url: "https://434media.com" },
      ],
    },
  },
  {
    id: "the-drop-v1",
    title: "THE DROP",
    subtitle: "Exclusive Releases",
    color: "bg-gradient-to-br from-red-500 to-orange-600",
    preview: "Get first access to exclusive content, products, and experiences from the Digital Canvas network.",
    content: {
      fullText: `THE DROP - Exclusive Access to What's Next

Welcome to The Drop, your gateway to exclusive releases, limited-time offers, and first access to groundbreaking content from the Digital Canvas network.

This Month's Exclusive Drops:

🎯 Digital Canvas Founding Member NFTs
Limited edition collectibles for our first 1,000 readers. Each NFT grants special access to future content and exclusive events.

📱 Interactive Story Builder Beta
Be among the first to try our revolutionary story creation tool. Build your own interactive narratives with our intuitive drag-and-drop interface.

🎪 RGV Startup Week VIP Experience
Exclusive access to private founder dinners, behind-the-scenes content, and networking opportunities during RGV Startup Week.

📚 Digital Canvas Archive Access
Unlock our complete content library, including unreleased stories, extended interviews, and bonus materials.

🎨 Custom Digital Canvas Merchandise
Limited edition apparel and accessories designed by local RGV artists, available only to Drop subscribers.

How The Drop Works:
• New exclusive releases every month
• Limited quantities and time-sensitive offers
• Member-only pricing and early access
• Exclusive community features and events
• Direct connection with creators and founders

Join The Drop community and be part of the Digital Canvas inner circle. These exclusive experiences are designed for our most engaged readers who want to go deeper into the stories and connect with the creators behind them.

Don't miss out - these drops are limited and won't be available anywhere else.`,
      gallery: [
        {
          src: "/placeholder.svg?height=300&width=400&text=NFT+Collection",
          alt: "Digital Canvas NFT Collection",
          caption: "Founding Member NFT Collection - Limited to 1,000 pieces",
        },
        {
          src: "/placeholder.svg?height=300&width=400&text=Story+Builder+Interface",
          alt: "Interactive Story Builder",
          caption: "Beta version of our story creation tool",
        },
        {
          src: "/placeholder.svg?height=300&width=400&text=VIP+Event+Access",
          alt: "VIP Event Experience",
          caption: "Exclusive access to founder events and networking",
        },
      ],
      links: [
        { title: "Join The Drop", url: "#join-drop" },
        { title: "View Current Drops", url: "#current-drops" },
        { title: "Drop Calendar", url: "#drop-calendar" },
      ],
    },
  },
]

// Volume 2: Hero's Journey - On the Road to Fight Night
const volume2Content: MagazineSection[] = [
  {
    id: "founders-note-v2",
    title: "FOUNDER'S NOTE",
    subtitle: "The Journey Continues",
    color: "bg-gradient-to-br from-red-600 to-orange-700",
    preview:
      "Progress moves at the speed of trust",
    content: {
      fullText: `The more rooms we step into, the clearer the pattern becomes: progress moves at the speed of trust. 
      
      We felt that at AIM 2025, where collaboration wasn’t a buzzword it was the agenda. 
      At TechBloc’s Conclave, we saw what consistency really does for a community. 
      And at Nucleate Demo Day, we witnessed bold ideas backed by serious science. 

- Marcos Resendez, Founder
434 MEDIA`,
      images: ["https://ampd-asset.s3.us-east-2.amazonaws.com/Marcos+Headshot+2.jpg"],
      links: [
        { title: "TXMX Boxing", url: "https://www.txmxboxing.com/" },
      ],
    },
  },
]

// Volume 3: Coming Soon
const volume3Content: MagazineSection[] = [
  {
    id: "coming-soon-v3",
    title: "COMING SOON",
    subtitle: "Volume 3 in Development",
    color: "bg-gradient-to-br from-slate-600 to-gray-700",
    preview: "Volume 3 is currently in development. Stay tuned for the next chapter in our entrepreneurial journey.",
    content: {
      fullText: `Volume #003 - Coming Soon

- The Digital Canvas Team`,
      images: ["/placeholder.svg?height=400&width=600&text=Coming+Soon+Volume+3"],
      links: [
        { title: "Subscribe for Updates", url: "#subscribe" },
        { title: "Explore Volume 1", url: "#volume-1" },
        { title: "Explore Volume 2", url: "#volume-2" },
      ],
    },
  },
]

export function getVolumeContent(volume: number): MagazineSection[] {
  switch (volume) {
    case 0:
      return volume1Content
    case 1:
      return volume2Content
    case 2:
      return volume3Content
    default:
      return volume1Content
  }
}
