"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type React from "react"
import { createContext, useContext, useMemo, useCallback, useEffect, useState } from "react"

type ProductState = {
  [key: string]: string
} & {
  image?: string
}

type ProductContextType = {
  state: ProductState
  updateOption: (name: string, value: string) => ProductState
  updateImage: (index: string) => ProductState
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Memoize the initial state to prevent recreation on every render
  const initialState = useMemo(() => {
    const params: ProductState = {}
    for (const [key, value] of searchParams.entries()) {
      params[key] = value
    }
    return params
  }, [searchParams])

  // Use regular state instead of useOptimistic
  const [state, setState] = useState<ProductState>(initialState)

  // Update state when search params change (only if different)
  useEffect(() => {
    const newParams: ProductState = {}
    for (const [key, value] of searchParams.entries()) {
      newParams[key] = value
    }

    // Check if state actually changed to prevent unnecessary updates
    const stateKeys = Object.keys(state)
    const newParamsKeys = Object.keys(newParams)

    const hasChanged =
      stateKeys.length !== newParamsKeys.length ||
      stateKeys.some((key) => state[key] !== newParams[key]) ||
      newParamsKeys.some((key) => newParams[key] !== state[key])

    if (hasChanged) {
      setState(newParams)
    }
  }, [searchParams, state])

  const updateOption = useCallback(
    (name: string, value: string) => {
      const newState = { ...state, [name]: value }
      setState(newState)
      return newState
    },
    [state],
  )

  const updateImage = useCallback(
    (index: string) => {
      const newState = { ...state, image: index }
      setState(newState)
      return newState
    },
    [state],
  )

  const value = useMemo(
    () => ({
      state,
      updateOption,
      updateImage,
    }),
    [state, updateOption, updateImage],
  )

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProduct() {
  const context = useContext(ProductContext)
  if (context === undefined) {
    throw new Error("useProduct must be used within a ProductProvider")
  }
  return context
}

export function useUpdateURL() {
  const router = useRouter()

  return useCallback(
    (state: ProductState) => {
      const newParams = new URLSearchParams(window.location.search)
      Object.entries(state).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value)
        } else {
          newParams.delete(key)
        }
      })

      const newUrl = `?${newParams.toString()}`
      const currentUrl = window.location.search

      // Only update URL if it actually changed
      if (newUrl !== currentUrl) {
        router.push(newUrl, { scroll: false })
      }
    },
    [router],
  )
}
