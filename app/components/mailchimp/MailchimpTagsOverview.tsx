"use client"

import { Tag, Users, ChevronRight } from "lucide-react"
import type { MailchimpTag } from "../../types/mailchimp-analytics"

interface MailchimpTagsOverviewProps {
  tags: MailchimpTag[]
  selectedTag?: string
  onTagSelect?: (tagId: string) => void
  totalSubscribers?: number
}

export function MailchimpTagsOverview({
  tags,
  selectedTag,
  onTagSelect,
  totalSubscribers = 0,
}: MailchimpTagsOverviewProps) {
  // Calculate max member count for visual bar
  const maxCount = Math.max(...tags.map(t => t.member_count || 0), 1)

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden w-full max-w-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-yellow-600" />
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Tags</h3>
              <p className="text-xs text-neutral-500">Your contacts, organized by your tags.</p>
            </div>
          </div>
          <span className="text-sm text-neutral-500">
            {tags.length} tag{tags.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Scrollable Tags List */}
      <div className="max-h-[400px] overflow-y-auto">
        {tags.length === 0 ? (
          <div className="p-6">
            <p className="text-neutral-500 text-sm">
              No tags found for this audience. Tags help segment your subscribers for targeted campaigns.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {tags.map((tag) => {
              const isSelected = selectedTag === tag.id.toString()

              return (
                <button
                  key={tag.id}
                  onClick={() => onTagSelect?.(tag.id.toString())}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all hover:bg-neutral-50 ${
                    isSelected ? 'bg-yellow-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span 
                      className={`text-2xl font-bold tabular-nums ${isSelected ? 'text-yellow-600' : 'text-neutral-900'}`}
                      style={{ minWidth: '60px' }}
                    >
                      {(tag.member_count || 0).toLocaleString()}
                    </span>
                    <span className="text-sm text-neutral-700">
                      {tag.name}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer with View All link */}
      {tags.length > 0 && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-500">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total: {totalSubscribers.toLocaleString()}</span>
            </div>
            <button className="text-sm text-yellow-600 hover:text-yellow-500 font-medium flex items-center gap-1">
              View all tags
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
