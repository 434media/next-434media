import clsx from "clsx"

export default function OpenCart({
  className,
  quantity,
}: {
  className?: string
  quantity?: number
}) {
  // Only show badge if quantity exists and is greater than 0
  const showBadge = typeof quantity === "number" && quantity > 0

  return (

    <div className="relative text-white px-4 py-2 text-sm font-geist-sans hover:border-white/40 flex h-11 w-11 items-center justify-center rounded-md border border-white/20 transition-all duration-300 shadow-md hover:shadow-lg">
      <i
        className={clsx("ri-shopping-cart-line text-xl transition-all ease-in-out hover:scale-110", className)}
        aria-hidden="true"
      ></i>

      {showBadge && (
        <div className="absolute right-0 top-0 -mr-2 -mt-2 h-4 w-4 rounded-sm bg-emerald-600 text-[11px] font-medium text-white">
          {quantity}
        </div>
      )}
    </div>
  )
}