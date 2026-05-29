import { AdminOverview } from "@/components/admin/AdminOverview"

// /admin is the shared home for every admin role — a one-glance map of the
// pipeline (Audiences + Inbox → Leads → Clients) with live counts, instead of
// dropping newcomers straight into the CRM dashboard.
export default function AdminIndexPage() {
  return <AdminOverview />
}
