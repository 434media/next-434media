"use client"

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react"
import { Check, ChevronDown } from "lucide-react"

/**
 * The public site's dropdown, in place of a native <select>.
 *
 * A native select draws its closed state in the browser's own style and its
 * open list in the operating system's, so neither carried the brand form
 * treatment (Display and Design Standard 3.7): square-cornered, white, a
 * neutral border, `t-control` text, and a selected choice on the
 * `--434-color-03` / `--434-color-04` pair. This is that treatment on Headless
 * UI's Listbox, which brings the listbox keyboard model (arrows, Home/End,
 * type-ahead, Escape) and the ARIA roles with it.
 *
 * It is a form control: `name` renders a hidden input, so FormData and
 * form.reset() work as they did with the select. The empty value means
 * "nothing chosen" and shows the placeholder.
 *
 * The admin has its own dropdown (components/crm/Combobox.tsx), styled for the
 * admin chrome. This one is for 434's public surfaces.
 */
export function Select({
  name,
  id,
  options,
  placeholder = "Select one",
  invalid = false,
  describedBy,
}: {
  name: string
  id: string
  options: readonly string[]
  placeholder?: string
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <Listbox name={name} defaultValue="" invalid={invalid}>
      {({ value }) => (
        <div className="relative mt-1.5">
          <ListboxButton
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required="true"
            className={`t-control flex w-full items-center justify-between gap-3 border bg-(--434-white) px-3.5 py-2.5 text-left transition-colors focus:outline-none ${
              invalid
                ? "border-(--color-fn-error)"
                : "border-neutral-300 hover:border-neutral-500 focus:border-(--434-color-02-black) data-open:border-(--434-color-02-black)"
            }`}
          >
            <span className={`truncate ${value ? "text-neutral-900" : "text-neutral-500"}`}>
              {value || placeholder}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-neutral-600 transition-transform duration-200 in-data-open:rotate-180"
              aria-hidden="true"
            />
          </ListboxButton>
          <ListboxOptions
            anchor={{ to: "bottom start", gap: 4 }}
            transition
            className="z-50 w-(--button-width) max-h-64 overflow-y-auto border border-neutral-300 bg-(--434-white) py-1 shadow-lg focus:outline-none transition duration-150 ease-out data-closed:-translate-y-1 data-closed:opacity-0"
          >
            {options.map((option) => (
              <ListboxOption
                key={option}
                value={option}
                className="t-control group flex cursor-pointer items-center justify-between gap-3 border-l-2 border-transparent px-3.5 py-2 text-neutral-800 data-focus:bg-neutral-100 data-selected:border-(--434-color-03) data-selected:bg-(--434-color-04) data-selected:font-semibold data-selected:text-neutral-900"
              >
                {option}
                <Check className="invisible h-4 w-4 shrink-0 group-data-selected:visible" aria-hidden="true" />
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      )}
    </Listbox>
  )
}
