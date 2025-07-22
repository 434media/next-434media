import MetaTestRunner from "../components/meta/MetaTestRunner"

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

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">How to Verify Events in Meta:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to Meta Events Manager (business.facebook.com/events_manager)</li>
            <li>Select your Pixel ID</li>
            <li>If using TEST_EVENT_CODE: Go to "Test Events" tab to see test events</li>
            <li>If in production: Go to "Overview" tab to see live events (may take a few minutes to appear)</li>
            <li>Look for events with the Event IDs shown in the test results above</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
