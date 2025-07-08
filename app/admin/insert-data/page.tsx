"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/analytics/Tabs"
import AdminPasswordModal from "../../components/AdminPasswordModal"
import {
  Loader2,
  Upload,
  Database,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  Trash2,
  BarChart3,
  Info,
  ExternalLink,
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { motion } from "framer-motion"

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

type DateRangeOption = "7days" | "30days" | "90days"
type DataType = "trafficSources" | "pageViews" | "geographic" | "devices" | "dailySummary" | "all"

export default function InsertDataPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    trafficSources: 0,
    pageViews: 0,
    geographic: 0,
    devices: 0,
    dailySummary: 0,
    loading: false,
    error: null,
  })
  const [dateRange, setDateRange] = useState<DateRangeOption>("30days")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: "idle",
    progress: 0,
    message: "",
  })
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [dbInitialized, setDbInitialized] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const [selectedDataTypes, setSelectedDataTypes] = useState<DataType[]>([])
  const { toast } = useToast()

  // Check if database is initialized
  useEffect(() => {
    if (authenticated) {
      checkDatabaseStatus()
    }
  }, [authenticated])

  const handlePasswordVerified = (password: string) => {
    setAdminPassword(password)
    setAuthenticated(true)
    toast({
      title: "Authentication successful",
      description: "You now have access to the data management tools.",
      variant: "default",
    })
  }

  const handlePasswordCancel = () => {
    window.history.back()
  }

  const checkDatabaseStatus = async () => {
    try {
      setDataStatus((prev) => ({ ...prev, loading: true, error: null }))

      // First check if tables exist
      const response = await fetch(`/api/analytics/init-database?adminKey=${encodeURIComponent(adminPassword)}`)
      const data = await response.json()

      if (data.tables && Array.isArray(data.tables)) {
        setDbInitialized(data.tables.length >= 5)
      } else {
        setDbInitialized(false)
      }

      // Then check data status
      const statusResponse = await fetch("/api/analytics/data-status", {
        headers: {
          "x-admin-key": adminPassword,
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

  const initializeDatabase = async () => {
    setInitializing(true)
    try {
      const response = await fetch(`/api/analytics/init-database?adminKey=${encodeURIComponent(adminPassword)}`)
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
          "x-admin-key": adminPassword,
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
          "x-admin-key": adminPassword,
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
          "x-admin-key": adminPassword,
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

  const toggleDataTypeSelection = (dataType: DataType) => {
    setSelectedDataTypes((prev) => {
      if (dataType === "all") {
        // If "all" is selected, toggle between all selected and none selected
        return prev.length === 5 ? [] : ["trafficSources", "pageViews", "geographic", "devices", "dailySummary"]
      } else {
        // Toggle individual data type
        return prev.includes(dataType) ? prev.filter((type) => type !== dataType) : [...prev, dataType]
      }
    })
  }

  const deleteSelectedData = async () => {
    if (selectedDataTypes.length === 0) {
      toast({
        title: "No data types selected",
        description: "Please select at least one data type to delete.",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`Are you sure you want to delete the selected data types? This cannot be undone.`)) {
      return
    }

    setDeletingData(true)

    try {
      const response = await fetch("/api/analytics/delete-data-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminPassword,
        },
        body: JSON.stringify({ dataTypes: selectedDataTypes }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Data deleted",
          description: `Successfully deleted ${result.deletedCount} records from ${selectedDataTypes.length} data types.`,
          variant: "default",
        })
        // Reset selected data types
        setSelectedDataTypes([])
        // Refresh data status
        checkDatabaseStatus()
      } else {
        toast({
          title: "Error deleting data",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error deleting data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeletingData(false)
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

  const isDataTypeSelected = (dataType: DataType) => {
    return selectedDataTypes.includes(dataType)
  }

  const areAllDataTypesSelected = () => {
    return selectedDataTypes.length === 5
  }

  // Show authentication modal if not authenticated
  if (!authenticated) {
    return (
      <AdminPasswordModal
        isOpen={true}
        onVerified={handlePasswordVerified}
        onCancel={handlePasswordCancel}
        action="access analytics data management"
      />
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics Data Management</h1>
            <p className="text-gray-500 mt-1">Upload, manage, and view analytics data</p>
          </div>
          <Button
            onClick={() => window.open("/analytics", "_blank")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            View Analytics Dashboard
          </Button>
        </div>

        {/* Data Source Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-blue-300 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-400 to-blue-500 text-white">
              <CardTitle className="flex items-center gap-2">
                <Info size={20} />
                Data Source Information
              </CardTitle>
              <CardDescription className="text-blue-100">
                Understanding where your analytics data comes from
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <p>The analytics dashboard uses data from two potential sources:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <h3 className="font-medium text-blue-700 flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4" /> Local Database
                    </h3>
                    <p className="text-sm text-gray-600">
                      Data stored in your Neon database. This includes historical data you've uploaded or generated. To
                      test Google Analytics connection, delete this data.
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 bg-green-50">
                    <h3 className="font-medium text-green-700 flex items-center gap-2 mb-2">
                      <ExternalLink className="h-4 w-4" /> Google Analytics API
                    </h3>
                    <p className="text-sm text-gray-600">
                      Live data fetched directly from Google Analytics. If your GA4 connection is working, you'll still
                      see data after clearing the local database.
                    </p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Tip:</strong> To verify your Google Analytics connection is working, delete all local data
                    using the tools below, then visit the analytics dashboard. Any data that appears is coming directly
                    from Google Analytics.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {!dbInitialized && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="mb-8 border-yellow-300 overflow-hidden">
              <div className="relative">
                <CardHeader className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white pb-6">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle size={20} />
                    Database Not Initialized
                  </CardTitle>
                  <CardDescription className="text-yellow-100">
                    The analytics tables don't exist yet. Initialize them before uploading data.
                  </CardDescription>
                </CardHeader>
              </div>
              <CardContent className="pt-6">
                <p className="mb-4">
                  You need to create the database tables before you can upload analytics data. Click the button below to
                  initialize the database.
                </p>
                <Button
                  onClick={initializeDatabase}
                  disabled={initializing}
                  className="bg-amber-500 hover:bg-amber-600"
                >
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
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="overflow-hidden h-full">
              <div className="relative">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-700 text-white pb-6">
                  <CardTitle className="flex items-center gap-2">
                    <Database size={20} />
                    Current Data Status
                  </CardTitle>
                  <CardDescription className="text-blue-100">
                    Overview of analytics data in the database
                  </CardDescription>
                </CardHeader>
              </div>
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
                    <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors">
                      <span>Traffic Sources</span>
                      {getStatusBadge(dataStatus.trafficSources)}
                    </div>
                    <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors">
                      <span>Page Views</span>
                      {getStatusBadge(dataStatus.pageViews)}
                    </div>
                    <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors">
                      <span>Geographic Data</span>
                      {getStatusBadge(dataStatus.geographic)}
                    </div>
                    <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors">
                      <span>Device Data</span>
                      {getStatusBadge(dataStatus.devices)}
                    </div>
                    <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors">
                      <span>Daily Summary</span>
                      {getStatusBadge(dataStatus.dailySummary)}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={checkDatabaseStatus} disabled={dataStatus.loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  onClick={clearData}
                  disabled={
                    dataStatus.loading || !Object.values(dataStatus).some((val) => typeof val === "number" && val > 0)
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Data
                </Button>
              </CardFooter>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="overflow-hidden h-full">
              <div className="relative">
                <CardHeader className="bg-gradient-to-r from-green-500 to-green-700 text-white pb-6">
                  <CardTitle className="flex items-center gap-2">
                    <Upload size={20} />
                    Upload Analytics Data
                  </CardTitle>
                  <CardDescription className="text-green-100">
                    Upload data from files or use sample data
                  </CardDescription>
                </CardHeader>
              </div>
              <CardContent className="pt-6">
                <Tabs defaultValue="sample" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="sample">Sample Data</TabsTrigger>
                    <TabsTrigger value="file">File Upload</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sample" className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Date Range</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["7days", "30days", "90days"] as const).map((range) => (
                            <Button
                              key={range}
                              variant={dateRange === range ? "default" : "outline"}
                              onClick={() => setDateRange(range)}
                              className={`w-full ${
                                dateRange === range
                                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                  : ""
                              }`}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {range === "7days" ? "7 Days" : range === "30days" ? "30 Days" : "90 Days"}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={insertSampleData}
                        disabled={uploading || !dbInitialized}
                        className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                      >
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

                  <TabsContent value="file" className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Date Range</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["7days", "30days", "90days"] as const).map((range) => (
                            <Button
                              key={range}
                              variant={dateRange === range ? "default" : "outline"}
                              onClick={() => setDateRange(range)}
                              className={`w-full ${
                                dateRange === range
                                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                  : ""
                              }`}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {range === "7days" ? "7 Days" : range === "30days" ? "30 Days" : "90 Days"}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Upload File (CSV or Excel)</label>
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300 transition-colors">
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
          </motion.div>
        </div>

        {/* Selective Data Deletion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mb-8"
        >
          <Card className="overflow-hidden border-red-200">
            <CardHeader className="bg-gradient-to-r from-red-500 to-red-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <Trash2 size={20} />
                Selective Data Deletion
              </CardTitle>
              <CardDescription className="text-red-100">
                Delete specific types of data from the database
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Testing Google Analytics Connection:</strong> Delete all local data to verify if your Google
                    Analytics connection is working. Any data that appears in the dashboard after deletion is coming
                    directly from Google Analytics.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Select Data Types to Delete</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDataTypeSelection("all")}
                      className={areAllDataTypesSelected() ? "bg-red-50 text-red-700 border-red-300" : ""}
                    >
                      {areAllDataTypesSelected() ? "Deselect All" : "Select All"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => toggleDataTypeSelection("trafficSources")}
                      className={`justify-start ${
                        isDataTypeSelected("trafficSources") ? "bg-red-50 text-red-700 border-red-300" : ""
                      }`}
                      disabled={dataStatus.trafficSources === 0}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>Traffic Sources</span>
                        {getStatusBadge(dataStatus.trafficSources)}
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => toggleDataTypeSelection("pageViews")}
                      className={`justify-start ${
                        isDataTypeSelected("pageViews") ? "bg-red-50 text-red-700 border-red-300" : ""
                      }`}
                      disabled={dataStatus.pageViews === 0}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>Page Views</span>
                        {getStatusBadge(dataStatus.pageViews)}
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => toggleDataTypeSelection("geographic")}
                      className={`justify-start ${
                        isDataTypeSelected("geographic") ? "bg-red-50 text-red-700 border-red-300" : ""
                      }`}
                      disabled={dataStatus.geographic === 0}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>Geographic Data</span>
                        {getStatusBadge(dataStatus.geographic)}
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => toggleDataTypeSelection("devices")}
                      className={`justify-start ${
                        isDataTypeSelected("devices") ? "bg-red-50 text-red-700 border-red-300" : ""
                      }`}
                      disabled={dataStatus.devices === 0}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>Device Data</span>
                        {getStatusBadge(dataStatus.devices)}
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => toggleDataTypeSelection("dailySummary")}
                      className={`justify-start ${
                        isDataTypeSelected("dailySummary") ? "bg-red-50 text-red-700 border-red-300" : ""
                      }`}
                      disabled={dataStatus.dailySummary === 0}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>Daily Summary</span>
                        {getStatusBadge(dataStatus.dailySummary)}
                      </div>
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={deleteSelectedData}
                    disabled={
                      deletingData ||
                      selectedDataTypes.length === 0 ||
                      !Object.values(dataStatus).some((val) => typeof val === "number" && val > 0)
                    }
                    className="w-full"
                  >
                    {deletingData ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected Data Types
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8"
          >
            <Card className="overflow-hidden">
              <div className="relative">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-700 text-white pb-6">
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    Upload Progress
                  </CardTitle>
                  <CardDescription className="text-purple-100">{uploadProgress.message}</CardDescription>
                </CardHeader>
              </div>
              <CardContent className="pt-6">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <motion.div
                    className="bg-purple-600 h-2.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress.progress}%` }}
                    transition={{ duration: 0.5 }}
                  ></motion.div>
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
          </motion.div>
        )}

        {uploadResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8"
          >
            <Card className={`overflow-hidden ${uploadResult.success ? "border-green-300" : "border-red-300"}`}>
              <div className="relative">
                <CardHeader
                  className={`${
                    uploadResult.success
                      ? "bg-gradient-to-r from-green-500 to-green-700"
                      : "bg-gradient-to-r from-red-500 to-red-700"
                  } text-white pb-6`}
                >
                  <CardTitle className="flex items-center gap-2">
                    {uploadResult.success ? <CheckCircle2 size={20} /> : <X size={20} />}
                    Upload Result
                  </CardTitle>
                  <CardDescription className={uploadResult.success ? "text-green-100" : "text-red-100"}>
                    {uploadResult.message}
                  </CardDescription>
                </CardHeader>
              </div>
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
                        <BarChart3 className="mr-2 h-4 w-4" />
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
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
