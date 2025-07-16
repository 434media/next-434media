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
    subtitle: "May 2025 Highlights",
    color: "bg-gradient-to-br from-blue-500 to-cyan-600",
    preview: "A visual journey through the most impactful moments of May 2025",
    content: {
      fullText: `At 434 MEDIA, we believe storytelling is a team sport

Key Highlights:
• Emerge and Rise Open House
• Cine Las Americas
• Closing the Digital Gap
• The Road to RGVSW: Proximity Matters

This visual narrative captures not just the events, but the energy, passion, and determination that defines our community. Each frame tells a story of innovation, collaboration, and the relentless pursuit of turning ideas into reality.`,
      images: [
        "https://ampd-asset.s3.us-east-2.amazonaws.com/IMG_5473.jpg",
        "https://ampd-asset.s3.us-east-2.amazonaws.com/IMG_1623.jpg",
        "https://ampd-asset.s3.us-east-2.amazonaws.com/IMG_5508.jpg",
        "https://ampd-asset.s3.us-east-2.amazonaws.com/56.JPG"
      ],
      links: [
        { title: "Emerge & Rise", url: "https://emergeandrise.org/" },
        { title: "Cine Las Americas", url: "https://cinelasamericas.org/" },
        { title: "Tech Bloc", url: "https://satechbloc.com/" },
      ],
    },
  },
  {
    id: "the-drop-v1",
    title: "THE DROP",
    subtitle: "Featured Event",
    color: "bg-gradient-to-br from-red-500 to-orange-600",
    preview: "AIM Health R&D Summit 2025",
    content: {
      fullText: `The AIM Health R&D Summit brings together top innovators from academia, industry, and the military to accelerate the research, development, and commercialization of transformative medical technologies.
      
This unique convergence of thought leaders creates pathways to discovery and commercialization while addressing critical challenges in military and civilian healthcare.
      
Join us in shaping the future of healthcare innovation through collaboration, breakthrough research, and transformative partnerships that save lives.`,
      images: [
        "https://ampd-asset.s3.us-east-2.amazonaws.com/keynote.jpeg",
      ],
      links: [
        { title: "AIM Health R&D Summit 2025", url: "https://www.aimsatx.com/" },
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
  {
    id: "month-in-motion-v2",
    title: "MONTH IN MOTION",
    subtitle: "June 2025 Highlights",
    color: "bg-gradient-to-br from-indigo-500 to-rose-600",
    preview: "A visual journey through the most impactful moments of June 2025",
    content: {
      fullText: `At 434 MEDIA, we believe storytelling is a team sport

Key Highlights:
• AIM Health R&D Summit
• Nucleate Demo Day
• Tech Bloc Conclave

This visual narrative captures not just the events, but the energy, passion, and determination that defines our community. Each frame tells a story of innovation, collaboration, and the relentless pursuit of turning ideas into reality.`,
      images: [
        "https://ampd-asset.s3.us-east-2.amazonaws.com/pham.jpeg",
      ],
      links: [
        { title: "Nucleate", url: "https://nucleate.org/" },
      ],
    },
  },
  {
    id: "the-drop-v2",
    title: "THE DROP",
    subtitle: "Featured Event",
    color: "bg-gradient-to-br from-emerald-500 to-orange-600",
    preview: "Velocity TX - Committed to Commnunity",
    content: {
      fullText: `Curious how AI is changing the job market—and how you can stay ahead by building valuable skills?

Learn how to leverage these powerful tools at “AI & the Job Market," a free community workshop led by The AI Cowboys. This hands-on session will show you how to craft a strong resume, prepare for interviews, and research job opportunities, all with the power of AI.

Brought to you in partnership with LISC San Antonio and San Antonio for Growth on the Eastside (SAGE), this beginner-friendly workshop is designed to help you utilize AI to empower your job search, whether you're a student, job seeker, entrepreneur, or simply curious. No tech experience needed—just bring your laptop and your curiosity!
      `,
      images: [
        "https://ampd-asset.s3.us-east-2.amazonaws.com/cowboys.jpeg",
      ],
      links: [
        { title: "AI & The Job Market", url: "https://www.eventbrite.com/e/ai-the-job-market-eastside-education-series-tickets-1304156670709" },
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
      images: ["https://ampd-asset.s3.us-east-2.amazonaws.com/flyers-35-bsides.PNG"],
      links: [
        { title: "434 MEDIA", url: "https://www.434media.com/" },
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
