"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "../../lib/utils"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options: SelectOption[]
  className?: string
  disabled?: boolean
}

export function Select({
  value,
  onValueChange,
  placeholder = "Select an option",
  options,
  className,
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value || "")
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (optionValue: string) => {
    setSelectedValue(optionValue)
    onValueChange?.(optionValue)
    setIsOpen(false)
  }

  const selectedOption = options.find((option) => option.value === selectedValue)

  return (
    <div ref={selectRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:border-gray-400 transition-colors",
          isOpen && "ring-2 ring-blue-500 border-blue-500",
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-gray-500")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
          >
            <div className="max-h-60 overflow-auto py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm text-left",
                    "hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                    "transition-colors duration-150",
                    selectedValue === option.value && "bg-blue-50 text-blue-600",
                  )}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {selectedValue === option.value && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Additional components for compatibility
export const SelectTrigger = ({ children, className, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
      className,
    )}
    {...props}
  >
    {children}
  </button>
)

export const SelectContent = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg", className)}
    {...props}
  >
    {children}
  </div>
)

export const SelectItem = ({ children, className, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn("flex w-full items-center px-3 py-2 text-sm text-left hover:bg-gray-100", className)}
    {...props}
  >
    {children}
  </button>
)

export const SelectValue = ({
  placeholder,
  className,
  ...props
}: { placeholder?: string } & React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("truncate", className)} {...props}>
    {placeholder}
  </span>
)
