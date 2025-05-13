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

        // Open checkout in new window
        try {
          const newWindow = window.open(checkoutUrl, "_blank", "noopener,noreferrer")

          // Always assume the window opened successfully
          // This avoids false error messages when the window actually opens
          setCheckoutWindow(newWindow)
          setCheckoutState(CHECKOUT_STATES.IN_PROGRESS)

          // We'll rely on our interval check to detect if the window was actually blocked
          // This is more reliable than trying to detect it immediately
        } catch (error) {
          console.error("Error opening checkout window:", error)
          setCheckoutState(CHECKOUT_STATES.ERROR)
          setCheckoutError("Could not open checkout window. Please check your popup blocker settings.")
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
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-xl font-medium mb-2">Thank you for your order!</h3>
          <p className="text-neutral-400 mb-6">Your order has been placed successfully.</p>
          <button
            onClick={() => {
              resetCart()
              closeCart()
            }}
            className="px-6 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      )
    }

    if (checkoutState === CHECKOUT_STATES.IN_PROGRESS) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-medium mb-2">Checkout in Progress</h3>
          <p className="text-neutral-400 mb-2">Please complete your purchase in the checkout window.</p>
          <p className="text-neutral-400 mb-6">
            <ExternalLink className="inline h-4 w-4 mr-1" />
            Your checkout is continuing in a new tab
          </p>
          <button
            onClick={closeCart}
            className="px-6 py-2 bg-neutral-800 text-white rounded-full hover:bg-neutral-700 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      )
    }

    if (!cart || cart.lines.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
            <i className="ri-shopping-cart-line text-3xl text-neutral-400" aria-hidden="true"></i>
          </div>
          <p className="text-xl font-medium mb-2">Your cart is empty</p>
          <p className="text-neutral-400 mb-6">Looks like you haven't added anything to your cart yet.</p>
          <button
            onClick={closeCart}
            className="px-6 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col justify-between overflow-hidden">
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
                <li
                  key={i}
                  className="flex w-full flex-row items-start gap-4 rounded-lg bg-neutral-900/50 p-4 hover:bg-neutral-900 transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <Link
                      href={merchandiseUrl}
                      onClick={closeCart}
                      className="block relative h-20 w-20 overflow-hidden rounded-md bg-neutral-800"
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
                      className="text-base font-medium line-clamp-2 hover:text-emerald-400 transition-colors"
                    >
                      {item.merchandise.product.title}
                    </Link>

                    {item.merchandise.title !== DEFAULT_OPTION && (
                      <p className="text-sm text-neutral-400 mt-1">{item.merchandise.title}</p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-full border border-neutral-700 bg-black/50">
                        <EditItemQuantityButton item={item} type="minus" optimisticUpdate={updateCartItem} />
                        <p className="w-8 text-center text-sm">{item.quantity}</p>
                        <EditItemQuantityButton item={item} type="plus" optimisticUpdate={updateCartItem} />
                      </div>

                      <Price
                        className="text-sm font-medium"
                        amount={item.cost.totalAmount.amount}
                        currencyCode={item.cost.totalAmount.currencyCode}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
        </ul>

        <div className="border-t border-neutral-700 p-4 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-neutral-400">Subtotal</p>
              <Price
                className="font-medium"
                amount={cart.cost.subtotalAmount.amount}
                currencyCode={cart.cost.subtotalAmount.currencyCode}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-neutral-400">Taxes</p>
              <Price
                className="font-medium"
                amount={cart.cost.totalTaxAmount.amount}
                currencyCode={cart.cost.totalTaxAmount.currencyCode}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-neutral-400">Shipping</p>
              <p className="font-medium">Calculated at checkout</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-700 pt-4">
            <p className="text-base font-medium">Total</p>
            <Price
              className="text-lg font-semibold"
              amount={cart.cost.totalAmount.amount}
              currencyCode={cart.cost.totalAmount.currencyCode}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut || !cart || cart.lines.length === 0 || isCheckoutInProgress()}
              className="w-full rounded-full bg-emerald-600 py-3 text-base font-medium text-white transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-70"
            >
              {isCheckingOut ? <LoadingDots className="bg-white" /> : "Proceed to Checkout"}
            </button>
            {checkoutError && (
              <p className="mt-2 text-sm text-red-500 text-center" role="alert">
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
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
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
            <DialogPanel className="fixed bottom-0 right-0 top-0 flex h-full w-full flex-col border-l backdrop-blur-xl md:w-[420px] border-neutral-700 bg-black/80 text-white">
              <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-700">
                <h2 className="text-lg font-semibold">
                  {checkoutState === CHECKOUT_STATES.COMPLETED
                    ? "Order Confirmation"
                    : checkoutState === CHECKOUT_STATES.IN_PROGRESS
                      ? "Checkout in Progress"
                      : "Shopping Cart"}
                </h2>
                <button
                  aria-label="Close cart"
                  onClick={closeCart}
                  className="p-2 rounded-full hover:bg-neutral-800 transition-colors"
                >
                  <i className="ri-close-line text-xl" aria-hidden="true"></i>
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