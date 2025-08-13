import type { Metadata } from "next"
import MailchimpAnalyticsClientPage from "./MailchimpAnalyticsClientPage"

export const metadata: Metadata = {
  title: "Mailchimp Analytics | 434 Media",
  description: "Comprehensive Mailchimp email marketing analytics and insights",
  keywords: ["mailchimp", "email marketing", "analytics", "campaigns", "subscribers"],
}

export default function MailchimpAnalyticsPage() {
  return <MailchimpAnalyticsClientPage />
}
