"use client"

import { ChevronRight } from "lucide-react"

interface QuickActionCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}

export function QuickActionCard({ title, description, icon: Icon, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow transition-all text-left w-full group"
    >
      <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <p className="font-medium text-sm text-gray-900 mb-0.5">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 ml-auto self-center group-hover:text-gray-600 transition-colors" />
    </button>
  )
}
