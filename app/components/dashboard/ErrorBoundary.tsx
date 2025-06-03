"use client"

import React from "react"
import { motion } from "motion/react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Card, CardContent } from "./ui/card"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard Error Boundary caught an error:", error, errorInfo)
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} retry={this.retry} />
      }

      return <DefaultErrorFallback error={this.state.error} retry={this.retry} />
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error?: Error
  retry: () => void
}

function DefaultErrorFallback({ error, retry }: DefaultErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-xl max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}>
              <AlertTriangle className="h-16 w-16 text-red-400 mx-auto" />
            </motion.div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Dashboard Error</h2>
              <p className="text-white/70">Something went wrong while loading the dashboard.</p>
              {error && (
                <details className="text-left mt-4">
                  <summary className="text-white/60 text-sm cursor-pointer hover:text-white/80">Error Details</summary>
                  <pre className="text-red-300 text-xs mt-2 p-2 bg-black/20 rounded overflow-auto">{error.message}</pre>
                </details>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={retry}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => (window.location.href = "/")}
                className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-200 flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </motion.button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
