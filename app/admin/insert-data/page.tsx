"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import { Input } from "../../components/analytics/Input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/analytics/Tabs"
import {
  Loader2,
  Upload,
  Database,
  Key,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  Trash2,
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"

interface DataStatus {
  trafficSources: number
  pageViews: number
  geographic: number
  devices: number
  dailySummary: number
  loading: boolean
  error: string | null
}

interface UploadProgress {
  stage: string
  progress: number
  message: string
}

interface UploadResult {
  success: boolean
  message: string
  dataType?: string
  recordsProcessed?: number
  results?: {
    trafficSources: number
    pageViews: number
    geographic: number
    devices: number
    summary: number
    errors: string[]
  }
  error?: string
}

export default function InsertDataPage() {
  const [password, setPassword] = useState("")
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(false)
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    trafficSources: 0,
    pageViews: 0,
    geographic: 0,
    devices: 0,
    dailySummary: 0,
    loading: false,
    error: null,
  })
  const [dateRange, setDateRange] = useState("30days")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: "idle",
    progress: 0,
    message: "",
  })
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [dbInitialized, setDbInitialized] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const { toast } = useToast()

  // Check if database is initialized
  useEffect(() => {
    if (authenticated) {
      checkDatabaseStatus()
    }
  }, [authenticated])

  const checkDatabaseStatus = async () => {
    try {
      setDataStatus((prev) => ({ ...prev, loading: true, error: null }))

      // First check if tables exist
      const response = await fetch(`/api/analytics/init-database?adminKey=${encodeURIComponent(password)}`)
      const data = await response.json()

      if (data.tables && Array.isArray(data.tables)) {
        setDbInitialized(data.tables.length >= 5)
      } else {
        setDbInitialized(false)
      }

      // Then check data status
      const statusResponse = await fetch("/api/analytics/data-status", {
        headers: {
          "x-admin-key": password,
        },
      })

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()

      setDataStatus({
        trafficSources: statusData.trafficSources || 0,
        pageViews: statusData.pageViews || 0,
        geographic: statusData.geographic || 0,
        devices: statusData.devices || 0,
        dailySummary: statusData.dailySummary || 0,
        loading: false,
        error: null,
      })
    } catch (error) {
      console.error("Error checking data status:", error)
      setDataStatus((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    }
  }

  const handleAuthenticate = async () => {
    setChecking(true)
    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setAuthenticated(true)
        toast({
          title: "Authentication successful",
          description: "You now have access to the data management tools.",
          variant: "default",
        })
      } else {
        toast({
          title: "Authentication failed",
          description: "Please check your password and try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Authentication error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setChecking(false)
    }
  }

  const initializeDatabase = async () => {
    setInitializing(true)
    try {
      const response = await fetch(`/api/analytics/init-database?adminKey=${encodeURIComponent(password)}`)
      const data = await response.json()

      if (data.success) {
        setDbInitialized(true)
        toast({
          title: "Database initialized",
          description: `Created ${data.tables?.length || 0} tables successfully.`,
          variant: "default",
        })
      } else {
        toast({
          title: "Database initialization failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Database initialization error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setInitializing(false)
    }
  }

  const insertSampleData = async () => {
    setUploading(true)
    setUploadProgress({
      stage: "preparing",
      progress: 10,
      message: "Preparing sample data...",
    })

    try {
      // Update progress
      setUploadProgress({
        stage: "uploading",
        progress: 30,
        message: "Uploading sample data...",
      })

      const response = await fetch("/api/analytics/insert-historical-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": password,
        },
        body: JSON.stringify({ dateRange }),
      })

      setUploadProgress({
        stage: "processing",
        progress: 70,
        message: "Processing data...",
      })

      const result = await response.json()

      setUploadProgress({
        stage: "complete",
        progress: 100,
        message: result.success ? "Data inserted successfully!" : "Error inserting data",
      })

      setUploadResult(result)

      if (result.success) {
        toast({
          title: "Sample data inserted",
          description: `Successfully inserted ${dateRange} sample data.`,
          variant: "default",
        })
        // Refresh data status
        checkDatabaseStatus()
      } else {
        toast({
          title: "Error inserting sample data",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      setUploadProgress({
        stage: "error",
        progress: 100,
        message: "Error uploading data",
      })

      setUploadResult({
        success: false,
        message: "Error uploading data",
        error: error instanceof Error ? error.message : "Unknown error",
      })

      toast({
        title: "Upload error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress({
      stage: "preparing",
      progress: 10,
      message: `Preparing file: ${file.name}...`,
    })

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("dateRange", dateRange)

      // Update progress
      setUploadProgress({
        stage: "uploading",
        progress: 30,
        message: "Uploading file...",
      })

      const response = await fetch("/api/analytics/upload-data", {
        method: "POST",
        headers: {
          "x-admin-key": password,
        },
        body: formData,
      })

      setUploadProgress({
        stage: "processing",
        progress: 70,
        message: "Processing data...",
      })

      const result = await response.json()

      setUploadProgress({
        stage: "complete",
        progress: 100,
        message: result.success ? "File processed successfully!" : "Error processing file",
      })

      setUploadResult(result)

      if (result.success) {
        toast({
          title: "File uploaded successfully",
          description: `Processed ${result.recordsProcessed} records of ${result.dataType} data.`,
          variant: "default",
        })
        // Refresh data status
        checkDatabaseStatus()
      } else {
        toast({
          title: "Error processing file",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      setUploadProgress({
        stage: "error",
        progress: 100,
        message: "Error uploading file",
      })

      setUploadResult({
        success: false,
        message: "Error uploading file",
        error: error instanceof Error ? error.message : "Unknown error",
      })

      toast({
        title: "Upload error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ""
    }
  }

  const clearData = async () => {
    if (!confirm("Are you sure you want to clear all analytics data? This cannot be undone.")) {
      return
    }

    try {
      const response = await fetch("/api/analytics/clear-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": password,
        },
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Data cleared",
          description: `Successfully cleared ${result.deletedCount} records.`,
          variant: "default",
        })
        // Refresh data status
        checkDatabaseStatus()
      } else {
        toast({
          title: "Error clearing data",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error clearing data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (count: number) => {
    if (count > 0) {
      return (
        <Badge variant="default" className="ml-2">
          Has Data ({count})
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="ml-2">
        Empty
      </Badge>
    )
  }

  if (!authenticated) {
    return (
      <div className="container mx-auto py-10 mt-24 md:mt-32">
        <Card className="max-w-md mx-auto">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
            <CardTitle className="flex items-center gap-2">
              <Key size={20} />
              Admin Authentication
            </CardTitle>
            <CardDescription className="text-blue-100">
              Enter your admin password to access data management tools
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Admin Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleAuthenticate} disabled={checking || !password} className="w-full">
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Authenticate"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 mt-24">
      <h1 className="text-3xl font-bold mb-6">Analytics Data Management</h1>

      {!dbInitialized && (
        <Card className="mb-6 border-yellow-300 bg-yellow-50">
          <CardHeader className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={20} />
              Database Not Initialized
            </CardTitle>
            <CardDescription className="text-yellow-100">
              The analytics tables don't exist yet. Initialize them before uploading data.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="mb-4">
              You need to create the database tables before you can upload analytics data. Click the button below to
              initialize the database.
            </p>
            <Button onClick={initializeDatabase} disabled={initializing} className="bg-amber-500 hover:bg-amber-600">
              {initializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Initialize Database
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-700 text-white">
            <CardTitle className="flex items-center gap-2">
              <Database size={20} />
              Current Data Status
            </CardTitle>
            <CardDescription className="text-blue-100">Overview of analytics data in the database</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {dataStatus.loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : dataStatus.error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
                <p className="font-medium">Error checking data status</p>
                <p className="text-sm">{dataStatus.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Traffic Sources</span>
                  {getStatusBadge(dataStatus.trafficSources)}
                </div>
                <div className="flex justify-between items-center">
                  <span>Page Views</span>
                  {getStatusBadge(dataStatus.pageViews)}
                </div>
                <div className="flex justify-between items-center">
                  <span>Geographic Data</span>
                  {getStatusBadge(dataStatus.geographic)}
                </div>
                <div className="flex justify-between items-center">
                  <span>Device Data</span>
                  {getStatusBadge(dataStatus.devices)}
                </div>
                <div className="flex justify-between items-center">
                  <span>Daily Summary</span>
                  {getStatusBadge(dataStatus.dailySummary)}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={checkDatabaseStatus} disabled={dataStatus.loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="destructive" onClick={clearData} disabled={dataStatus.loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="bg-gradient-to-r from-green-500 to-green-700 text-white">
            <CardTitle className="flex items-center gap-2">
              <Upload size={20} />
              Upload Analytics Data
            </CardTitle>
            <CardDescription className="text-green-100">Upload data from files or use sample data</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="sample" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sample">Sample Data</TabsTrigger>
                <TabsTrigger value="file">File Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="sample" className="pt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Date Range</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={dateRange === "7days" ? "default" : "outline"}
                        onClick={() => setDateRange("7days")}
                        className="w-full"
                      >
                        <Calendar className="mr-2 h-4 w-4" />7 Days
                      </Button>
                      <Button
                        variant={dateRange === "30days" ? "default" : "outline"}
                        onClick={() => setDateRange("30days")}
                        className="w-full"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        30 Days
                      </Button>
                      <Button
                        variant={dateRange === "90days" ? "default" : "outline"}
                        onClick={() => setDateRange("90days")}
                        className="w-full"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        90 Days
                      </Button>
                    </div>
                  </div>
                  <Button onClick={insertSampleData} disabled={uploading || !dbInitialized} className="w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Insert Sample Data
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="file" className="pt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Date Range</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={dateRange === "7days" ? "default" : "outline"}
                        onClick={() => setDateRange("7days")}
                        className="w-full"
                      >
                        <Calendar className="mr-2 h-4 w-4" />7 Days
                      </Button>
                      <Button
                        variant={dateRange === "30days" ? "default" : "outline"}
                        onClick={() => setDateRange("30days")}
                        className="w-full"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        30 Days
                      </Button>
                      <Button
                        variant={dateRange === "90days" ? "default" : "outline"}
                        onClick={() => setDateRange("90days")}
                        className="w-full"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        90 Days
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Upload File (CSV or Excel)</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileSpreadsheet className="w-8 h-8 mb-2 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">CSV or Excel files</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileUpload}
                          disabled={uploading || !dbInitialized}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {uploading && (
        <Card className="mt-6">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-700 text-white">
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              Upload Progress
            </CardTitle>
            <CardDescription className="text-purple-100">{uploadProgress.message}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${uploadProgress.progress}%` }}></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {uploadProgress.stage === "preparing" && "Preparing data..."}
              {uploadProgress.stage === "uploading" && "Uploading to server..."}
              {uploadProgress.stage === "processing" && "Processing data..."}
              {uploadProgress.stage === "complete" && "Upload complete!"}
              {uploadProgress.stage === "error" && "Error uploading data"}
            </p>
          </CardContent>
        </Card>
      )}

      {uploadResult && (
        <Card className={`mt-6 ${uploadResult.success ? "border-green-300" : "border-red-300"}`}>
          <CardHeader
            className={`${
              uploadResult.success
                ? "bg-gradient-to-r from-green-500 to-green-700"
                : "bg-gradient-to-r from-red-500 to-red-700"
            } text-white`}
          >
            <CardTitle className="flex items-center gap-2">
              {uploadResult.success ? <CheckCircle2 size={20} /> : <X size={20} />}
              Upload Result
            </CardTitle>
            <CardDescription className={uploadResult.success ? "text-green-100" : "text-red-100"}>
              {uploadResult.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {uploadResult.success ? (
              <div className="space-y-4">
                <p>
                  Successfully processed {uploadResult.recordsProcessed} records of {uploadResult.dataType} data.
                </p>

                {uploadResult.results && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Records inserted:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {uploadResult.results.trafficSources > 0 && (
                        <li>Traffic Sources: {uploadResult.results.trafficSources}</li>
                      )}
                      {uploadResult.results.pageViews > 0 && <li>Page Views: {uploadResult.results.pageViews}</li>}
                      {uploadResult.results.geographic > 0 && (
                        <li>Geographic Data: {uploadResult.results.geographic}</li>
                      )}
                      {uploadResult.results.devices > 0 && <li>Device Data: {uploadResult.results.devices}</li>}
                      {uploadResult.results.summary > 0 && <li>Summary Records: {uploadResult.results.summary}</li>}
                    </ul>

                    {uploadResult.results.errors.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-red-600">Errors:</h4>
                        <ul className="list-disc pl-5 space-y-1 text-red-600">
                          {uploadResult.results.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    onClick={() => window.open("/analytics", "_blank")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    View Analytics Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="font-medium text-red-800">Error details:</p>
                <p className="text-sm text-red-700">{uploadResult.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
