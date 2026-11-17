import { redirect } from "next/navigation"

// /admin lands on To do, the first screen after sign-in (founder, 2026-11-17). The pipeline map is /admin/overview.
export default function AdminIndexPage() {
  redirect("/admin/todo")
}
