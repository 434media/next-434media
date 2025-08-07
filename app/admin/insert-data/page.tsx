"use client"

import { useState, useEffect } from "react"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/analytics/Tabs"
import AdminPasswordModal from "../../components/AdminPasswordModal"
import {
  Loader2,
  Users,
  Database,
  RefreshCw,
  Upload,
  ExternalLink,
  Mail,
  FileSpreadsheet,
  Send,
  BarChart3,
  Settings,
  FolderSyncIcon as Sync,
} from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { motion } from "motion/react"

interface CrmStats {
  contacts: {
    total_contacts: number
    active_contacts: number
    synced_to_airtable: number
    synced_to_mailchimp: number
    unique_sources: number
  }
  submissions: {
    total_submissions: number
    unique_form_types: number
  }
  newsletters: {
    total_subscriptions: number
    unique_newsletter_types: number
  }
}

interface Contact {
  id: number
  email: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  source: string
  tags: string[]
  status: string
  synced_to_airtable: boolean
  synced_to_mailchimp: boolean
  created_at: string
  submission_count: number
  newsletter_count: number
  form_types: string[]
  newsletter_types: string[]
}

export default function InsertDataPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [crmStats, setCrmStats] = useState<CrmStats | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<number[]>([])
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const { toast } = useToast()

  // Check for existing admin session
  useEffect(() => {
    const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (adminKey) {
      setAdminPassword(adminKey)
      setAuthenticated(true)
      loadCrmData(adminKey)
    } else {
      setIsLoading(false)
    }
  }, [])

  const handlePasswordVerified = (password: string) => {
    sessionStorage.setItem("adminKey", password)
    setAdminPassword(password)
    setAuthenticated(true)
    loadCrmData(password)
  }

  const handlePasswordCancel = () => {
    window.history.back()
  }

  const loadCrmData = async (adminKey: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Load CRM stats
      const statsResponse = await fetch("/api/crm/contacts?endpoint=stats", {
        headers: { "x-admin-key": adminKey },
      })

      if (statsResponse.ok) {
        const statsResult = await statsResponse.json()
        setCrmStats(statsResult.data)
      }

      // Load contacts
      const contactsResponse = await fetch("/api/crm/contacts", {
        headers: { "x-admin-key": adminKey },
      })

      if (contactsResponse.ok) {
        const contactsResult = await contactsResponse.json()
        setContacts(contactsResult.data)
      }
    } catch (err) {
      console.error("Error loading CRM data:", err)
      setError(err instanceof Error ? err.message : "Failed to load CRM data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    if (adminPassword) {
      loadCrmData(adminPassword)
    }
  }

  const handleContactSelection = (contactId: number) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    )
  }

  const handleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(contacts.map((contact) => contact.id))
    }
  }

  const handleSyncToAirtable = async () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to sync to Airtable.",
        variant: "destructive",
      })
      return
    }

    setSyncing(true)
    try {
      const response = await fetch("/api/crm/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminPassword,
        },
        body: JSON.stringify({
          action: "sync-to-airtable",
          contactIds: selectedContacts,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Airtable sync completed",
          description: result.message,
          variant: "default",
        })
        handleRefresh()
        setSelectedContacts([])
      } else {
        toast({
          title: "Airtable sync failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Sync error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncToMailchimp = async () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to sync to Mailchimp.",
        variant: "destructive",
      })
      return
    }

    setSyncing(true)
    try {
      const response = await fetch("/api/crm/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminPassword,
        },
        body: JSON.stringify({
          action: "sync-to-mailchimp",
          contactIds: selectedContacts,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Mailchimp sync completed",
          description: result.message,
          variant: "default",
        })
        handleRefresh()
        setSelectedContacts([])
      } else {
        toast({
          title: "Mailchimp sync failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Sync error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "contact-form":
        return "bg-blue-100 text-blue-800"
      case "newsletter":
        return "bg-green-100 text-green-800"
      case "sdoh-newsletter":
        return "bg-purple-100 text-purple-800"
      case "txmx-newsletter":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Show authentication modal if not authenticated
  if (!authenticated) {
    return (
      <AdminPasswordModal
        isOpen={true}
        onVerified={handlePasswordVerified}
        onCancel={handlePasswordCancel}
        action="access the CRM data management system"
      />
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading CRM data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 pt-32 md:pt-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">CRM Data Management</h1>
            <p className="text-gray-500 mt-1">Manage contacts, sync to Airtable and Mailchimp</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={isLoading} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => window.open("/analytics-web", "_blank")} variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg"
          >
            <p className="text-red-200">Error: {error}</p>
          </motion.div>
        )}

        {/* CRM Stats Overview */}
        {crmStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{crmStats.contacts.total_contacts}</div>
                <p className="text-xs text-muted-foreground">{crmStats.contacts.active_contacts} active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Form Submissions</CardTitle>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{crmStats.submissions.total_submissions}</div>
                <p className="text-xs text-muted-foreground">{crmStats.submissions.unique_form_types} form types</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Newsletter Subs</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{crmStats.newsletters.total_subscriptions}</div>
                <p className="text-xs text-muted-foreground">
                  {crmStats.newsletters.unique_newsletter_types} newsletter types
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
                <Sync className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Airtable:</span>
                    <span className="font-medium">{crmStats.contacts.synced_to_airtable}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mailchimp:</span>
                    <span className="font-medium">{crmStats.contacts.synced_to_mailchimp}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Main Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="sync">Sync Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      CRM Database Status
                    </CardTitle>
                    <CardDescription>Overview of your custom CRM data</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Contacts</span>
                      <Badge variant="secondary">{crmStats?.contacts.total_contacts || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Form Submissions</span>
                      <Badge variant="secondary">{crmStats?.submissions.total_submissions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Newsletter Subscriptions</span>
                      <Badge variant="secondary">{crmStats?.newsletters.total_subscriptions || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Data Sources</span>
                      <Badge variant="secondary">{crmStats?.contacts.unique_sources || 0}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      External Integrations
                    </CardTitle>
                    <CardDescription>Sync status with external platforms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Airtable Synced</span>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {crmStats?.contacts.synced_to_airtable || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Mailchimp Synced</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {crmStats?.contacts.synced_to_mailchimp || 0}
                      </Badge>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600">
                        Use the Sync Tools tab to sync selected contacts to Airtable or Mailchimp.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contact Management
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={contacts.length === 0}>
                        {selectedContacts.length === contacts.length ? "Deselect All" : "Select All"}
                      </Button>
                      <Badge variant="secondary">{selectedContacts.length} selected</Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Manage your contacts and their associated data. Select contacts to sync to external platforms.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {contacts.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No contacts found</p>
                      <p className="text-sm text-gray-400">Contacts will appear here as forms are submitted</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            selectedContacts.includes(contact.id)
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selectedContacts.includes(contact.id)}
                                onChange={() => handleContactSelection(contact.id)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-medium">
                                    {contact.first_name || contact.last_name
                                      ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                                      : contact.email}
                                  </h3>
                                  <Badge className={getSourceBadgeColor(contact.source)}>{contact.source}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{contact.email}</p>
                                {contact.company && <p className="text-sm text-gray-500 mb-2">{contact.company}</p>}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>Created: {formatDate(contact.created_at)}</span>
                                  <span>Submissions: {contact.submission_count}</span>
                                  <span>Newsletters: {contact.newsletter_count}</span>
                                </div>
                                {contact.tags && contact.tags.length > 0 && (
                                  <div className="flex gap-1 mt-2">
                                    {contact.tags.map((tag, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.synced_to_airtable && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                  Airtable
                                </Badge>
                              )}
                              {contact.synced_to_mailchimp && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                  Mailchimp
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      Sync to Airtable
                    </CardTitle>
                    <CardDescription>Sync selected contacts to your Airtable CRM base</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <p>
                        Selected contacts: <strong>{selectedContacts.length}</strong>
                      </p>
                      <p>
                        Already synced: <strong>{crmStats?.contacts.synced_to_airtable || 0}</strong>
                      </p>
                    </div>
                    <Button
                      onClick={handleSyncToAirtable}
                      disabled={selectedContacts.length === 0 || syncing}
                      className="w-full"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Sync to Airtable
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-500">
                      This will create or update records in your Airtable base with the selected contact information.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Sync to Mailchimp
                    </CardTitle>
                    <CardDescription>Add selected contacts to your Mailchimp mailing lists</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <p>
                        Selected contacts: <strong>{selectedContacts.length}</strong>
                      </p>
                      <p>
                        Already synced: <strong>{crmStats?.contacts.synced_to_mailchimp || 0}</strong>
                      </p>
                    </div>
                    <Button
                      onClick={handleSyncToMailchimp}
                      disabled={selectedContacts.length === 0 || syncing}
                      className="w-full bg-transparent"
                      variant="outline"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Sync to Mailchimp
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-500">
                      This will add the selected contacts as subscribers to your Mailchimp audience.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Sync Configuration
                  </CardTitle>
                  <CardDescription>Configure your external integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Airtable Configuration</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Base ID: {process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID ? "✓ Configured" : "❌ Missing"}</p>
                        <p>API Key: {process.env.AIRTABLE_API_KEY ? "✓ Configured" : "❌ Missing"}</p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Mailchimp Configuration</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>API Key: {process.env.MAILCHIMP_API_KEY ? "✓ Configured" : "❌ Missing"}</p>
                        <p>List ID: {process.env.MAILCHIMP_LIST_ID ? "✓ Configured" : "❌ Missing"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> Make sure your environment variables are properly configured for external
                      integrations to work correctly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  )
}
