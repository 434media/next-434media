"use client"

import { motion } from "motion/react"
import { Button } from "../analytics/Button"
import { Bot, MessageSquare, Database, Loader2 } from "lucide-react"

interface ChatbotHeaderProps {
  onSyncNotion: () => void
  onClearChat?: () => void
  isLoading?: boolean
  isSyncing?: boolean
  syncStatus?: string
  lastSync?: string | null
}

export function AIChatbotHeader({
  onSyncNotion,
  onClearChat,
  isLoading = false,
  isSyncing = false,
  syncStatus,
  lastSync = null,
}: ChatbotHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-black via-gray-900 to-black border border-white/10 mb-8">
      <div className="absolute inset-0 opacity-[0.08] sm:opacity-[0.12] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 sm:bg-[length:140px_140px]"
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "80px 80px",
            backgroundRepeat: "repeat",
            backgroundPosition: "0 0",
            animation: "float 25s ease-in-out infinite",
            filter: "brightness(1.2) contrast(1.1)",
          }}
        />
      </div>

      <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 bg-white/10 rounded-full blur-2xl animate-pulse" />
      <div
        className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 rounded-full blur-3xl animate-pulse delay-1000"
        style={{ backgroundColor: "#412991" + "40" }}
      />
      <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 bg-white/15 rounded-full blur-2xl animate-pulse delay-500" />
      <div
        className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 rounded-full blur-xl animate-pulse delay-700"
        style={{ backgroundColor: "#412991" + "30" }}
      />

      {/* Additional floating elements */}
      <div
        className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 rounded-full blur-lg animate-pulse delay-300"
        style={{ backgroundColor: "#412991" + "25" }}
      />
      <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 bg-white/20 rounded-full blur-lg animate-pulse delay-900" />
      <div
        className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 rounded-full blur-lg animate-pulse delay-1200"
        style={{ backgroundColor: "#412991" + "20" }}
      />

      {/* Mobile Layout (< sm) */}
      <div className="relative z-10 flex flex-col gap-6 p-4 sm:hidden">
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <motion.div
            className="p-3 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            style={{ background: `linear-gradient(135deg, #412991, #412991)` }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <OpenAIIcon className="h-6 w-6 text-white" />
          </motion.div>
          <div>
            <motion.h1
              className="text-lg font-bold text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              434 Knowledge Base
            </motion.h1>
            <motion.p
              className="text-white/60 text-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Ask questions about <span className="font-menda-black">434 MEDIA</span>
            </motion.p>
          </div>
        </motion.div>

        {/* Controls Section - Stacked on mobile */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          {/* Status indicator */}
          {syncStatus && (
            <div className="bg-white/10 border border-white/20 text-white/80 rounded-lg px-3 py-2 text-xs backdrop-blur-sm">
              {syncStatus}
            </div>
          )}

          <div className="flex gap-2 w-full items-start">
            <div className="flex-1 flex flex-col items-stretch">
              <Button
                onClick={onSyncNotion}
                disabled={isSyncing}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:border-white/30 transition-all duration-200 backdrop-blur-sm bg-transparent"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                ) : (
                  <Database className="h-4 w-4 mr-2 flex-shrink-0" />
                )}
                  Content Missing? <span className="text-[#FFB800]">Sync Now</span>
              </Button>
              {lastSync && (
                <div className="text-[10px] text-white/50 mt-1 text-center truncate" title={`Last sync: ${new Date(lastSync).toLocaleString()}`}>
                  Last sync: {new Date(lastSync).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Desktop Layout (>= sm) */}
      <div className="relative z-10 hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-4 p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <motion.div
            className="p-3 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
            style={{ background: `linear-gradient(135deg, #412991, #412991)` }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <OpenAIIcon className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <motion.h1
              className="text-2xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              434 Knowledge Base
            </motion.h1>
            <motion.p
              className="text-white/60 text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Ask questions about <span className="font-menda-black">434 MEDIA</span>
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-6"
        >
          {/* Status indicator */}
          {syncStatus && (
            <div className="bg-white/10 border border-white/20 text-white/80 rounded-lg px-4 py-2 text-sm backdrop-blur-sm">
              {syncStatus}
            </div>
          )}
          <div className="flex flex-col items-center">
            <Button
              onClick={onSyncNotion}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:border-white/30 transition-all duration-200 backdrop-blur-sm bg-transparent"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              Content Missing? <span className="text-[#FFB800]">Sync Now</span>
            </Button>
            {lastSync && (
              <div className="text-[11px] text-white/50 mt-1 whitespace-nowrap" title={`Last sync: ${new Date(lastSync).toLocaleString()}`}>
                Last sync: {new Date(lastSync).toLocaleString()}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, #412991, white, #412991)` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </div>
  )
}

//openai svg icon
function OpenAIIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08-4.778 2.758a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}
