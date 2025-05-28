import { Suspense } from "react"
import { BookOpen } from "lucide-react"
import { getBlogPostsAction, getBlogCategoriesAction } from "@/app/actions/blog"
import BlogCard from "../components/blog/BlogCard"
import ScrollSpinLogo from "../components/blog/ScrollSpinLogo"

async function BlogContent() {
  const [postsResult, categoriesResult] = await Promise.all([
    getBlogPostsAction({ status: "published" }),
    getBlogCategoriesAction(),
  ])

  const posts = postsResult.success ? postsResult.posts || [] : []
  const categories = categoriesResult.success ? categoriesResult.categories || [] : []

  const featuredPost = posts.length > 0 ? posts[0] : null
  const recentPosts = posts.length > 1 ? posts.slice(1, 7) : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-24 lg:pb-32 overflow-hidden">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "60px 60px sm:80px sm:80px",
            backgroundRepeat: "repeat",
            backgroundPosition: "center",
          }}
        />

        {/* Enhanced Floating Elements */}
        <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-24 h-24 sm:w-32 sm:h-32 bg-purple-400/20 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-20 h-20 sm:w-24 sm:h-24 bg-blue-400/20 rounded-full blur-xl animate-pulse delay-500" />
        <div className="absolute top-24 sm:top-32 right-1/4 w-12 h-12 sm:w-16 sm:h-16 bg-yellow-400/20 rounded-full blur-xl animate-pulse delay-700" />

        {/* Additional mobile-optimized floating elements */}
        <div className="absolute top-1/2 left-8 w-8 h-8 sm:w-12 sm:h-12 bg-emerald-400/20 rounded-full blur-lg animate-pulse delay-300" />
        <div className="absolute bottom-1/3 right-12 w-10 h-10 sm:w-14 sm:h-14 bg-pink-400/20 rounded-full blur-lg animate-pulse delay-900" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8 sm:space-y-12 lg:space-y-16">
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight">
                <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                  News & Insights
                </span>
              </h1>

              {/* Single, powerful hero message */}
              <div className="max-w-4xl mx-auto">
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-purple-100 leading-relaxed font-medium">
                  Your destination for insights from the{" "}
                  <span className="text-white font-semibold">434 Media team</span>, our{" "}
                  <span className="text-blue-300 font-semibold">local partners</span>, and breaking news from our
                  diverse ecosystem covering <span className="text-yellow-300 font-semibold">medical innovations</span>,{" "}
                  <span className="text-green-300 font-semibold">scientific breakthroughs</span>,{" "}
                  <span className="text-cyan-300 font-semibold">robotics</span>,{" "}
                  <span className="text-red-300 font-semibold">military technology</span>,{" "}
                  <span className="text-orange-300 font-semibold">TXMX Boxing</span>, and the creative industries that
                  drive our community forward.
                </p>
              </div>
            </div>

            {/* Spinning 434 Logo */}
            <div className="flex justify-center py-4 sm:py-6 lg:py-8">
              <ScrollSpinLogo />
            </div>

            {/* Enhanced Ecosystem Tags */}
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-5xl mx-auto">
              {[
                { name: "Medical", color: "bg-red-500/20 text-red-200 border-red-400/30", icon: "🏥" },
                { name: "Science", color: "bg-green-500/20 text-green-200 border-green-400/30", icon: "🔬" },
                { name: "Robotics", color: "bg-blue-500/20 text-blue-200 border-blue-400/30", icon: "🤖" },
                { name: "Military", color: "bg-gray-500/20 text-gray-200 border-gray-400/30", icon: "🛡️" },
                { name: "TXMX Boxing", color: "bg-orange-500/20 text-orange-200 border-orange-400/30", icon: "🥊" },
                { name: "Creative", color: "bg-purple-500/20 text-purple-200 border-purple-400/30", icon: "🎨" },
                { name: "Technology", color: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30", icon: "💻" },
                { name: "Community", color: "bg-yellow-500/20 text-yellow-200 border-yellow-400/30", icon: "🏘️" },
              ].map((tag) => (
                <span
                  key={tag.name}
                  className={`px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium border backdrop-blur-sm ${tag.color} hover:scale-105 transition-all duration-300 cursor-pointer hover:shadow-lg flex items-center gap-1 sm:gap-2`}
                >
                  <span className="text-sm sm:text-base">{tag.icon}</span>
                  <span className="hidden xs:inline sm:inline">{tag.name}</span>
                  <span className="xs:hidden sm:hidden">{tag.name.split(" ")[0]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Wave Transition */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-auto">
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(249, 250, 251)" />
                <stop offset="50%" stopColor="rgb(243, 244, 246)" />
                <stop offset="100%" stopColor="rgb(249, 250, 251)" />
              </linearGradient>
            </defs>
            <path
              fill="url(#waveGradient)"
              d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Enhanced Categories Filter */}
          <div className="mb-12 sm:mb-16">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Explore by Category</h2>
              <p className="text-sm sm:text-base text-gray-600">Discover content across our diverse ecosystem</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
              <button className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full text-sm sm:text-base font-medium hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg">
                All News & Insights
              </button>
              {categories &&
                categories.length > 0 &&
                categories.map((category) => (
                  <button
                    key={category.slug}
                    className="px-4 py-2 sm:px-6 sm:py-3 bg-white text-gray-700 rounded-full text-sm sm:text-base font-medium hover:bg-gray-100 transition-all transform hover:scale-105 border border-gray-200 shadow-sm hover:shadow-md"
                  >
                    {category.name} ({category.post_count || 0})
                  </button>
                ))}
            </div>
          </div>

          {/* Featured Post */}
          {featuredPost && (
            <div className="mb-12 sm:mb-16">
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Featured Story</h2>
                <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto rounded-full" />
              </div>
              <BlogCard post={featuredPost} featured />
            </div>
          )}

          {/* Recent Posts */}
          {recentPosts && recentPosts.length > 0 && (
            <div>
              <div className="text-center mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  Latest from Our Ecosystem
                </h2>
                <p className="text-sm sm:text-base text-gray-600 max-w-3xl mx-auto leading-relaxed">
                  Stay connected with the latest developments, insights from our team, updates from local partners, and
                  breaking news across medical, science, robotics, military, TXMX Boxing, and creative industries
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {recentPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Empty State */}
          {(!posts || posts.length === 0) && (
            <div className="text-center py-12 sm:py-16">
              <div className="relative mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full mx-auto flex items-center justify-center">
                  <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 bg-yellow-400 rounded-full animate-pulse" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Coming Soon!</h3>
              <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto leading-relaxed">
                We&apos;re preparing amazing content covering our entire ecosystem. Check back soon for insights, news, and
                stories from the 434 Media community!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function BlogSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-pulse space-y-8 sm:space-y-12">
            <div className="space-y-4 sm:space-y-6">
              <div className="h-12 sm:h-16 lg:h-20 bg-white/20 rounded-lg mx-auto max-w-2xl" />
              <div className="h-6 sm:h-8 bg-white/10 rounded-lg mx-auto max-w-4xl" />
            </div>
            <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 bg-white/20 rounded-full mx-auto" />
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-center max-w-4xl mx-auto">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-6 sm:h-8 w-16 sm:w-20 bg-white/10 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-40 sm:h-48 bg-gray-200 rounded-xl mb-4" />
                <div className="h-5 sm:h-6 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogSkeleton />}>
      <BlogContent />
    </Suspense>
  )
}
