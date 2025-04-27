"use client"

import Script from "next/script"

interface ClientScriptWrapperProps {
  id: string
  type: string
  jsonData: any
}

export function ClientScriptWrapper({ id, type, jsonData }: ClientScriptWrapperProps) {
  return (
    <Script
      id={id}
      type={type}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonData),
      }}
    />
  )
}
