import { Card, CardContent, CardHeader } from "@/components/analytics/Card"

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded-lg w-64 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse" />
        </div>

        {/* Status and Date Range Skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-6 bg-gray-200 rounded-full w-24 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded-lg w-64 animate-pulse" />
        </div>

        {/* Metrics Overview Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse mb-2" />
                <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-5 bg-gray-200 rounded w-40 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-64 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

