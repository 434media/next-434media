"use client"

import { motion, AnimatePresence } from "motion/react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import type { Toast as ToastType } from "./types"

interface ToastProps {
  toast: ToastType | null
}

export function Toast({ toast }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border ${
            toast.type === "success"
              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
              : toast.type === "error"
              ? "bg-red-500/20 border-red-500/30 text-red-400"
              : "bg-amber-500/20 border-amber-500/30 text-amber-400"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
