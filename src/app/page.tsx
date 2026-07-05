'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/vpn/sidebar'
import { OverviewTab } from '@/components/vpn/overview-tab'
import { ConfigsTab } from '@/components/vpn/configs-tab'
import { SubscriptionsTab } from '@/components/vpn/subscriptions-tab'
import { SplitTunnelingTab } from '@/components/vpn/split-tunneling-tab'
import { PingTab } from '@/components/vpn/ping-tab'
import { DnsTab } from '@/components/vpn/dns-tab'
import { SharingTab } from '@/components/vpn/sharing-tab'
import { useVpnStore } from '@/lib/store'

function TabContent({ tab }: { tab: string }) {
  switch (tab) {
    case 'overview':
      return <OverviewTab />
    case 'configs':
      return <ConfigsTab />
    case 'subscriptions':
      return <SubscriptionsTab />
    case 'split-tunneling':
      return <SplitTunnelingTab />
    case 'ping':
      return <PingTab />
    case 'dns':
      return <DnsTab />
    case 'sharing':
      return <SharingTab />
    default:
      return <OverviewTab />
  }
}

function RemoveNextjsDevTools() {
  useEffect(() => {
    const removeDevTools = () => {
      const els = document.querySelectorAll(
        '[data-nextjs-dialog-overlay], nextjs-portal, [id*="nextjs-"]'
      )
      els.forEach((el) => el.remove())

      // Also check for fixed positioned elements that contain an SVG with the Next.js "N" logo
      document.querySelectorAll('div[style*="position: fixed"]').forEach((el) => {
        const svg = el.querySelector('svg')
        if (svg) {
          const paths = svg.querySelectorAll('path')
          paths.forEach((p) => {
            if (p.getAttribute('d')?.includes('M12 2')) {
              el.remove()
            }
          })
        }
      })
    }

    removeDevTools()
    const observer = new MutationObserver(removeDevTools)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return null
}

export default function Home() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RemoveNextjsDevTools />
      <AppShell />
    </QueryClientProvider>
  )
}

function AppShell() {
  const { activeTab } = useVpnStore()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Fixed animated gradient top bar - full width, 2px */}
      <div className="fixed top-0 left-0 right-0 z-[60] animated-topbar h-[2px]" />

      <div className="flex flex-1 pt-[2px]">
        {/* Sidebar - Desktop */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <TabContent tab={activeTab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav - rendered by Sidebar component */}
    </div>
  )
}