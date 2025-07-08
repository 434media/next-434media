"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "../analytics/Card"
import { Button } from "../analytics/Button"
import { Badge } from "../analytics/Badge"

export function MagazineInfo() {
  const [email, setEmail] = useState("")
  const [isSubscribed, setIsSubscribed] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    // Add newsletter subscription logic here
    setIsSubscribed(true)
    setTimeout(() => setIsSubscribed(false), 3000)
  }

  const features = [
    {
      icon: "🎨",
      title: "Interactive Design",
      description: "3D layouts that respond to your touch and movement",
    },
    {
      icon: "📱",
      title: "Multi-Platform",
      description: "Seamless experience across all devices and platforms",
    },
    {
      icon: "🚀",
      title: "Cutting-Edge Tech",
      description: "Built with the latest web technologies and frameworks",
    },
    {
      icon: "✨",
      title: "Immersive Stories",
      description: "Content that comes alive through interactive elements",
    },
  ]

  return (
    <section className="relative py-20 px-8">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800" />

      <div className="relative max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-purple-500/20 text-purple-300 border-purple-400/30">
            The Future of Digital Publishing
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Redefining Digital{" "}
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Storytelling
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Digital Canvas represents the next evolution in digital publishing, where creativity meets technology to
            create immersive, interactive experiences that engage readers like never before.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm p-6 hover:bg-slate-800/70 transition-all duration-300 group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>

        {/* Newsletter Signup */}
        <Card className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 border-purple-400/30 backdrop-blur-sm p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Be the First to Experience Digital Canvas</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Join our exclusive list to get early access to Digital Canvas and be notified when our first interactive
            magazine launches.
          </p>

          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              required
            />
            <Button
              type="submit"
              className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105"
              disabled={isSubscribed}
            >
              {isSubscribed ? "✓ Subscribed!" : "Notify Me"}
            </Button>
          </form>
        </Card>

        {/* Coming Soon Timeline */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-white mb-8">Launch Timeline</h3>
          <div className="flex flex-col md:flex-row justify-center items-center space-y-8 md:space-y-0 md:space-x-12">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-purple-500/20 border-2 border-purple-400 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Q1 2024</h4>
              <p className="text-slate-400 text-center max-w-xs">
                Beta testing with select partners and early adopters
              </p>
            </div>

            <div className="hidden md:block w-20 h-px bg-gradient-to-r from-purple-400/50 to-cyan-400/50" />

            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-cyan-500/20 border-2 border-cyan-400 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Q2 2024</h4>
              <p className="text-slate-400 text-center max-w-xs">Public launch with our inaugural digital magazine</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
