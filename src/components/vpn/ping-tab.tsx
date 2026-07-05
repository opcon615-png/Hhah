'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Signal,
  Pencil,
  Star,
  Radar,
  Activity,
  Clock,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface PingTarget {
  id: string
  hostname: string
  port: number
  protocol: 'icmp' | 'tcp'
  label?: string
  isDefault: boolean
  enabled: boolean
  createdAt: string
}

interface PingResult {
  host: string
  status: 'reachable' | 'unreachable' | 'success' | 'fail'
  latency: number | null
  error?: string
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

function getLatencyColor(latency: number) {
  if (latency < 100) return 'bg-emerald-500'
  if (latency < 300) return 'bg-amber-500'
  return 'bg-red-500'
}

function getLatencyTextColor(latency: number) {
  if (latency < 100) return 'text-emerald-400'
  if (latency < 300) return 'text-amber-400'
  return 'text-red-400'
}

function LatencyBar({ latency, maxLatency }: { latency: number; maxLatency: number }) {
  const width = Math.max(4, (latency / Math.max(maxLatency, 1)) * 100)
  return (
    <div className="w-full h-2.5 bg-muted/50 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        className={`h-full rounded-full ${getLatencyColor(latency)}`}
      />
    </div>
  )
}

export function PingTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PingTarget | null>(null)
  const [formHostname, setFormHostname] = useState('')
  const [formPort, setFormPort] = useState('443')
  const [formProtocol, setFormProtocol] = useState<'icmp' | 'tcp'>('tcp')
  const [formLabel, setFormLabel] = useState('')
  const [results, setResults] = useState<PingResult[]>([])
  const [isPinging, setIsPinging] = useState(false)
  const [lastTestTime, setLastTestTime] = useState<string | null>(null)

  const { data: targets = [], isLoading } = useQuery<PingTarget[]>({
    queryKey: ['ping-targets'],
    queryFn: () => fetch('/api/ping/targets').then((r) => r.json()),
  })

  const enabledCount = targets.filter((t) => t.enabled).length
  const defaultTarget = targets.find((t) => t.isDefault)

  const latencyStats = useMemo(() => {
    const latencies = results
      .filter((r) => r.latency !== null)
      .map((r) => r.latency as number)
    if (latencies.length === 0) return null
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    const min = Math.min(...latencies)
    const max = Math.max(...latencies)
    return { avg, min, max, count: latencies.length }
  }, [results])

  const maxResultLatency = useMemo(() => {
    return Math.max(...results.filter((r) => r.latency !== null).map((r) => r.latency as number), 1)
  }, [results])

  const createMutation = useMutation({
    mutationFn: (data: { hostname: string; port: number; protocol: string; label?: string }) =>
      fetch('/api/ping/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to add target') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ping-targets'] })
      toast.success(editTarget ? 'Target updated' : 'Target added')
      setDialogOpen(false)
      setEditTarget(null)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add target'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/ping/targets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to update target') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ping-targets'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update target'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/ping/targets/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to delete target') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ping-targets'] })
      toast.success('Target deleted')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete target'),
  })

  const resetForm = () => {
    setFormHostname('')
    setFormPort('443')
    setFormProtocol('tcp')
    setFormLabel('')
    setEditTarget(null)
  }

  const openEditDialog = (target: PingTarget) => {
    setEditTarget(target)
    setFormHostname(target.hostname)
    setFormPort(String(target.port))
    setFormProtocol(target.protocol)
    setFormLabel(target.label || '')
    setDialogOpen(true)
  }

  const handleAddTarget = () => {
    if (!formHostname.trim()) {
      toast.error('Please enter a hostname')
      return
    }
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        data: {
          hostname: formHostname.trim(),
          port: parseInt(formPort, 10) || 443,
          protocol: formProtocol,
          label: formLabel.trim() || undefined,
        },
      })
    } else {
      createMutation.mutate({
        hostname: formHostname.trim(),
        port: parseInt(formPort, 10) || 443,
        protocol: formProtocol,
        label: formLabel.trim() || undefined,
      })
    }
  }

  const handleToggle = (target: PingTarget) => {
    updateMutation.mutate({ id: target.id, data: { enabled: !target.enabled } })
  }

  const handleSetDefault = (target: PingTarget) => {
    if (target.isDefault) return
    // Clear previous defaults
    const prevDefault = targets.find((t) => t.isDefault && t.id !== target.id)
    const updates = []
    if (prevDefault) {
      updates.push(
        fetch(`/api/ping/targets/${prevDefault.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefault: false }),
        })
      )
    }
    updates.push(
      fetch(`/api/ping/targets/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
    )
    Promise.all(updates)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['ping-targets'] })
        toast.success(`"${target.label || target.hostname}" set as default`)
      })
      .catch(() => toast.error('Failed to set default target'))
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const handlePingTest = async () => {
    const enabledTargets = targets.filter((t) => t.enabled)
    if (enabledTargets.length === 0) {
      toast.error('No enabled targets to ping')
      return
    }

    setIsPinging(true)
    setResults([])
    const targetObjects = enabledTargets.map((t) => ({
      hostname: t.hostname,
      port: t.port,
      protocol: t.protocol,
    }))

    try {
      const res = await fetch('/api/ping/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: targetObjects }),
      })
      const data = await res.json()
      if (data.results) {
        setResults(data.results)
        setLastTestTime(new Date().toLocaleTimeString())
      } else {
        toast.error('Ping test failed')
      }
    } catch {
      toast.error('Ping test request failed')
    } finally {
      setIsPinging(false)
    }
  }

  return (
    <motion.div
      className="space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ping Test</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Test latency and connectivity to targets
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }} className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Target</span>
        </Button>
      </motion.div>

      {/* Stats Banner */}
      <motion.div variants={scaleIn}>
        <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-4">
          <div className="absolute inset-0 dot-pattern opacity-40" />
          <div className="relative flex flex-wrap items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
                <Target className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Targets</p>
                <p className="text-lg font-bold tabular-nums">{targets.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10">
                <Activity className="size-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enabled</p>
                <p className="text-lg font-bold tabular-nums text-emerald-400">{enabledCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-9 rounded-lg bg-amber-500/10">
                <Star className="size-4 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Default</p>
                <p className="text-sm font-semibold truncate max-w-32">
                  {defaultTarget ? (defaultTarget.label || defaultTarget.hostname) : 'None'}
                </p>
              </div>
            </div>
            {lastTestTime && (
              <div className="flex items-center gap-2.5 ml-auto">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted">
                  <Clock className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last Tested</p>
                  <p className="text-sm font-semibold tabular-nums">{lastTestTime}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Targets List */}
      <motion.div variants={fadeUp}>
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">
              Targets ({targets.length})
            </span>
            <Button
              size="sm"
              onClick={handlePingTest}
              disabled={isPinging || targets.filter((t) => t.enabled).length === 0}
              className={!isPinging ? 'bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-white border-0 shadow-sm' : ''}
            >
              {isPinging ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="size-4" />
                  </motion.div>
                  Pinging...
                </>
              ) : (
                <>
                  <Signal className="size-4" />
                  Run Ping Test
                </>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : targets.length === 0 ? (
            <div className="p-10 text-center">
              <motion.div
                className="mx-auto size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Radar className="size-7 text-muted-foreground/50" />
              </motion.div>
              <p className="font-medium text-muted-foreground">No ping targets configured</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add a host to start testing connectivity and latency</p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Add first target
              </Button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {targets.map((target, index) => (
                <motion.div
                  key={target.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors border-l-[3px] ${
                    target.protocol === 'tcp'
                      ? 'border-l-primary'
                      : 'border-l-amber-500'
                  }`}
                >
                  <div className={`size-2 rounded-full shrink-0 ${target.enabled ? 'bg-primary shadow-[0_0_6px_var(--color-primary)]' : 'bg-muted-foreground/30'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {target.label || target.hostname}
                      </span>
                      {target.isDefault && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <Star className="size-2.5 fill-amber-400" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {target.hostname}:{target.port}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-mono uppercase shrink-0 ${
                    target.protocol === 'tcp'
                      ? 'border-primary/30 text-primary'
                      : 'border-amber-500/30 text-amber-400'
                  }`}>
                    {target.protocol}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-amber-400 shrink-0"
                    onClick={() => handleSetDefault(target)}
                    aria-label="Set as default"
                    title="Set as default"
                  >
                    <Star className={`size-3.5 ${target.isDefault ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => openEditDialog(target)}
                    aria-label="Edit target"
                    title="Edit target"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Switch
                    checked={target.enabled}
                    onCheckedChange={() => handleToggle(target)}
                    aria-label={`Toggle ${target.hostname}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(target.id)}
                    aria-label="Delete target"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium">Ping Results</span>
                <span className="text-xs text-muted-foreground">
                  {results.filter((r) => r.status === 'success' || r.status === 'reachable').length}/{results.length} reachable
                </span>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {results.map((result, index) => (
                  <motion.div
                    key={result.host}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.08 }}
                    className="px-4 py-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      {(result.status === 'success' || result.status === 'reachable') ? (
                        <div className="relative">
                          <CheckCircle2 className="size-4 text-emerald-400" />
                          <motion.div
                            className="absolute inset-0"
                            initial={{ scale: 1, opacity: 0.6 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            transition={{ duration: 0.6 }}
                          >
                            <CheckCircle2 className="size-4 text-emerald-400" />
                          </motion.div>
                        </div>
                      ) : (
                        <XCircle className="size-4 text-destructive" />
                      )}
                      <span className="text-sm font-medium font-mono truncate flex-1">{result.host}</span>
                      {result.latency !== null ? (
                        <span className={`text-sm font-bold tabular-nums ${getLatencyTextColor(result.latency)}`}>
                          {result.latency}ms
                        </span>
                      ) : (
                        <span className="text-xs text-destructive">Timeout</span>
                      )}
                    </div>
                    {result.error && (
                      <p className="text-xs text-destructive truncate ml-7">{result.error}</p>
                    )}
                    {result.latency !== null && (
                      <div className="ml-7 mt-1">
                        <LatencyBar latency={result.latency} maxLatency={maxResultLatency} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              {/* Latency Summary */}
              {latencyStats && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="border-t border-border bg-gradient-to-r from-muted/30 to-transparent p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Latency Summary</p>
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Avg</span>
                      <span className={`text-sm font-bold tabular-nums ${getLatencyTextColor(latencyStats.avg)}`}>
                        {latencyStats.avg}ms
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Min</span>
                      <span className="text-sm font-bold tabular-nums text-emerald-400">{latencyStats.min}ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Max</span>
                      <span className={`text-sm font-bold tabular-nums ${getLatencyTextColor(latencyStats.max)}`}>
                        {latencyStats.max}ms
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />&lt;100ms</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />&lt;300ms</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&gt;300ms</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Radar-like Ping All Overlay */}
      <AnimatePresence>
        {isPinging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="relative flex items-center justify-center size-16">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/40"
                animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 2.2], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/20"
                animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 1 }}
              />
              <div className="relative flex items-center justify-center size-12 rounded-full bg-primary/20 glass border border-primary/30">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Radar className="size-5 text-primary" />
                </motion.div>
              </div>
            </div>
            <motion.div
              className="mt-2 text-center"
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Pinging {enabledCount} targets
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Target Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { resetForm() }
        setDialogOpen(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Ping Target' : 'Add Ping Target'}</DialogTitle>
            <DialogDescription>
              {editTarget ? 'Modify the target configuration.' : 'Add a new host to test connectivity and latency.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ping-label">Label (optional)</Label>
              <Input
                id="ping-label"
                placeholder="My Server"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ping-hostname">Hostname *</Label>
              <Input
                id="ping-hostname"
                placeholder="1.1.1.1 or google.com"
                value={formHostname}
                onChange={(e) => setFormHostname(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={formProtocol} onValueChange={(v) => setFormProtocol(v as 'icmp' | 'tcp')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="icmp">ICMP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ping-port">Port</Label>
                <Input
                  id="ping-port"
                  type="number"
                  placeholder="443"
                  value={formPort}
                  onChange={(e) => setFormPort(e.target.value)}
                  disabled={formProtocol === 'icmp'}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false) }}>
              Cancel
            </Button>
            <Button onClick={handleAddTarget} disabled={createMutation.isPending || updateMutation.isPending}>
              {editTarget ? 'Save Changes' : 'Add Target'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}