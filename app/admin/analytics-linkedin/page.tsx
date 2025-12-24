import dynamic from "next/dynamic"

const LinkedInAnalyticsClientPage = dynamic(() => import("./LinkedInAnalyticsClientPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#0077B5] border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Loading LinkedIn Analytics...</p>
      </div>
    </div>
  ),
})

export default function LinkedInAnalyticsPage() {
  return <LinkedInAnalyticsClientPage />
}
