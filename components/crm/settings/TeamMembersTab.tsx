"use client"

import { useEffect, useState } from "react"
import {
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  Shield,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import type { CurrentUser } from "../types"

type AdminRole = "crm_super_admin" | "full_admin" | "crm_only"

interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  role: AdminRole
  created_at: string
  updated_at: string
}

const ROLE_LABELS: Record<AdminRole, { label: string; color: string }> = {
  crm_super_admin: { label: "Super Admin", color: "bg-violet-50 text-violet-700 border-violet-200" },
  full_admin: { label: "Full Admin", color: "bg-blue-50 text-blue-700 border-blue-200" },
  crm_only: { label: "CRM Only", color: "bg-neutral-100 text-neutral-600 border-neutral-200" },
}

export function TeamMembersTab({ currentUser }: { currentUser: CurrentUser }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "crm_only" as AdminRole })
  const [savingNew, setSavingNew] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/team-members")
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to load team members")
      setMembers(body.data as TeamMember[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMember.name.trim()) {
      setToast({ message: "Name is required", type: "error" })
      return
    }
    setSavingNew(true)
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to add member")
      setNewMember({ name: "", email: "", role: "crm_only" })
      setShowAddForm(false)
      setToast({ message: `Added ${body.data.name}`, type: "success" })
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to add member", type: "error" })
    } finally {
      setSavingNew(false)
    }
  }

  const handleRoleChange = async (member: TeamMember, role: AdminRole) => {
    setPendingId(member.id)
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, role }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to update role")
      setToast({ message: `${member.name} → ${ROLE_LABELS[role].label}`, type: "success" })
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to update role", type: "error" })
    } finally {
      setPendingId(null)
    }
  }

  const handleToggleActive = async (member: TeamMember) => {
    const action = member.isActive ? "deactivate" : "reactivate"
    if (member.isActive && !confirm(`Deactivate ${member.name}? They'll lose CRM access.`)) return
    setPendingId(member.id)
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, isActive: !member.isActive }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? `Failed to ${action} member`)
      setToast({ message: `${member.name} ${action}d`, type: "success" })
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : `Failed to ${action} member`, type: "error" })
    } finally {
      setPendingId(null)
    }
  }

  const handleDelete = async (member: TeamMember) => {
    if (!confirm(`Permanently soft-delete ${member.name}? They'll be hidden from assignee dropdowns.`)) return
    setPendingId(member.id)
    try {
      const res = await fetch(`/api/admin/team-members?id=${member.id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to delete member")
      setToast({ message: `Deleted ${member.name}`, type: "success" })
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to delete member", type: "error" })
    } finally {
      setPendingId(null)
    }
  }

  const isSelf = (member: TeamMember) => member.email.toLowerCase() === currentUser.email.toLowerCase()

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-[13px] font-medium ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Team Members</h2>
          <p className="text-[12px] text-neutral-500">
            {loading ? "Loading…" : `${members.length} ${members.length === 1 ? "member" : "members"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800"
        >
          <Plus className="w-3.5 h-3.5" />
          Add member
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddMember}
          className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Name *
              </label>
              <input
                type="text"
                value={newMember.name}
                onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember((m) => ({ ...m, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="name@434media.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              value={newMember.role}
              onChange={(e) => setNewMember((m) => ({ ...m, role: e.target.value as AdminRole }))}
              className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="crm_only">CRM Only</option>
              <option value="full_admin">Full Admin</option>
              <option value="crm_super_admin">Super Admin</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              {savingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading members…
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
          {members.map((member) => {
            const roleCfg = ROLE_LABELS[member.role] ?? ROLE_LABELS.crm_only
            const self = isSelf(member)
            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 px-4 py-3 ${member.isActive ? "" : "opacity-60"}`}
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center">
                  {member.role === "crm_super_admin" ? (
                    <ShieldCheck className="w-4 h-4 text-violet-600" />
                  ) : member.role === "full_admin" ? (
                    <Shield className="w-4 h-4 text-blue-600" />
                  ) : (
                    <UserIcon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-neutral-900 truncate">
                      {member.name}
                    </span>
                    {self && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        you
                      </span>
                    )}
                    {!member.isActive && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-neutral-100 text-neutral-500 uppercase tracking-wider">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-neutral-500 truncate">{member.email || "—"}</div>
                </div>

                <select
                  value={member.role}
                  disabled={pendingId === member.id || self}
                  onChange={(e) => handleRoleChange(member, e.target.value as AdminRole)}
                  title={self ? "You cannot change your own role" : undefined}
                  className={`px-2 py-1 text-[11px] font-medium rounded border ${roleCfg.color} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="crm_only">CRM Only</option>
                  <option value="full_admin">Full Admin</option>
                  <option value="crm_super_admin">Super Admin</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleToggleActive(member)}
                  disabled={pendingId === member.id || self}
                  title={self ? "You cannot deactivate yourself" : member.isActive ? "Deactivate" : "Reactivate"}
                  className="text-[11px] font-medium text-neutral-500 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingId === member.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : member.isActive ? (
                    "Deactivate"
                  ) : (
                    "Reactivate"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(member)}
                  disabled={pendingId === member.id || self}
                  title={self ? "You cannot delete yourself" : "Delete"}
                  className="text-neutral-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
          {members.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-neutral-400">
              No team members yet. Click "Add member" to add the first one.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
