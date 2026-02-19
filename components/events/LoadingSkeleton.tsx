export function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-pulse">
      <div className="flex gap-6">
        {/* Image skeleton */}
        <div className="flex-shrink-0 w-32 h-24 bg-gray-200 rounded-lg"></div>

        {/* Content skeleton */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>

          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-200">
        <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>

      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="p-2 text-center">
            <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[80px] p-2 border-r border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-6 mb-2"></div>
            {/* Fixed pattern instead of random - show skeleton events on specific days */}
            {(i === 5 || i === 12 || i === 18 || i === 25 || i === 31) && (
              <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
