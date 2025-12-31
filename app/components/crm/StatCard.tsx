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
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  }

  return (
    <div className="p-4 rounded-xl bg-white shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-gray-900 mb-1">{value}</p>
      {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
    </div>
  )
}
