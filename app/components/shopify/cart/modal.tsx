"use client"

import { DialogPanel, Dialog, Transition, TransitionChild } from "@headlessui/react"
import { DEFAULT_OPTION } from "../../../lib/constants"
import { createUrl } from "../../../lib/utils"
import Image from "next/image"
import Link from "next/link"
import { Fragment, useEffect, useRef, useState } from "react"
import { createCartAndSetCookie, getCheckoutUrl } from "./actions"
import { useCart } from "./cart-context"
import { DeleteItemButton } from "./delete-item-button"
import { EditItemQuantityButton } from "./edit-item-quantity-button"
import OpenCart from "./open-cart"
import LoadingDots from "../loading-dots"
import Price from "../price"
import { CheckCircle, ExternalLink, ShoppingBag } from "lucide-react"

type MerchandiseSearchParams = {
  [key: string]: string
}

// Define checkout states as a const object to help TypeScript
const CHECKOUT_STATES = {
  IDLE: "idle" as const,
  PROCESSING: "processing" as const,
  IN_PROGRESS: "in_progress" as const,
  COMPLETED: "completed" as const,
  ERROR: "error" as const,
}

type CheckoutState = (typeof CHECKOUT_STATES)[keyof typeof CHECKOUT_STATES]

export default function CartModal() {
  const { cart, updateCartItem, hasValidCheckout } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(CHECKOUT_STATES.IDLE)
  const [checkoutWindow, setCheckoutWindow] = useState<Window | null>(null)
  const quantityRef = useRef(cart?.totalQuantity)
  const checkoutIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const openCart = () => setIsOpen(true)
  const closeCart = () => {
    if (checkoutState !== CHECKOUT_STATES.IN_PROGRESS) {
      setIsOpen(false)
      // Reset checkout state when closing the cart
      if (checkoutState !== CHECKOUT_STATES.IDLE) {
        setCheckoutState(CHECKOUT_STATES.IDLE)
      }
    } else {
      // If checkout is in progress, ask for confirmation
      if (window.confirm("Checkout is in progress. Are you sure you want to close this window?")) {
        setIsOpen(false)
        setCheckoutState(CHECKOUT_STATES.IDLE)
      }
    }
  }

  // Reset checkout state when cart changes
  useEffect(() => {
    if (cart && cart.lines.length === 0 && checkoutState !== CHECKOUT_STATES.IDLE) {
      setCheckoutState(CHECKOUT_STATES.IDLE)
    }
  }, [cart, checkoutState])

  useEffect(() => {
    if (!cart) {
      createCartAndSetCookie()
    }
  }, [cart])

  useEffect(() => {
    if (cart?.totalQuantity && cart?.totalQuantity !== quantityRef.current && cart?.totalQuantity > 0) {
      if (!isOpen) {
        setIsOpen(true)
      }
      quantityRef.current = cart?.totalQuantity
    }
  }, [isOpen, cart?.totalQuantity, quantityRef])

  // Set up listener for storage events to detect checkout completion
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "shopify_checkout_status" && e.newValue) {
        try {
          const status = JSON.parse(e.newValue)
          if (status.cartId === cart?.id && status.status === "completed") {
            setCheckoutState(CHECKOUT_STATES.COMPLETED)
            // Clear the checkout status after processing
            localStorage.removeItem("shopify_checkout_status")
            // Refresh the cart after a short delay
            setTimeout(() => {
              createCartAndSetCookie()
            }, 2000)
          }
        } catch (error) {
          console.error("Error parsing checkout status:", error)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [cart?.id])

  // Check if checkout window is still open
  useEffect(() => {
    if (checkoutState === CHECKOUT_STATES.IN_PROGRESS && checkoutWindow) {
      if (checkoutIntervalRef.current) {
        clearInterval(checkoutIntervalRef.current)
      }

      checkoutIntervalRef.current = setInterval(() => {
        if (checkoutWindow.closed) {
          clearInterval(checkoutIntervalRef.current!)
          checkoutIntervalRef.current = null
          setCheckoutWindow(null)
          // Check if the cart is empty (indicating a successful purchase)
          if (cart && cart.lines.length === 0) {
            setCheckoutState(CHECKOUT_STATES.COMPLETED)
          } else {
            // If cart still has items, assume checkout was abandoned
            setCheckoutState(CHECKOUT_STATES.IDLE)
          }
        }
      }, 1000)
    }

    return () => {
      if (checkoutIntervalRef.current) {
        clearInterval(checkoutIntervalRef.current)
        checkoutIntervalRef.current = null
      }
    }
  }, [checkoutState, checkoutWindow, cart])

  const handleCheckout = async () => {
    try {
      setIsCheckingOut(true)
      setCheckoutError(null)
      setCheckoutState(CHECKOUT_STATES.PROCESSING)

      if (!hasValidCheckout) {
        // If there's no valid checkout URL, create a new cart
        await createCartAndSetCookie()
      }

      const checkoutUrl = await getCheckoutUrl()
      if (checkoutUrl) {
        // Store the cart ID in localStorage to track this checkout
        localStorage.setItem("shopify_checkout_cart_id", cart?.id || "")

        // Open checkout in new window - Fixed for mobile
        try {
          // Use a more mobile-friendly approach
          const newWindow = window.open(
            checkoutUrl,
            "_blank",
            "noopener,noreferrer,width=800,height=600,scrollbars=yes,resizable=yes",
          )

          // Check if window was blocked
          if (!newWindow || newWindow.closed || typeof newWindow.closed == "undefined") {
            // Fallback: try to navigate in the same window on mobile
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
              window.location.href = checkoutUrl
              return
            } else {
              throw new Error("Popup blocked")
            }
          }

          setCheckoutWindow(newWindow)
          setCheckoutState(CHECKOUT_STATES.IN_PROGRESS)
        } catch (error) {
          console.error("Error opening checkout window:", error)
          // Fallback for mobile devices - navigate in same window
          if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.location.href = checkoutUrl
          } else {
            setCheckoutState(CHECKOUT_STATES.ERROR)
            setCheckoutError("Could not open checkout window. Please check your popup blocker settings.")
          }
        }
      } else {
        setCheckoutState(CHECKOUT_STATES.ERROR)
        setCheckoutError("Could not generate checkout URL. Please try again.")
      }
    } catch (error) {
      console.error("Error preparing checkout:", error)
      setCheckoutState(CHECKOUT_STATES.ERROR)
      setCheckoutError("There was an error preparing your checkout. Please try again.")
    } finally {
      setIsCheckingOut(false)
    }
  }

  const resetCart = async () => {
    await createCartAndSetCookie()
    setCheckoutState(CHECKOUT_STATES.IDLE)
  }

  // Helper function to check if checkout is in progress
  const isCheckoutInProgress = () => {
    return checkoutState === CHECKOUT_STATES.IN_PROGRESS
  }

  // Render different content based on checkout state
  const renderCartContent = () => {
    if (checkoutState === CHECKOUT_STATES.COMPLETED) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-black">
          <div className="w-16 h-16 mb-4 rounded-sm bg-black border-2 border-white flex items-center justify-center group relative overflow-hidden">
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <CheckCircle className="h-10 w-10 text-white group-hover:text-black relative z-10 transition-colors duration-500" />
          </div>
          <h3 className="text-xl font-black tracking-wider uppercase mb-2 text-white">Thank you for your order!</h3>
          <p className="text-white/70 mb-6 font-medium">Your order has been placed successfully.</p>
          <button
            onClick={() => {
              resetCart()
              closeCart()
            }}
            className="group relative overflow-hidden bg-black border-2 border-white px-8 py-3 font-black tracking-wider uppercase text-white transition-all duration-500 hover:text-black"
          >
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <span className="relative z-10">Continue Shopping</span>
          </button>
        </div>
      )
    }

    if (checkoutState === CHECKOUT_STATES.IN_PROGRESS) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-black">
          <div className="w-16 h-16 mb-4 rounded-sm bg-black border-2 border-white flex items-center justify-center group relative overflow-hidden">
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <ShoppingBag className="h-10 w-10 text-white group-hover:text-black relative z-10 transition-colors duration-500" />
          </div>
          <h3 className="text-xl font-black tracking-wider uppercase mb-2 text-white">Checkout in Progress</h3>
          <p className="text-white/70 mb-2 font-medium">Please complete your purchase in the checkout window.</p>
          <p className="text-white/70 mb-6 font-medium flex items-center justify-center">
            <ExternalLink className="inline h-4 w-4 mr-1" />
            Your checkout is continuing in a new tab
          </p>
          <button
            onClick={closeCart}
            className="group relative overflow-hidden bg-black border-2 border-white px-8 py-3 font-black tracking-wider uppercase text-white transition-all duration-500 hover:text-black"
          >
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <span className="relative z-10">Continue Shopping</span>
          </button>
        </div>
      )
    }

    if (!cart || cart.lines.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-black">
          <div className="w-16 h-16 mb-4 rounded-sm bg-black border-2 border-white flex items-center justify-center group relative overflow-hidden">
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <i
              className="ri-shopping-cart-line text-3xl text-white group-hover:text-black relative z-10 transition-colors duration-500"
              aria-hidden="true"
            ></i>
          </div>
          <p className="text-xl font-black tracking-wider uppercase mb-2 text-white">Your cart is empty</p>
          <p className="text-white/70 mb-6 font-medium">Looks like you haven't added anything to your cart yet.</p>
          <button
            onClick={closeCart}
            className="group relative overflow-hidden bg-black border-2 border-white px-8 py-3 font-black tracking-wider uppercase text-white transition-all duration-500 hover:text-black"
          >
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <span className="relative z-10">Continue Shopping</span>
          </button>
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col justify-between overflow-hidden bg-black">
        <ul className="grow overflow-auto py-4 px-4 space-y-4">
          {cart.lines
            .sort((a, b) => a.merchandise.product.title.localeCompare(b.merchandise.product.title))
            .map((item, i) => {
              const merchandiseSearchParams = {} as MerchandiseSearchParams

              item.merchandise.selectedOptions.forEach(({ name, value }) => {
                if (value !== DEFAULT_OPTION) {
                  merchandiseSearchParams[name.toLowerCase()] = value
                }
              })

              const merchandiseUrl = createUrl(
                `/product/${item.merchandise.product.handle}`,
                new URLSearchParams(merchandiseSearchParams),
              )

              return (
                <li key={i} className="bg-black border-2 border-white p-4">
                  <div className="flex w-full flex-row items-start gap-4">
                    <div className="relative flex-shrink-0">
                      <Link
                        href={merchandiseUrl}
                        onClick={closeCart}
                        className="block relative h-20 w-20 overflow-hidden bg-black border border-white"
                      >
                        <Image
                          className="h-full w-full object-cover"
                          width={80}
                          height={80}
                          alt={item.merchandise.product.featuredImage.altText || item.merchandise.product.title}
                          src={item.merchandise.product.featuredImage.url || "/placeholder.svg"}
                        />
                      </Link>
                      <div className="absolute -top-2 -left-2">
                        <DeleteItemButton item={item} optimisticUpdate={updateCartItem} />
                      </div>
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <Link
                        href={merchandiseUrl}
                        onClick={closeCart}
                        className="text-base font-black tracking-wider uppercase line-clamp-2 text-white"
                      >
                        {item.merchandise.product.title}
                      </Link>
                      {item.merchandise.title !== DEFAULT_OPTION && (
                        <p className="text-sm text-white/70 mt-1 font-medium">{item.merchandise.title}</p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center bg-black border border-white">
                          <EditItemQuantityButton item={item} type="minus" optimisticUpdate={updateCartItem} />
                          <p className="w-8 h-8 text-center text-sm font-black text-black bg-white py-1">
                            {item.quantity}
                          </p>
                          <EditItemQuantityButton item={item} type="plus" optimisticUpdate={updateCartItem} />
                        </div>
                        <Price
                          className="text-sm font-black tracking-wider text-white"
                          amount={item.cost.totalAmount.amount}
                          currencyCode={item.cost.totalAmount.currencyCode}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
        </ul>

        {/* Continue Shopping Button */}
        <div className="px-4 pb-4">
          <button
            onClick={closeCart}
            className="group relative overflow-hidden w-full bg-black border-2 border-white py-3 text-base font-black tracking-wider uppercase text-white transition-all duration-500 hover:text-black"
          >
            <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
            <span className="relative z-10">Continue Shopping</span>
          </button>
        </div>

        <div className="border-t-2 border-white p-4 space-y-4 bg-black">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-white/70 font-medium tracking-wider uppercase">Subtotal</p>
              <Price
                className="font-black tracking-wider text-white"
                amount={cart.cost.subtotalAmount.amount}
                currencyCode={cart.cost.subtotalAmount.currencyCode}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/70 font-medium tracking-wider uppercase">Taxes</p>
              <Price
                className="font-black tracking-wider text-white"
                amount={cart.cost.totalTaxAmount.amount}
                currencyCode={cart.cost.totalTaxAmount.currencyCode}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/70 font-medium tracking-wider uppercase">Shipping</p>
              <p className="font-black tracking-wider text-white">Calculated at checkout</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t-2 border-white pt-4">
            <p className="text-base font-black tracking-wider uppercase text-white">Total</p>
            <Price
              className="text-lg font-black tracking-wider text-white"
              amount={cart.cost.totalAmount.amount}
              currencyCode={cart.cost.totalAmount.currencyCode}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut || !cart || cart.lines.length === 0 || isCheckoutInProgress()}
              className="group relative overflow-hidden w-full bg-black border-2 border-white py-4 text-lg font-black tracking-wider uppercase text-white transition-all duration-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
              <span className="relative z-10">
                {isCheckingOut ? <LoadingDots className="bg-white group-hover:bg-black" /> : "Proceed to Checkout"}
              </span>
            </button>
            {checkoutError && (
              <p className="mt-2 text-sm text-red-400 text-center font-medium" role="alert">
                {checkoutError}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <button aria-label="Open cart" onClick={openCart}>
        <OpenCart quantity={cart?.totalQuantity} />
      </button>
      <Transition show={isOpen}>
        <Dialog onClose={closeCart} className="relative z-50">
          <TransitionChild
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="opacity-0 backdrop-blur-none"
            enterTo="opacity-100 backdrop-blur-[.5px]"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="opacity-100 backdrop-blur-[.5px]"
            leaveTo="opacity-0 backdrop-blur-none"
          >
            <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          </TransitionChild>
          <TransitionChild
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <DialogPanel className="fixed bottom-0 right-0 top-0 flex h-full w-full flex-col border-l-2 backdrop-blur-xl md:w-[420px] border-white bg-black text-white">
              <div className="flex items-center justify-between px-4 py-4 border-b-2 border-white bg-black">
                <h2 className="text-lg font-black tracking-wider uppercase">
                  {checkoutState === CHECKOUT_STATES.COMPLETED
                    ? "Order Confirmation"
                    : checkoutState === CHECKOUT_STATES.IN_PROGRESS
                      ? "Checkout in Progress"
                      : "Shopping Cart"}
                </h2>
                <button
                  aria-label="Close cart"
                  onClick={closeCart}
                  className="group relative overflow-hidden bg-black border-2 border-white p-2 transition-all duration-500 hover:text-black"
                >
                  <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
                  <i
                    className="ri-close-line text-xl text-white group-hover:text-black relative z-10 transition-colors duration-500"
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
              {renderCartContent()}
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </>
  )
}
