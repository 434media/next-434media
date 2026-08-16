import Link from "next/link"
import { ArrowUpRightIcon } from "lucide-react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

/**
 * The one button.
 *
 * Every CTA on the public site used to be hand-rolled from Tailwind utilities,
 * which drifted: "Start a project" shipped at three sizes on /work alone
 * (px-4/py-2, px-5/py-2.5, px-6/py-3), the contact Submit was `rounded-lg` +
 * `font-semibold` + `bg-gray-900` while every other CTA was a pill +
 * `font-medium` + `bg-neutral-950` — two different blacks off two different
 * Tailwind scales. This collapses that into one component so the next surface
 * (event production, video, design, web) inherits the system instead of
 * re-deriving it.
 *
 * Renders the right element for the destination:
 *   href="/contact"            → next/link
 *   href="mailto:" | "#" | http → plain <a>
 *   no href                    → <button>
 */

type Variant = "primary" | "secondary"
type Size = "sm" | "md" | "lg"

// Shared skeleton. `group` + `gap` are here because the hover tell across the
// site is the icon sliding away from the label, not a color change.
const BASE =
  "group inline-flex items-center justify-center gap-2 rounded-full font-geist-sans font-medium " +
  "transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50"

const SIZES: Record<Size, string> = {
  sm: "px-4 py-2 text-xs hover:gap-2.5",
  md: "px-5 py-2.5 text-sm hover:gap-3",
  lg: "px-6 py-3 text-sm hover:gap-3",
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-neutral-950 text-white hover:bg-neutral-800 focus-visible:outline-neutral-950",
  // The secondary hover fill is translucent rather than a solid, so the button
  // reads the same on white and on the neutral-100 section bands. A solid
  // `hover:bg-neutral-100` disappeared against the closing CTA's own band —
  // which is why that one call site had drifted to `hover:bg-white`.
  secondary:
    "text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-900/[0.06] hover:text-neutral-950 " +
    "hover:ring-neutral-400 focus-visible:outline-neutral-950",
}

/**
 * The house outbound arrow. Pass as `icon` — it picks up the parent's `group`
 * hover so the rotate and the gap animate together.
 *
 *   <Button href="/contact" icon={<ButtonArrow />}>Start a project</Button>
 */
export function ButtonArrow({ className = "" }: { className?: string }) {
  return (
    <ArrowUpRightIcon
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:rotate-12 ${className}`}
      aria-hidden="true"
    />
  )
}

interface CommonProps {
  variant?: Variant
  size?: Size
  /** Rendered after the label, inside the gap animation. */
  icon?: ReactNode
  fullWidth?: boolean
  className?: string
  children: ReactNode
}

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & { href?: undefined }

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof CommonProps> & { href: string }

export type ButtonProps = ButtonAsButton | ButtonAsLink

/** Internal routes get next/link; everything else stays a plain anchor. */
function isRouted(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//")
}

/** Props the primitive consumes itself — everything else is forwarded to the DOM. */
const OWN_PROPS = ["variant", "size", "icon", "fullWidth", "className", "children", "href"] as const

function forwardedProps(props: ButtonProps): Record<string, unknown> {
  const rest: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (!(OWN_PROPS as readonly string[]).includes(k)) rest[k] = v
  }
  return rest
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", icon, fullWidth, className = "", children } = props

  const classes = [BASE, SIZES[size], VARIANTS[variant], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ")

  const content = (
    <>
      {children}
      {icon}
    </>
  )

  const rest = forwardedProps(props)

  if (props.href !== undefined) {
    return isRouted(props.href) ? (
      <Link href={props.href} className={classes} {...rest}>
        {content}
      </Link>
    ) : (
      <a href={props.href} className={classes} {...rest}>
        {content}
      </a>
    )
  }

  const { type, ...buttonRest } = rest
  return (
    <button type={(type as "button" | "submit" | "reset") ?? "button"} className={classes} {...buttonRest}>
      {content}
    </button>
  )
}
