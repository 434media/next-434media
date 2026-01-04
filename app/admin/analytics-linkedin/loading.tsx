export default function LinkedInAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#0077B5] border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-600 text-sm">Loading LinkedIn Analytics...</p>
      </div>
    </div>
  )
}
