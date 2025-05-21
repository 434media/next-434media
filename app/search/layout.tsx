import type React from "react"
import { Suspense } from "react"
import ChildrenWrapper from "./children-wrapper"

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="w-full">
        <div className="order-last min-h-screen w-full pt-16 md:pt-20">
          <Suspense fallback={null}>
            <ChildrenWrapper>{children}</ChildrenWrapper>
          </Suspense>
        </div>
      </div>
    </>
  )
}