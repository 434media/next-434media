"use client"

import { useState } from "react"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import type { TXMXProductData, TXMXCartData } from "../../types/meta-pixel"

interface TestResult {
  testName: string
  success: boolean
  eventId: string
  timestamp: string
  error?: string
  responseData?: any
}

export default function MetaTestRunner() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [summary, setSummary] = useState<any>(null)

  const runAllTests = async () => {
    setIsRunning(true)
    setResults([])
    setSummary(null)

    try {
      const response = await fetch("/api/meta/txmx/run-tests")
      const data = await response.json()

      setResults(data.results || [])
      setSummary(data.summary)
    } catch (error) {
      console.error("Failed to run tests:", error)
    } finally {
      setIsRunning(false)
    }
  }

  const runSingleTest = async (testType: string) => {
    setIsRunning(true)

    try {
      let endpoint = ""
      let payload = {}

      switch (testType) {
        case "pageview":
          endpoint = "/api/meta/txmx/page-view"
          payload = { eventId: `manual-pageview-${Date.now()}` }
          break

        case "viewcontent":
          endpoint = "/api/meta/txmx/view-content"
          const product: TXMXProductData = {
            productId: "manual-test-product-123",
            productTitle: "Manual Test TXMX Boxing Gloves",
            productHandle: "manual-test-boxing-gloves",
            value: 129.99,
            currency: "USD",
          }
          payload = { eventId: `manual-viewcontent-${Date.now()}`, product }
          break

        case "addtocart":
          endpoint = "/api/meta/txmx/add-to-cart"
          const cartProduct: TXMXProductData & {
            variantId: string
            variantTitle: string
            quantity: number
          } = {
            productId: "manual-test-product-123",
            productTitle: "Manual Test TXMX Boxing Gloves",
            productHandle: "manual-test-boxing-gloves",
            variantId: "manual-test-variant-456",
            variantTitle: "Size L - Red",
            quantity: 2,
            value: 259.98,
            currency: "USD",
          }
          payload = { eventId: `manual-addtocart-${Date.now()}`, product: cartProduct }
          break

        case "checkout":
          endpoint = "/api/meta/txmx/initiate-checkout"
          const cart: TXMXCartData = {
            cartId: `manual-cart-${Date.now()}`,
            value: 389.97,
            currency: "USD",
            numItems: 3,
            products: [
              {
                productId: "manual-test-product-123",
                productTitle: "Manual Test TXMX Boxing Gloves",
                productHandle: "manual-test-boxing-gloves",
                variantId: "manual-test-variant-456",
                variantTitle: "Size L - Red",
                quantity: 2,
                price: 129.99,
              },
              {
                productId: "manual-test-product-789",
                productTitle: "Manual Test TXMX Hand Wraps",
                productHandle: "manual-test-hand-wraps",
                variantId: "manual-test-variant-101",
                variantTitle: "Black",
                quantity: 1,
                price: 129.99,
              },
            ],
          }
          payload = { eventId: `manual-checkout-${Date.now()}`, cart }
          break

        default:
          throw new Error("Unknown test type")
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      const result: TestResult = {
        testName: `Manual ${testType}`,
        success: data.success || false,
        eventId: data.eventId || `manual-${testType}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: data.error,
        responseData: data,
      }

      setResults((prev) => [...prev, result])
    } catch (error) {
      const result: TestResult = {
        testName: `Manual ${testType}`,
        success: false,
        eventId: `manual-${testType}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      }

      setResults((prev) => [...prev, result])
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meta Conversions API Test Runner</CardTitle>
          <CardDescription>
            Test your TXMX Boxing collection Meta Conversions API integration. Events will appear in Meta Events
            Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runAllTests} disabled={isRunning} variant="default">
              {isRunning ? "Running Tests..." : "Run All Tests"}
            </Button>
            <Button onClick={() => runSingleTest("pageview")} disabled={isRunning} variant="outline">
              Test Page View
            </Button>
            <Button onClick={() => runSingleTest("viewcontent")} disabled={isRunning} variant="outline">
              Test View Content
            </Button>
            <Button onClick={() => runSingleTest("addtocart")} disabled={isRunning} variant="outline">
              Test Add to Cart
            </Button>
            <Button onClick={() => runSingleTest("checkout")} disabled={isRunning} variant="outline">
              Test Checkout
            </Button>
          </div>

          {summary && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Test Summary</h3>
              <div className="flex gap-4 text-sm">
                <span>Total: {summary.total}</span>
                <span className="text-green-600">Passed: {summary.passed}</span>
                <span className="text-red-600">Failed: {summary.failed}</span>
                <span>Pass Rate: {summary.passRate}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "PASS" : "FAIL"}
                    </Badge>
                    <span className="font-medium">{result.testName}</span>
                    <span className="text-sm text-gray-500">ID: {result.eventId}</span>
                  </div>
                  <div className="text-sm text-gray-500">{new Date(result.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
