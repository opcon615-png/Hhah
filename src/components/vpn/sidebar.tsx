'use client'

import { cn } from '@/lib/utils'
import { useVpnStore, type TabType } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Shield,
  LayoutDashboard,
  Server,
  Rss,
  GitFork,
  Activity,
  Globe,
  Wifi,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const mainNavItems: { tab: TabType; label: string; icon: React.ReactNode }[] = [
  { tab: 'overview', label: 'Overview', icon: <LayoutDashboard className="size-4" /> },
  { tab: 'configs', label: 'Configurations', icon: <Server className="size-4" /> },
  { tab: 'subscriptions', label: 'Subscriptions', icon: <Rss className="size-4" /> },
]

const toolNavItems: { tab: TabType; label: string; icon: React.ReactNode }[] = [
  { tab: 'split-tunneling', label: 'Split Tunneling', icon: <GitFork className="size-4" /> },
  { tab: 'ping', label: 'Ping Test', icon: <Activity className="size-4" /> },
  { tab: 'dns', label: 'DNS Settings', icon: <Globe className="size-4" /> },
  { tab: 'sharing', label: 'Sharing', icon: <Wifi className="size-4" /> },
]

const allNavItems = [...mainNavItems, ...toolNavItems]

export function Sidebar() {
  const { activeTab, setActiveTab } = useVpnStore()

  // Check connection status from real DB data
  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => fetch('/api/configs').then((r) => r.json()),
  })
  const isConnected = configs.some((c: { isActive: boolean }) => c.isActive)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 lg:w-64 border-r border-border bg-sidebar h-screen sticky top-0 relative overflow-hidden">
        {/* Animated gradient bar at top */}
        <div className="animated-topbar h-[2px] shrink-0" />

        {/* Subtle gradient overlay at top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, oklch(0.696 0.17 162.48 / 0.03) 0%, transparent 40%)',
          }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo area */}
          <div className="flex items-center gap-3 px-4 py-5">
            <div className="relative">
              {/* Glow behind shield when connected */}
              <AnimatePresence>
                {isConnected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 rounded-lg"
                    style={{
                      boxShadow: '0 0 20px oklch(0.696 0.17 162.48 / 0.4), 0 0 40px oklch(0.696 0.17 162.48 / 0.15)',
                    }}
                  />
                )}
              </AnimatePresence>
              <div
                className={cn(
                  'relative flex items-center justify-center size-9 rounded-lg transition-all duration-500',
                  isConnected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Shield className="size-5" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight">VPN Manager</span>
              <span
                className={cn(
                  'text-[11px] font-medium transition-colors duration-300',
                  isConnected ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {isConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto"
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Main section */}
            {mainNavItems.map((item) => (
              <SidebarNavItem
                key={item.tab}
                item={item}
                isActive={activeTab === item.tab}
                onClick={() => setActiveTab(item.tab)}
              />
            ))}

            {/* Section divider */}
            <div className="flex items-center gap-2 px-3 pt-5 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Tools
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Tools section */}
            {toolNavItems.map((item) => (
              <SidebarNavItem
                key={item.tab}
                item={item}
                isActive={activeTab === item.tab}
                onClick={() => setActiveTab(item.tab)}
              />
            ))}
          </nav>

          {/* Footer section */}
          <div className="shrink-0 px-4 py-3 border-t border-border/50">
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <motion.div
                className={cn(
                  'size-2 rounded-full shrink-0',
                  isConnected ? 'bg-primary' : 'bg-muted-foreground/40'
                )}
                animate={
                  isConnected
                    ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }
                    : {}
                }
                transition={
                  isConnected
                    ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                    : {}
                }
              />
              <span
                className={cn(
                  'text-xs font-medium',
                  isConnected ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Version & theme info */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50 font-medium">
                v1.0.0
              </span>
              <span className="text-[10px] text-muted-foreground/50 font-medium">
                Dark Mode
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'oklch(0.16 0 0 / 70%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Thin gradient line at top of mobile nav */}
        <div className="animated-topbar h-[1.5px]" />

        <div className="flex items-center justify-around h-16 px-1">
          {allNavItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1.5 px-2 py-1 rounded-lg min-w-0 flex-1 transition-colors duration-200',
                activeTab === item.tab
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
              aria-current={activeTab === item.tab ? 'page' : undefined}
            >
              {/* Active dot indicator */}
              <AnimatePresence>
                {activeTab === item.tab && (
                  <motion.div
                    layoutId="mobile-active-dot"
                    className="absolute -top-1 size-1.5 rounded-full bg-primary"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              {item.icon}
              <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
                {item.tab === 'split-tunneling' ? 'Split' : item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}

function SidebarNavItem({
  item,
  isActive,
  onClick,
}: {
  item: { tab: TabType; label: string; icon: React.ReactNode }
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group',
            isActive
              ? 'bg-sidebar-accent text-primary sidebar-active-glow'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-current={isActive ? 'page' : undefined}
        >
          {/* Active left border indicator */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="sidebar-active-border"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full bg-primary"
                style={{
                  boxShadow: '0 0 8px oklch(0.696 0.17 162.48 / 0.5)',
                }}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </AnimatePresence>

          {/* Hover gradient background (CSS handles the gradient) */}
          {!isActive && (
            <div className="absolute inset-0 rounded-lg sidebar-nav-hover opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          )}

          <span className="relative z-10 flex items-center gap-3 w-full">
            {item.icon}
            <span>{item.label}</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="md:hidden lg:hidden">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}