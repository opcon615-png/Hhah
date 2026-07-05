'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server,
  Zap,
  Shield,
  Signal,
  Plus,
  Wifi,
  WifiOff,
  Power,
  Activity,
  ArrowDown,
  ArrowUp,
  Download,
  Clock,
  Globe,
  Monitor,
  Router,
  FileText,
  TestTube2,
  Copy,
  CheckCircle2,
  XCircle,
  History,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useVpnStore } from '@/lib/store'
import { toast } from 'sonner'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface VpnConfig {
  id: string
  name: string
  protocol: string
  server: string
  port: number
  isActive: boolean
  createdAt: string
}

interface SplitTunnelRule {
  id: string
  type: string
  targetType: string
  value: string
  enabled: boolean
}

interface PingTarget {
  id: string
  hostname: string
  enabled: boolean
}

interface ServerTestResult {
  reachable: boolean
  latency: number
  error?: string
}

interface ConnectionLogEntry {
  timestamp: number
  action: 'connect' | 'disconnect'
  configName: string
  result: 'success' | 'fail'
  detail?: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDurationHuman(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today, ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

const CONNECTION_LOG_KEY = 'vpn-connection-log'

function readConnectionLog(): ConnectionLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONNECTION_LOG_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ConnectionLogEntry[]
  } catch {
    return []
  }
}

function writeConnectionLogEntry(entry: ConnectionLogEntry) {
  if (typeof window === 'undefined') return
  try {
    const log = readConnectionLog()
    log.unshift(entry)
    localStorage.setItem(CONNECTION_LOG_KEY, JSON.stringify(log.slice(0, 20)))
  } catch { /* ignore */ }
}

// ─── Protocol Color Map ──────────────────────────────────────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  vmess: 'bg-cyan-500',
  vless: 'bg-emerald-500',
  trojan: 'bg-orange-500',
  ss: 'bg-violet-500',
  shadowsocks: 'bg-violet-500',
  hy2: 'bg-pink-500',
  hysteria2: 'bg-pink-500',
  hysteria: 'bg-pink-500',
  tuic: 'bg-amber-500',
  wireguard: 'bg-teal-500',
}

function getProtocolColor(protocol: string): string {
  const key = protocol.toLowerCase()
  return PROTOCOL_COLORS[key] || 'bg-gray-400'
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.07 } },
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Gradient ring connection button with orbit animation */
function ConnectionRing({
  isConnected,
  isConnecting,
  isDisconnecting,
  onClick,
}: {
  isConnected: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  onClick: () => void
}) {
  const disabled = (!isConnected && isConnecting) || isDisconnecting

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`relative cursor-pointer outline-none ${disabled ? 'opacity-60' : ''}`}
      whileTap={{ scale: 0.93 }}
      aria-label={isConnected ? 'Disconnect VPN' : 'Connect VPN'}
    >
      {/* Outer glow ring when connected */}
      {isConnected && (
        <motion.div
          className="absolute inset-[-8px] rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, oklch(0.696 0.17 162.48 / 0.25), oklch(0.696 0.17 162.48 / 0), oklch(0.696 0.17 162.48 / 0.25))',
            filter: 'blur(6px)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Main ring */}
      <div className="relative size-32 sm:size-36">
        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(0.696 0.17 162.48)" />
              <stop offset="100%" stopColor="oklch(0.696 0.17 162.48 / 0.4)" />
            </linearGradient>
          </defs>
          {isConnected ? (
            <>
              {/* Gradient ring */}
              <circle
                cx="70" cy="70" r="62"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="310 80"
              />
              {/* Animated orbit dot 1 */}
              <motion.circle
                cx="70" cy="8" r="4"
                fill="oklch(0.696 0.17 162.48)"
                filter="drop-shadow(0 0 4px oklch(0.696 0.17 162.48))"
                animate={{
                  transformOrigin: '70px 70px',
                  rotate: [0, 360],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              {/* Animated orbit dot 2 */}
              <motion.circle
                cx="70" cy="8" r="3"
                fill="oklch(0.7 0.15 160 / 0.7)"
                filter="drop-shadow(0 0 3px oklch(0.7 0.15 160 / 0.7))"
                animate={{
                  transformOrigin: '70px 70px',
                  rotate: [120, 480],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              {/* Animated orbit dot 3 */}
              <motion.circle
                cx="70" cy="8" r="2.5"
                fill="oklch(0.72 0.18 164 / 0.5)"
                filter="drop-shadow(0 0 3px oklch(0.72 0.18 164 / 0.5))"
                animate={{
                  transformOrigin: '70px 70px',
                  rotate: [240, 600],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
            </>
          ) : (
            <>
              {/* Dashed gray ring */}
              <circle
                cx="70" cy="70" r="62"
                fill="none"
                stroke="oklch(0.5 0 0 / 0.2)"
                strokeWidth="3"
                strokeDasharray="8 8"
              />
            </>
          )}
        </svg>

        {/* Center button */}
        <motion.div
          className={`absolute inset-3 rounded-full flex items-center justify-center transition-colors duration-500 ${
            isConnected
              ? 'bg-gradient-to-br from-primary/20 to-emerald-500/10'
              : 'bg-muted/60'
          }`}
          animate={
            isConnected
              ? { boxShadow: ['0 0 0 0 oklch(0.696 0.17 162.48 / 0.3)', '0 0 0 14px oklch(0.696 0.17 162.48 / 0)', '0 0 0 0 oklch(0.696 0.17 162.48 / 0.3)'] }
              : (isConnecting || isDisconnecting)
                ? { rotate: 360 }
                : {}
          }
          transition={
            isConnected
              ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
              : (isConnecting || isDisconnecting)
                ? { duration: 1.5, repeat: Infinity, ease: 'linear' }
                : {}
          }
        >
          {isConnected ? (
            <Wifi className="size-11 text-primary" />
          ) : (
            <WifiOff className="size-11 text-muted-foreground/70" />
          )}
        </motion.div>
      </div>
    </motion.button>
  )
}

/** Animated speed indicator bars */
function SpeedBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-2 h-14">
      {[85, 55, 95, 40, 70, 60, 80, 50, 90, 65, 75, 45].map((h, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-emerald-500/60 to-emerald-400/30"
          initial={{ height: 4 }}
          animate={active ? { height: [4, h * 0.14, 4] } : { height: 4 }}
          transition={{
            duration: 1.2 + i * 0.08,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  )
}

/** Animated SVG tunnel visualization */
function TunnelVisualization({ active, server }: { active: boolean; server?: string }) {
  if (!active) return null
  return (
    <div className="flex items-center justify-center py-2">
      <svg width="320" height="60" viewBox="0 0 320 60" className="w-full max-w-xs">
        {/* Device */}
        <rect x="5" y="18" width="32" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
        <rect x="13" y="36" width="16" height="3" rx="1" className="fill-muted-foreground/50" />
        <text x="21" y="14" textAnchor="middle" className="fill-muted-foreground text-[7px] font-medium" fontSize="7" fontFamily="system-ui">You</text>

        {/* Line: Device → VPN */}
        <line x1="40" y1="30" x2="120" y2="30" stroke="currentColor" strokeWidth="1.5" className="text-primary/30" strokeDasharray="4 3" />
        {active && (
          <>
            <motion.circle
              cx="40" cy="30" r="3"
              className="fill-primary"
              filter="drop-shadow(0 0 3px oklch(0.696 0.17 162.48))"
              animate={{ cx: [40, 120] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cx="120" cy="30" r="2.5"
              className="fill-primary/60"
              animate={{ cx: [120, 40] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            />
          </>
        )}

        {/* VPN Server */}
        <rect x="122" y="12" width="76" height="36" rx="6" fill="oklch(0.696 0.17 162.48 / 0.1)" stroke="oklch(0.696 0.17 162.48 / 0.4)" strokeWidth="1.5" />
        {active && (
          <motion.circle
            cx="132" cy="22" r="3"
            className="fill-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        <text x="160" y="28" textAnchor="middle" className="fill-primary text-[8px] font-semibold" fontSize="8" fontFamily="system-ui">VPN Server</text>
        <text x="160" y="40" textAnchor="middle" className="fill-muted-foreground text-[6px]" fontSize="6" fontFamily="monospace">{server || 'proxy'}</text>

        {/* Line: VPN → Internet */}
        <line x1="200" y1="30" x2="280" y2="30" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500/30" strokeDasharray="4 3" />
        {active && (
          <>
            <motion.circle
              cx="200" cy="30" r="3"
              className="fill-emerald-400"
              filter="drop-shadow(0 0 3px oklch(0.7 0.17 162))"
              animate={{ cx: [200, 280] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            />
            <motion.circle
              cx="280" cy="30" r="2.5"
              className="fill-emerald-400/60"
              animate={{ cx: [280, 200] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            />
          </>
        )}

        {/* Internet Globe */}
        <circle cx="300" cy="30" r="16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500/50" />
        <ellipse cx="300" cy="30" rx="8" ry="16" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-emerald-500/30" />
        <line x1="284" y1="30" x2="316" y2="30" stroke="currentColor" strokeWidth="0.8" className="text-emerald-500/30" />
        <line x1="300" y1="14" x2="300" y2="46" stroke="currentColor" strokeWidth="0.8" className="text-emerald-500/30" />
        <text x="300" y="10" textAnchor="middle" className="fill-emerald-400 text-[7px] font-medium" fontSize="7" fontFamily="system-ui">Internet</text>
      </svg>
    </div>
  )
}

/** Protocol distribution bar */
function ProtocolDistribution({ configs, loading }: { configs: VpnConfig[]; loading: boolean }) {
  const distribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of configs) {
      const p = c.protocol.toUpperCase()
      counts[p] = (counts[p] || 0) + 1
    }
    const total = configs.length
    return Object.entries(counts)
      .map(([protocol, count]) => ({
        protocol,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
        color: getProtocolColor(protocol),
      }))
      .sort((a, b) => b.count - a.count)
  }, [configs])

  if (loading) return <Skeleton className="h-4 w-full rounded-full" />
  if (configs.length === 0) {
    return <p className="text-xs text-muted-foreground">No configs to analyze</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-2.5 bg-muted/50">
        {distribution.map((d) => (
          <motion.div
            key={d.protocol}
            className={`${d.color} relative`}
            initial={{ width: 0 }}
            animate={{ width: `${d.pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            title={`${d.protocol}: ${d.count} (${d.pct.toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {distribution.map((d) => (
          <div key={d.protocol} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-sm ${d.color} shrink-0`} />
            <span className="text-[10px] text-muted-foreground">
              {d.protocol} <span className="font-medium text-foreground/70">{d.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function OverviewTab() {
  const queryClient = useQueryClient()
  const {
    setActiveTab,
    connectedConfigName,
    setConnectedConfigName,
    setSelectedConfigId,
    setPendingImportDialog,
  } = useVpnStore()

  // ── State ─────────────────────────────────────────────────────────────────

  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const connectedAtRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [serverTestResult, setServerTestResult] = useState<ServerTestResult | null>(null)
  const [singboxDialogOpen, setSingboxDialogOpen] = useState(false)
  const [singboxConfig, setSingboxConfig] = useState<string>('')
  const [connectionLog, setConnectionLog] = useState<ConnectionLogEntry[]>([])

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: configs = [], isLoading: loadingConfigs } = useQuery<VpnConfig[]>({
    queryKey: ['configs'],
    queryFn: () => fetch('/api/configs').then((r) => r.json()),
  })

  const { data: rules = [], isLoading: loadingRules } = useQuery<SplitTunnelRule[]>({
    queryKey: ['split-tunneling'],
    queryFn: () => fetch('/api/split-tunneling').then((r) => r.json()),
  })

  const { data: pingTargets = [], isLoading: loadingPing } = useQuery<PingTarget[]>({
    queryKey: ['ping-targets'],
    queryFn: () => fetch('/api/ping/targets').then((r) => r.json()),
  })

  // ── Derived ───────────────────────────────────────────────────────────────

  const isConnected = configs.some((c) => c.isActive)
  const activeConfig = configs.find((c) => c.isActive)
  const recentConfigs = configs.slice(0, 5)

  // ── Connection log from localStorage ──────────────────────────────────────

  useEffect(() => {
    setConnectionLog(readConnectionLog().slice(0, 5))
  }, [])

  // ── Connection duration timer ─────────────────────────────────────────────

  useEffect(() => {
    if (isConnected) {
      const updateTimer = () => {
        if (connectedAtRef.current !== null) {
          const elapsed = Math.floor((Date.now() - connectedAtRef.current) / 1000)
          setElapsedSeconds(elapsed)
        }
      }
      updateTimer()
      timerRef.current = setInterval(updateTimer, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      connectedAtRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isConnected])

  // ── Connect mutation ──────────────────────────────────────────────────────

  const connectMutation = useMutation({
    mutationFn: async (configId: string) => {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', configId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      connectedAtRef.current = Date.now()
      setIsConnecting(false)
      setServerTestResult({ reachable: true, latency: data.serverTest?.latency ?? 0 })
      toast.success(`Connected to ${data.config.name} (${data.serverTest?.latency ?? 0}ms)`)
      writeConnectionLogEntry({
        timestamp: Date.now(),
        action: 'connect',
        configName: data.config.name,
        result: 'success',
        detail: `${data.serverTest?.latency ?? 0}ms`,
      })
      setConnectionLog(readConnectionLog().slice(0, 5))
    },
    onError: (err) => {
      setIsConnecting(false)
      setServerTestResult({ reachable: false, latency: -1, error: err instanceof Error ? err.message : 'Connection failed' })
      toast.error(err instanceof Error ? err.message : 'Connection failed')
      writeConnectionLogEntry({
        timestamp: Date.now(),
        action: 'connect',
        configName: activeConfig?.name ?? 'unknown',
        result: 'fail',
        detail: err instanceof Error ? err.message : 'Connection failed',
      })
      setConnectionLog(readConnectionLog().slice(0, 5))
    },
  })

  // ── Disconnect mutation ───────────────────────────────────────────────────

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Disconnection failed')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      connectedAtRef.current = null
      setElapsedSeconds(0)
      setIsDisconnecting(false)
      setServerTestResult(null)
      toast.info('Disconnected from VPN')
      writeConnectionLogEntry({
        timestamp: Date.now(),
        action: 'disconnect',
        configName: activeConfig?.name ?? 'unknown',
        result: 'success',
      })
      setConnectionLog(readConnectionLog().slice(0, 5))
    },
    onError: (err) => {
      setIsDisconnecting(false)
      toast.error(err instanceof Error ? err.message : 'Disconnection failed')
      writeConnectionLogEntry({
        timestamp: Date.now(),
        action: 'disconnect',
        configName: activeConfig?.name ?? 'unknown',
        result: 'fail',
        detail: err instanceof Error ? err.message : 'Disconnection failed',
      })
      setConnectionLog(readConnectionLog().slice(0, 5))
    },
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConnect = () => {
    if (isConnected || isConnecting) return
    if (!activeConfig) {
      toast.error('No active configuration. Please select and activate a config first.')
      setActiveTab('configs')
      return
    }
    setIsConnecting(true)
    setServerTestResult(null)
    connectMutation.mutate(activeConfig.id)
  }

  const handleDisconnect = () => {
    if (!isConnected || isDisconnecting) return
    setIsDisconnecting(true)
    disconnectMutation.mutate()
  }

  const handleTestServer = async () => {
    if (!activeConfig) return
    setServerTestResult({ reachable: false, latency: -1, error: 'Testing...' })
    try {
      const res = await fetch('/api/ping/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: [{ hostname: activeConfig.server, port: activeConfig.port }],
        }),
      })
      const data = await res.json()
      if (data.results && data.results[0]) {
        const r = data.results[0]
        setServerTestResult({
          reachable: r.status === 'reachable' || r.status === 'success',
          latency: r.latency >= 0 ? r.latency : -1,
          error: r.error,
        })
        if (r.status === 'reachable' || r.status === 'success') {
          toast.success(`${activeConfig.server}:${activeConfig.port} is reachable (${r.latency}ms)`)
        } else {
          toast.error(`${activeConfig.server}:${activeConfig.port} is unreachable: ${r.error || 'Timeout'}`)
        }
      }
    } catch {
      setServerTestResult({ reachable: false, latency: -1, error: 'Test failed' })
      toast.error('Server test failed')
    }
  }

  const handleExportConfig = async () => {
    try {
      const res = await fetch('/api/singbox/config')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate config')
        return
      }
      setSingboxConfig(JSON.stringify(data, null, 2))
      setSingboxDialogOpen(true)
    } catch {
      toast.error('Failed to generate config')
    }
  }

  const handleDownloadConfig = () => {
    if (!singboxConfig) return
    const blob = new Blob([singboxConfig], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'singbox-config.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Config downloaded')
  }

  // ── Stats data ────────────────────────────────────────────────────────────

  const stats = [
    {
      label: 'Configs',
      value: loadingConfigs ? '—' : configs.length.toString(),
      icon: <Server className="size-4 text-orange-400" />,
      iconBg: 'bg-gradient-to-br from-orange-500/20 to-orange-500/5',
      sub: 'proxy configurations',
    },
    {
      label: 'Active',
      value: activeConfig ? activeConfig.name : 'None',
      icon: <Zap className="size-4 text-emerald-400" />,
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5',
      sub: activeConfig ? `${activeConfig.protocol} · ${activeConfig.server}:${activeConfig.port}` : 'No active config',
    },
    {
      label: 'Rules',
      value: loadingRules ? '—' : rules.length.toString(),
      icon: <Shield className="size-4 text-amber-400" />,
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-amber-500/5',
      sub: `${rules.filter((r) => r.enabled).length} enabled`,
    },
    {
      label: 'Targets',
      value: loadingPing ? '—' : pingTargets.length.toString(),
      icon: <Signal className="size-4 text-cyan-400" />,
      iconBg: 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/5',
      sub: `${pingTargets.filter((t) => t.enabled).length} enabled`,
    },
  ]

  // ── Quick actions (2x2 grid) ──────────────────────────────────────────────

  const quickActions = [
    {
      label: 'Import Config',
      icon: <Plus className="size-5" />,
      iconBg: 'bg-gradient-to-br from-orange-500/20 to-orange-500/5 text-orange-400',
      onClick: () => { setPendingImportDialog(true); setActiveTab('configs') },
    },
    {
      label: 'Test Connection',
      icon: <TestTube2 className="size-5" />,
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-400',
      onClick: handleTestServer,
      disabled: !activeConfig || serverTestResult?.error === 'Testing...',
    },
    {
      label: 'Export Config',
      icon: <FileText className="size-5" />,
      iconBg: 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 text-cyan-400',
      onClick: handleExportConfig,
      disabled: !isConnected,
    },
    {
      label: 'DNS Settings',
      icon: <Shield className="size-5" />,
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-400',
      onClick: () => setActiveTab('dns'),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* ═══ Connection Status Card ═══ */}
      <motion.div variants={fadeUp}>
        <Card className="relative overflow-hidden border-primary/20">
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '128px 128px',
            }}
          />
          {/* Dot grid pattern */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />

          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col items-center text-center gap-5">
              {/* Connection Ring */}
              <ConnectionRing
                isConnected={isConnected}
                isConnecting={isConnecting}
                isDisconnecting={isDisconnecting}
                onClick={isConnected ? handleDisconnect : handleConnect}
              />

              {/* Status text */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  {isConnecting
                    ? 'Connecting...'
                    : isDisconnecting
                      ? 'Disconnecting...'
                      : isConnected
                        ? 'Connected'
                        : 'Disconnected'}
                </h2>
                {isConnected && activeConfig && (
                  <p className="text-sm text-primary font-semibold">
                    {activeConfig.name} · {activeConfig.protocol} · {activeConfig.server}:{activeConfig.port}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {isConnected
                    ? 'Secure connection established'
                    : isConnecting || isDisconnecting
                      ? 'Establishing secure connection...'
                      : activeConfig
                        ? `Ready to connect to ${activeConfig.name}`
                        : 'No active configuration — add one first'}
                </p>
              </div>

              {/* Enhanced uptime display */}
              {isConnected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/15"
                >
                  <Clock className="size-4 text-primary" />
                  <span className="text-xl font-mono font-bold text-primary tabular-nums tracking-wider">
                    {formatDuration(elapsedSeconds)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    ({formatDurationHuman(elapsedSeconds)})
                  </span>
                </motion.div>
              )}

              {/* Server test result */}
              {serverTestResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                    serverTestResult.reachable
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : serverTestResult.error === 'Testing...'
                        ? 'bg-muted text-muted-foreground border border-border'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {serverTestResult.error === 'Testing...' ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Activity className="size-3" />
                    </motion.div>
                  ) : serverTestResult.reachable ? (
                    <Globe className="size-3" />
                  ) : (
                    <WifiOff className="size-3" />
                  )}
                  {serverTestResult.error === 'Testing...'
                    ? 'Testing server...'
                    : serverTestResult.reachable
                      ? `Server reachable${serverTestResult.latency > 0 ? ` · ${serverTestResult.latency}ms` : ''}`
                      : `Server unreachable${serverTestResult.error ? `: ${serverTestResult.error}` : ''}`}
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  size="lg"
                  variant={isConnected ? 'outline' : 'default'}
                  onClick={isConnected ? handleDisconnect : handleConnect}
                  disabled={(!isConnected && isConnecting) || isDisconnecting}
                  className="min-w-40"
                >
                  <Power className="size-4" />
                  {isConnecting
                    ? 'Connecting...'
                    : isDisconnecting
                      ? 'Disconnecting...'
                      : isConnected
                        ? 'Disconnect'
                        : 'Connect'}
                </Button>
                {isConnected && (
                  <Button size="lg" variant="outline" onClick={handleExportConfig}>
                    <Download className="size-4" />
                    Export Config
                  </Button>
                )}
                {activeConfig && !isConnected && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleTestServer}
                    disabled={serverTestResult?.error === 'Testing...'}
                  >
                    <Activity className="size-4" />
                    Test Server
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Connection Info Card ═══ */}
      <AnimatePresence>
        {isConnected && activeConfig && (
          <motion.div
            key="connection-info"
            initial={{ opacity: 0, y: 16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  Connection Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Protocol</p>
                    <Badge variant="secondary" className="text-xs font-mono">{activeConfig.protocol}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Server</p>
                    <p className="text-sm font-mono truncate">{activeConfig.server}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Port</p>
                    <p className="text-sm font-mono">{activeConfig.port}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</p>
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm text-emerald-400 font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Network Status Card with Tunnel Visualization ═══ */}
      <motion.div variants={fadeUp}>
        <Card className="border-primary/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                Network Status
              </CardTitle>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                    <div className="size-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                    VPN Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">No VPN Connection</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isConnected ? (
              <div className="space-y-4">
                {/* Tunnel visualization */}
                <TunnelVisualization active={isConnected} server={activeConfig?.server} />

                {/* Speed indicators */}
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <ArrowDown className="size-4" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Download</span>
                    </div>
                    <div className="flex-1">
                      <SpeedBars active={isConnected} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-1.5 text-cyan-400">
                      <ArrowUp className="size-4" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Upload</span>
                    </div>
                    <div className="flex-1">
                      <SpeedBars active={isConnected} />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground/70 text-center">
                  Animated indicators — real-time speed requires the sing-box client running on your device.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-center">
                <div className="space-y-2">
                  <WifiOff className="size-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">No active VPN connection</p>
                  <p className="text-xs text-muted-foreground/60">Connect to a VPN server to see network activity</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Stats Grid ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={fadeUp}
            custom={i}
          >
            <Card className="card-glow group">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <div className={`size-9 rounded-lg flex items-center justify-center ${stat.iconBg} transition-transform group-hover:scale-110`}>
                    {stat.icon}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-lg font-bold truncate">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ Quick Actions (2x2 Grid) ═══ */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, i) => (
                <motion.button
                  key={action.label}
                  variants={scaleIn}
                  custom={i}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  whileTap={{ scale: 0.96 }}
                  className={`
                    flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl
                    border border-border/60 bg-muted/30
                    hover:bg-gradient-to-br hover:from-accent/50 hover:to-accent/20
                    hover:border-primary/20 transition-all duration-200
                    cursor-pointer group
                    ${action.disabled ? 'opacity-40 pointer-events-none' : ''}
                  `}
                >
                  <div className={`size-10 rounded-lg flex items-center justify-center ${action.iconBg} transition-transform group-hover:scale-110`}>
                    {action.icon}
                  </div>
                  <span className="text-xs font-medium">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Protocol Distribution ═══ */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" />
              Protocol Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProtocolDistribution configs={configs} loading={loadingConfigs} />
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Connection Log ═══ */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                Connection Log
              </CardTitle>
              {connectionLog.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">Last {connectionLog.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {connectionLog.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No connection history yet.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1.5">
                {connectionLog.map((entry, i) => (
                  <motion.div
                    key={entry.timestamp + '-' + i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {entry.result === 'success' ? (
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-red-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium capitalize">
                            {entry.action}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {entry.configName}
                          </span>
                        </div>
                        {entry.detail && (
                          <p className="text-[10px] text-muted-foreground truncate">{entry.detail}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Recent Configurations ═══ */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Configurations</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setActiveTab('configs')}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingConfigs ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No configurations yet. Add one to get started.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                {recentConfigs.map((config) => (
                  <div
                    key={config.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!config.isActive) {
                        toast.info(`Select "${config.name}" as active first, then connect`)
                        setActiveTab('configs')
                      } else {
                        toast.info(`${config.name} is active — click Connect to start`)
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click() }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-2 rounded-full shrink-0 ${config.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{config.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {config.server}:{config.port}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                        {config.protocol}
                      </Badge>
                      {config.isActive && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Sing-box Config Dialog ═══ */}
      <Dialog open={singboxDialogOpen} onOpenChange={setSingboxDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              Sing-box Configuration
            </DialogTitle>
            <DialogDescription>
              Generated sing-box configuration for the active VPN connection.
            </DialogDescription>
          </DialogHeader>
          <pre className="p-4 bg-muted/50 rounded-md text-xs font-mono max-h-96 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all">
            {singboxConfig}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingboxDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(singboxConfig)
                toast.success('Config copied to clipboard')
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
            <Button onClick={handleDownloadConfig}>
              <Download className="size-4" />
              Download JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}