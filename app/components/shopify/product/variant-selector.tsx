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
          <dt className="mb-4 flex items-center gap-2">
            <span
              className={`text-sm uppercase tracking-wide font-medium ${isSelected ? "text-white" : "text-amber-400"}`}
            >
              {option.name}
            </span>
            {!isSelected && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-400">Required</span>
            )}
            {isSizeOption && hasSizeBasedPricing && (
              <div className="flex items-center gap-1 text-xs text-amber-300/80">
                <Info className="h-3 w-3" />
                <span>Price varies by size</span>
              </div>
            )}
          </dt>
          <dd className="flex flex-wrap gap-3">
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
                    "flex min-w-[48px] items-center justify-center rounded-full border px-3 py-2 text-sm font-medium",
                    {
                      "cursor-default bg-emerald-600 text-white border-emerald-600": isActive,
                      "border-neutral-600 bg-neutral-800 text-white hover:border-neutral-400":
                        !isActive && isAvailableForSale,
                      "relative z-10 cursor-not-allowed overflow-hidden bg-neutral-800 text-neutral-500 ring-1 ring-neutral-600 before:absolute before:inset-x-0 before:-z-10 before:h-px before:-rotate-45 before:bg-neutral-600 before:transition-transform":
                        !isAvailableForSale,
                    },
                  )}
                >
                  {value}
                </button>
              )
            })}
          </dd>
        </dl>
      </form>
    )
  })
}