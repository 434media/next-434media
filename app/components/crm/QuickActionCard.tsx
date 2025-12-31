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
      className="flex items-start gap-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors text-left w-full group"
    >
      <div className="p-2 rounded-lg bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
        <Icon className="w-5 h-5 text-neutral-300" />
      </div>
      <div>
        <p className="font-medium text-sm mb-0.5">{title}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-600 ml-auto self-center group-hover:text-neutral-400 transition-colors" />
    </button>
  )
}
