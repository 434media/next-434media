"use client"

import { Link as LinkIcon } from "lucide-react"
import { RichTextEditor } from "@/components/RichTextEditor"
import { ImageUpload } from "@/components/ImageUpload"
import { PreviewField } from "./feed-form-primitives"

interface SpotlightFieldsProps {
  num: 1 | 2 | 3
  // Form state shape varies (newsletter has many optional fields), so we accept
  // a generic record-shaped object and a single setter. Same pattern the rest
  // of the form uses.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any
  onFieldChange: (field: string, value: string) => void
  previewMode: boolean
  editingId: string | null
}

/**
 * SpotlightFields — one rendering of the Spotlight N section (title,
 * description, image, CTA pair). Caller wraps in a CollapsibleSection.
 * Replaces three identical 75-line copy-paste blocks.
 */
export function SpotlightFields({
  num,
  formData,
  onFieldChange,
  previewMode,
  editingId,
}: SpotlightFieldsProps) {
  const titleKey = `spotlight_${num}_title`
  const descKey = `spotlight_${num}_description`
  const imageKey = `spotlight_${num}_image`
  const ctaTextKey = `spotlight_${num}_cta_text`
  const ctaLinkKey = `spotlight_${num}_cta_link`

  return (
    <div className="space-y-5">
      <PreviewField
        label={`Spotlight ${num} Title`}
        value={(formData[titleKey] as string) || ""}
        isPreview={previewMode && !!editingId}
      >
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Title</label>
          <input
            type="text"
            value={(formData[titleKey] as string) || ""}
            onChange={(e) => onFieldChange(titleKey, e.target.value)}
            className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
            placeholder={`Enter spotlight ${num} title`}
          />
        </div>
      </PreviewField>

      <PreviewField
        label={`Spotlight ${num} Description`}
        value={(formData[descKey] as string) || ""}
        isPreview={previewMode && !!editingId}
        isRichText
      >
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Description
            <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· supports Markdown</span>
          </label>
          <RichTextEditor
            value={(formData[descKey] as string) || ""}
            onChange={(value: string) => onFieldChange(descKey, value)}
            placeholder={`Spotlight ${num} description`}
            minRows={4}
          />
        </div>
      </PreviewField>

      <ImageUpload
        value={(formData[imageKey] as string) || ""}
        onChange={(value) => onFieldChange(imageKey, value)}
        label={`Spotlight ${num} image`}
        hideUrl
      />

      <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
          <LinkIcon className="h-3 w-3 text-neutral-400" />
          Call-to-action
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PreviewField
            label="Button Text"
            value={(formData[ctaTextKey] as string) || ""}
            isPreview={previewMode && !!editingId}
          >
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Button Text</label>
              <input
                type="text"
                value={(formData[ctaTextKey] as string) || ""}
                onChange={(e) => onFieldChange(ctaTextKey, e.target.value)}
                className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                placeholder="Learn More"
              />
            </div>
          </PreviewField>
          <PreviewField
            label="Button Link"
            value={(formData[ctaLinkKey] as string) || ""}
            isPreview={previewMode && !!editingId}
          >
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Button Link</label>
              <input
                type="url"
                value={(formData[ctaLinkKey] as string) || ""}
                onChange={(e) => onFieldChange(ctaLinkKey, e.target.value)}
                className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none font-mono text-sm bg-white"
                placeholder="https://example.com/link"
              />
            </div>
          </PreviewField>
        </div>
      </div>
    </div>
  )
}
