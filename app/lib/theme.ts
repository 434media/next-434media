"use client"

// Simplified theme configuration - dark mode only
export const dashboardTheme = {
  background: "hsl(222.2 84% 4.9%)", // Dark background
  foreground: "hsl(210 40% 98%)", // Light text
  card: "hsl(217.2 32.6% 17.5%)", // Dark card background
  "card-foreground": "hsl(210 40% 98%)",
  border: "hsl(217.2 32.6% 17.5%)",
  muted: "hsl(215.4 16.3% 46.9%)",
  "muted-foreground": "hsl(215 20.2% 65.1%)",
  accent: "hsl(217.2 32.6% 17.5%)",
  "accent-foreground": "hsl(210 40% 98%)",
}

// Chart color palette - optimized for dark backgrounds
export const chartColors = {
  primary: "#3b82f6", // Blue
  secondary: "#8b5cf6", // Purple
  success: "#10b981", // Emerald
  warning: "#f59e0b", // Amber
  danger: "#ef4444", // Red
  info: "#06b6d4", // Cyan
  chart1: "#f97316", // Orange
  chart2: "#06b6d4", // Cyan
  chart3: "#8b5cf6", // Purple
  chart4: "#f59e0b", // Amber
  chart5: "#ec4899", // Pink
}

// Gradient definitions for visual appeal
export const gradients = {
  primary: "from-blue-500/20 via-purple-500/20 to-pink-500/20",
  card: "from-white/5 to-white/10",
  success: "from-emerald-500/20 to-green-500/20",
  warning: "from-amber-500/20 to-orange-500/20",
  danger: "from-red-500/20 to-pink-500/20",
}
