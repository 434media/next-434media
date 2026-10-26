"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2 } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { BrandStateBadge } from "@/components/admin/brands/BrandStateBadge"
import type { BrandState } from "@/lib/content-pipeline/brand-status"

/**
 * The Brands area (plan v11.2.1 Step 4 item 2): every brand the content engine serves, 434-owned or client, with its
 * status, published profile version, onboarding progress and missing templates. Each opens its own page. Super-admins
 * only, as the brand-profiles routes are.
 */
interface BrandRow { id: string; label: string; brandType: "owned" | "client" | null; state: BrandState; versionId: string | null; publishedAt: string | null; draftDiffers: boolean; problem: string | null; stepsDone: number; steps: number; missing: number; postsMade: number }

export default function BrandsPage() {
  const [brands, setBrands] = useState<BrandRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/admin/brands", { cache: "no-store" }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Could not read the brands")
      setBrands(data.brands)
    }).catch(e => setError(e instanceof Error ? e.message : "Could not read the brands"))
  }, [])

  return (
    <AdminRoleGuard allowedRoles={[]}>
      <div className="min-h-full bg-neutral-50 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-lg font-semibold text-neutral-900">Brands</h1>
          <p className="mt-1 text-sm text-neutral-500">Every brand the content engine serves, owned or client. Open one for its onboarding checklist, profile, sources and missing templates.</p>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {!brands && !error && <p className="mt-4 text-sm text-neutral-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reading the brands…</p>}
          {brands && (
            <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {brands.map(b => (
                <li key={b.id}>
                  <Link href={`/admin/brands/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">{b.label}</span>
                        <BrandStateBadge state={b.state} />
                        {b.brandType && <span className="text-[11px] text-neutral-500">{b.brandType === "client" ? "Client" : "Owned"}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {b.versionId ? <>Profile <span className="font-mono">{b.versionId}</span>{b.publishedAt ? `, published ${b.publishedAt.slice(0, 10)}` : ""}{b.draftDiffers ? " · unpublished edits" : ""}</> : b.problem ? `Not live: ${b.problem}` : "No profile yet"}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right text-xs text-neutral-500 shrink-0">
                      <p>Onboarding {b.stepsDone}/{b.steps}</p>
                      <p className={b.missing ? "text-amber-700" : ""}>{b.missing ? `${b.missing} missing` : "Nothing missing"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminRoleGuard>
  )
}
