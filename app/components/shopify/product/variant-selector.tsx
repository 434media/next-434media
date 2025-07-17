"use client"

import clsx from "clsx"
import { useProduct, useUpdateURL } from "./product-context"
import type { ProductOption, ProductVariant } from "../../../lib/shopify/types"
import { useState, useEffect } from "react"
import { Info } from "lucide-react"

type Combination = {
  id: string
  availableForSale: boolean
  [key: string]: string | boolean
}

interface VariantSelectorProps {
  options: ProductOption[]
  variants: ProductVariant[]
  hasSizeBasedPricing?: boolean
}

export function VariantSelector({ options, variants, hasSizeBasedPricing = false }: VariantSelectorProps) {
  const { state, updateOption } = useProduct()
  const updateURL = useUpdateURL()
  const hasNoOptionsOrJustOneOption = !options.length || (options.length === 1 && options[0]?.values.length === 1)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, boolean>>({})

  // Track which options have been selected
  useEffect(() => {
    const newSelectedOptions: Record<string, boolean> = {}
    options.forEach((option) => {
      const optionName = option.name.toLowerCase()
      newSelectedOptions[optionName] = !!state[optionName]
    })
    setSelectedOptions(newSelectedOptions)
  }, [state, options])

  if (hasNoOptionsOrJustOneOption) {
    return null
  }

  const combinations: Combination[] = variants.map((variant) => ({
    id: variant.id,
    availableForSale: variant.availableForSale,
    ...variant.selectedOptions.reduce(
      (accumulator, option) => ({ ...accumulator, [option.name.toLowerCase()]: option.value }),
      {},
    ),
  }))

  return options.map((option) => {
    const optionName = option.name.toLowerCase()
    const isSelected = !!selectedOptions[optionName]
    const isSizeOption = optionName === "size"

    return (
      <form key={option.id}>
        <dl className="mb-8">
          <dt className="mb-6 flex items-center gap-3">
            <span className="text-xl md:text-2xl uppercase tracking-wider font-black text-white">{option.name}</span>
            {!isSelected && (
              <span className="border-2 border-white bg-black px-3 py-1 text-sm font-black tracking-wide uppercase text-white">
                Required
              </span>
            )}
            {isSizeOption && hasSizeBasedPricing && (
              <div className="flex items-center gap-2 border border-white/50 bg-black px-2 py-1">
                <Info className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-white uppercase tracking-wide">Price varies by size</span>
              </div>
            )}
          </dt>
          <dd className="flex flex-wrap gap-4">
            {option.values.map((value) => {
              const optionNameLowerCase = option.name.toLowerCase()

              // Base option params on current selectedOptions so we can preserve any other param state.
              const optionParams = { ...state, [optionNameLowerCase]: value }

              // Filter out invalid options and check if the option combination is available for sale.
              const filtered = Object.entries(optionParams).filter(([key, value]) =>
                options.find((option) => option.name.toLowerCase() === key && option.values.includes(value)),
              )
              const isAvailableForSale = combinations.find((combination) =>
                filtered.every(([key, value]) => combination[key] === value && combination.availableForSale),
              )

              // The option is active if it's in the selected options.
              const isActive = state[optionNameLowerCase] === value

              return (
                <button
                  formAction={() => {
                    const newState = updateOption(optionNameLowerCase, value)
                    updateURL(newState)
                  }}
                  key={value}
                  aria-disabled={!isAvailableForSale}
                  disabled={!isAvailableForSale}
                  title={`${option.name} ${value}${!isAvailableForSale ? " (Out of Stock)" : ""}`}
                  className={clsx(
                    "flex min-w-[60px] items-center justify-center border-2 px-4 py-3 text-base font-black tracking-wide uppercase transition-all duration-300 relative overflow-hidden group",
                    {
                      "border-white bg-white text-black": isActive,
                      "border-white bg-black text-white hover:bg-white hover:text-black":
                        !isActive && isAvailableForSale,
                      "border-white/30 bg-black text-white/30 cursor-not-allowed relative before:absolute before:inset-0 before:bg-gradient-to-br before:from-transparent before:via-white/10 before:to-transparent before:rotate-45":
                        !isAvailableForSale,
                    },
                  )}
                >
                  {!isActive && isAvailableForSale && (
                    <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  )}
                  <span className="relative z-10 transition-colors duration-300">{value}</span>
                </button>
              )
            })}
          </dd>
        </dl>
      </form>
    )
  })
}
