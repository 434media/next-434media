import type { Metadata } from "next"
import MetaTestRunner from "@/components/meta/MetaTestRunner"

export const metadata: Metadata = {
  title: "Meta Conversions API Testing",
  robots: {
    index: false,
    follow: false,
  },
}

export default function TestMetaPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:mt-24">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Meta Conversions API Testing</h1>
          <p className="text-gray-600">
            Test your TXMX Boxing collection Meta Conversions API integration. Make sure you have configured your
            environment variables before running tests.
          </p>
        </div>

        <MetaTestRunner />

        <div className="mt-8 space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">How to Verify Events in Meta:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Go to Meta Events Manager (business.facebook.com/events_manager)</li>
              <li>Select your Pixel ID</li>
              <li>If using TEST_EVENT_CODE: Go to "Test Events" tab to see test events</li>
              <li>If in production: Go to "Overview" tab to see live events (may take a few minutes to appear)</li>
              <li>Look for events with the Event IDs shown in the test results above</li>
            </ol>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold mb-2">Common Issues & Solutions:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <strong>Missing Environment Variables:</strong> Ensure META_PIXEL_ID and META_ACCESS_TOKEN are set in
                production
              </li>
              <li>
                <strong>IP Address Issues:</strong> Production environments may have different IP extraction methods
              </li>
              <li>
                <strong>Access Token Permissions:</strong> Verify your access token has ads_management permissions
              </li>
              <li>
                <strong>Rate Limiting:</strong> Meta API has rate limits that may be stricter in production
              </li>
              <li>
                <strong>Test Event Code:</strong> Only use META_TEST_EVENT_CODE in development/testing
              </li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold mb-2">Environment Variables Required:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm font-mono">
              <li>META_PIXEL_ID - Your Facebook Pixel ID</li>
              <li>META_ACCESS_TOKEN - Your Facebook App Access Token</li>
              <li>META_TEST_EVENT_CODE - (Optional) For testing events</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
