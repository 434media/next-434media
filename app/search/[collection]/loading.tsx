export default function CollectionLoading() {
    return (
      <div className="animate-fade-in">
        {/* Banner skeleton */}
        <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden bg-neutral-100 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
  
        {/* Products grid skeleton */}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="h-8 w-48 bg-neutral-200 rounded-md animate-pulse mb-8" />
  
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-neutral-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }
  