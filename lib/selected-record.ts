"use client"

/**
 * The record open in front of the person: the task or opportunity whose drawer is showing. The Ask panel reads it to
 * show "OPP-1045 selected" and sends it with a question, so "this" means that record (build sequence V1 item 4, short
 * references; Display Standard 3.17). Client-side only, one record at a time, never stored.
 */
import { useEffect, useSyncExternalStore } from "react"

export type SelectedRecordKind = "opportunity" | "task"

export interface SelectedRecord {
  kind: SelectedRecordKind
  id: string
  /** Its short reference, when it has one (OPP-1045). */
  ref?: string
  name: string
}

let current: SelectedRecord | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function selectRecord(record: SelectedRecord | null): void {
  current = record
  emit()
}

/** Clears the selection only if it is still this record, so a drawer closing never clears one opened after it. */
export function releaseRecord(id: string): void {
  if (current?.id === id) selectRecord(null)
}

export function getSelectedRecord(): SelectedRecord | null {
  return current
}

export function useSelectedRecord(): SelectedRecord | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => current,
    () => null,
  )
}

/** A drawer calls this with its record while it is open (null when closed or creating). */
export function useSelectRecordWhileOpen(record: SelectedRecord | null): void {
  const { kind, id, ref, name } = record ?? {}
  useEffect(() => {
    if (!kind || !id) return
    selectRecord({ kind, id, ref, name: name ?? "" })
    return () => releaseRecord(id)
  }, [kind, id, ref, name])
}
