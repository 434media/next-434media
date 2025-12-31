"use client"

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  icon: React.ComponentType<{ className?: string }>
  color: "blue" | "emerald" | "green" | "purple" | "amber"
}

export function StatCard({ label, value, subValue, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    green: "bg-green-500/10 text-green-400",
    purple: "bg-purple-500/10 text-purple-400",
    amber: "bg-amber-500/10 text-amber-400",
  }

  return (
    <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-400 uppercase tracking-wider">{label}</span>
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold mb-1">{value}</p>
      {subValue && <p className="text-xs text-neutral-500">{subValue}</p>}
    </div>
  )
}
