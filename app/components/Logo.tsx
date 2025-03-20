import { forwardRef } from "react"
import type * as React from "react"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  width?: number | string
  height?: number | string
  fillColor?: string
}

const Logo = forwardRef<SVGSVGElement, LogoProps>(
  ({ className = "", width = "auto", height = "auto", fillColor = "#fff", ...props }, ref) => {
    return (
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox="0 0 713.38 318.03"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="434 Media Logo"
        role="img"
        {...props}
      >
        <path
          fill={fillColor}
          d="M0 217.76h47.12l44.34 46.51 44.81-46.51h47.43v100.28h-49.75v-44.03L91 312.64l-41.41-38.63v44.03H0V217.76zM198.55 318.03V217.75h119.43v26.88h-69.84v12.05h64.74v22.4h-64.74v12.05h69.68v26.88H198.54zM328.96 318.03V217.75h85.44c50.37 0 69.68 21.48 69.68 50.22s-21.63 50.06-72 50.06h-83.13zm49.59-28.89h31.21c16.53 0 25.03-6.03 25.03-21.17s-10.35-21.32-26.73-21.32h-29.51v42.49zM545.12 217.76v100.28h-49.6V217.76h49.6zM656.83 303.04h-46.2l-6.49 14.83h-50.52l49.6-100.12h62.42l47.74 100.12H662.7l-5.87-14.83zm-9.43-23.33l-12.82-32.29-13.91 32.29h26.73z"
        />
        <path
          fill={fillColor}
          d="M0 151.84v-47.95L123.6 3.46h78.85v103.36h30.9v45.02h-30.9v24.77h-78.58v-24.77H0zm80.71-45.02h44.22V69.26l-44.22 37.56zM322.33 114.54c0 13.05 2.13 22.91 26.1 22.91 27.44 0 33.83-5.33 33.83-16.25 0-14.38-19.45-15.72-45.55-15.45h-11.19V75.12h12.26c18.38 0 37.56-2.4 37.56-15.45 0-9.59-.27-17.85-27.7-17.85S322.33 60.2 324.2 68.99h-77.78C246.41 23.97 279.17 0 351.89 0c55.94 0 106.82 5.33 106.82 55.14 0 12.52-13.85 23.17-37.29 30.1 23.97 7.19 41.02 18.91 41.02 39.96 0 51.68-58.6 54.08-114.01 54.08-71.92 0-104.42-17.05-104.15-64.73h78.05zM480.03 151.84v-47.95L603.63 3.46h78.85v103.36h30.9v45.02h-30.9v24.77H603.9v-24.77H480.04zm80.71-45.02h44.22V69.26l-44.22 37.56z"
        />
      </svg>
    )
  },
)

Logo.displayName = "Logo"

export default Logo

