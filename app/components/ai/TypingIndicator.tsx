"use client"

import { motion } from "motion/react"

export default function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/10">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div className="bg-white border border-purple-100/60 rounded-2xl px-4 py-3 shadow-sm relative overflow-hidden">
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
            style={{
              background:
                "radial-gradient(circle at 25% 30%, rgba(168,85,247,0.15), transparent 60%), radial-gradient(circle at 80% 70%, rgba(124,58,237,0.15), transparent 65%)",
            }}
          />
          <div className="flex gap-1 relative">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-2 h-2 bg-purple-400 rounded-full"
                animate={{
                  y: [0, -4, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: index * 0.18,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
