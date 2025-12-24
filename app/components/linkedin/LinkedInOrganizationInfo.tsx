"use client"

import type { LinkedInOrganization } from "../../types/linkedin-insights"

interface LinkedInOrganizationInfoProps {
  organization: LinkedInOrganization | null
}

export function LinkedInOrganizationInfo({ organization }: LinkedInOrganizationInfoProps) {
  if (!organization) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-white/60 text-sm">No organization data available.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-[#0077B5]/10 via-black to-black border border-[#0077B5]/20">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#0077B5] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#0077B5]/20">
          {organization.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate">
              {organization.name}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-[#0077B5]/20 text-[#0077B5] text-xs font-medium">
              Company
            </span>
          </div>

          <a
            href={organization.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#0077B5] hover:underline mb-2 block"
          >
            linkedin.com/company/{organization.vanityName}
          </a>

          {organization.description && (
            <p className="text-sm text-white/60 line-clamp-2 mb-3">
              {organization.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#0077B5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-white">
                {organization.followersCount.toLocaleString()} followers
              </span>
            </div>

            {organization.industry && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span className="text-white/60">{organization.industry}</span>
              </div>
            )}

            {organization.staffCountRange && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <span className="text-white/60">{organization.staffCountRange} employees</span>
              </div>
            )}

            {organization.websiteUrl && (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[#0077B5] hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
