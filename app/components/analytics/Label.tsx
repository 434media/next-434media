"use client"

import type React from "react"
import { motion } from "motion/react"
import { cn } from "../../lib/utils"

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  error?: boolean
  animate?: boolean
}

export function Label({ children, className, required = false, error = false, animate = false, ...props }: LabelProps) {
  const labelContent = (
    <label
      className={cn(
        "text-sm font-medium leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        error && "text-red-600",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-red-500" aria-label="required">
          *
        </span>
      )}
    </label>
  )

  if (animate) {
    return (
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {labelContent}
      </motion.div>
    )
  }

  return labelContent
}

// Additional label variants for different use cases
export function FormLabel({ children, className, ...props }: LabelProps) {
  return (
    <Label className={cn("block text-sm font-medium text-gray-700 mb-1", className)} {...props}>
      {children}
    </Label>
  )
}

export function InlineLabel({ children, className, ...props }: LabelProps) {
  return (
    <Label className={cn("inline-flex items-center text-sm font-medium text-gray-700", className)} {...props}>
      {children}
    </Label>
  )
}

export function FieldLabel({ children, className, error, ...props }: LabelProps) {
  return (
    <Label
      className={cn("block text-sm font-medium mb-2", error ? "text-red-600" : "text-gray-700", className)}
      error={error}
      {...props}
    >
      {children}
    </Label>
  )
}
