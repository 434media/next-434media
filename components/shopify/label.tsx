import clsx from "clsx"
import Price from "./price"

const Label = ({
  title,
  amount,
  currencyCode,
  position = "bottom",
  className,
}: {
  title: string
  amount: string
  currencyCode: string
  position?: "bottom" | "center"
  className?: string
}) => {
  return (
    <div
      className={clsx(
        "absolute bottom-0 left-0 flex w-full px-4 pb-4 @container/label",
        {
          "lg:px-20 lg:pb-[35%]": position === "center",
        },
        className,
      )}
    >
      <div className="flex items-center rounded-full border border-neutral-700 bg-black/90 p-1 text-sm font-semibold text-white backdrop-blur-md">
        <h3 className="mr-4 line-clamp-2 grow pl-2 leading-none tracking-tight">{title}</h3>
        <Price
          className="flex-none rounded-full bg-emerald-600 p-2 text-white"
          amount={amount}
          currencyCode={currencyCode}
          currencyCodeClassName="hidden @[275px]/label:inline"
        />
      </div>
    </div>
  )
}

export default Label