import dynamic from "next/dynamic"

// Dynamically import to avoid SSR issues with motion/react & window usage
const FAQAssistant = dynamic(() => import("../components/ai/FAQAssistant"), { ssr: false })

export const metadata = {
  title: "FAQ | 434 Media",
  description: "Frequently asked questions answered by the 434 Media AI knowledge assistant.",
}

export default function FAQPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-6">Frequently Asked Questions</h1>
      <p className="text-slate-600 mb-10 max-w-2xl">
        Use our AI-powered assistant to explore common questions about 434 Media. These answers come from our internal
        knowledge base. Always verify details with the sales team for anything project-specific.
      </p>
      <FAQAssistant />
    </div>
  )
}
