'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Rss,
  ClipboardPaste,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Link2,
  Database,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface SubscriptionLink {
  id: string
  name: string
  url: string
  lastFetchedAt: string | null
  lastError: string | null
  configCount: number
  autoUpdate: boolean
  updateInterval: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  _count?: { configs: number }
}

const intervalOptions = [
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 10800, label: '3 hours' },
  { value: 21600, label: '6 hours' },
  { value: 43200, label: '12 hours' },
  { value: 86400, label: '24 hours' },
]

function getIntervalLabel(seconds: number): string {
  const opt = intervalOptions.find((o) => o.value === seconds)
  return opt ? opt.label : `${Math.floor(seconds / 60)} min`
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`
}

function getStatus(sub: SubscriptionLink): { label: string; variant: 'default' | 'destructive' | 'secondary'; color: string; borderColor: string; dotColor: string } {
  if (sub.lastError) return { label: 'Error', variant: 'destructive', color: 'text-red-400', borderColor: 'border-l-red-500', dotColor: 'bg-red-500' }
  if (!sub.lastFetchedAt) return { label: 'Never Fetched', variant: 'secondary', color: 'text-muted-foreground', borderColor: 'border-l-zinc-400 dark:border-l-zinc-600', dotColor: 'bg-zinc-400 dark:bg-zinc-600' }
  return { label: 'Active', variant: 'default', color: 'text-emerald-400', borderColor: 'border-l-emerald-500', dotColor: 'bg-emerald-500' }
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
}

export function SubscriptionsTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingSub, setEditingSub] = useState<SubscriptionLink | null>(null)
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set())
  const [fetchAllLoading, setFetchAllLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualSubId, setManualSubId] = useState<string | null>(null)
  const [manualContent, setManualContent] = useState('')
  const [manualImporting, setManualImporting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formAutoUpdate, setFormAutoUpdate] = useState(true)
  const [formInterval, setFormInterval] = useState('3600')

  const { data: subscriptions = [], isLoading } = useQuery<SubscriptionLink[]>({
    queryKey: ['subscriptions'],
    queryFn: () => fetch('/api/subscriptions').then((r) => r.json()),
  })

  // Computed stats for header
  const stats = useMemo(() => {
    const totalConfigs = subscriptions.reduce((sum, s) => sum + (s._count?.configs ?? s.configCount), 0)
    const allFetchTimes = subscriptions
      .map((s) => s.lastFetchedAt)
      .filter((t): t is string => t !== null)
    const lastFetch = allFetchTimes.length > 0
      ? allFetchTimes.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null
    return {
      totalSubscriptions: subscriptions.length,
      totalConfigs,
      lastFetchRelative: lastFetch ? getRelativeTime(lastFetch) : null,
    }
  }, [subscriptions])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription added')
      setDialogOpen(false)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add subscription'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error) })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription updated')
      setDialogOpen(false)
      setEditingSub(null)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/subscriptions/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      toast.success('Subscription deleted')
      setDeleteDialogOpen(false)
      setDeletingId(null)
    },
    onError: () => toast.error('Failed to delete subscription'),
  })

  const resetForm = () => {
    setFormName('')
    setFormUrl('')
    setFormAutoUpdate(true)
    setFormInterval('3600')
    setEditingSub(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (sub: SubscriptionLink) => {
    setEditingSub(sub)
    setFormName(sub.name)
    setFormUrl(sub.url)
    setFormAutoUpdate(sub.autoUpdate)
    setFormInterval(sub.updateInterval.toString())
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error('Please enter a name')
      return
    }
    if (!formUrl.trim()) {
      toast.error('Please enter a URL')
      return
    }

    const payload = {
      name: formName.trim(),
      url: formUrl.trim(),
      autoUpdate: formAutoUpdate,
      updateInterval: parseInt(formInterval, 10),
    }

    if (editingSub) {
      updateMutation.mutate({ id: editingSub.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleFetch = async (id: string) => {
    setFetchingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/subscriptions/${id}/fetch`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Fetch failed')
        return
      }
      toast.success(`Fetched ${data.configCount} configs (${data.newCount} new)`)
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['configs'] })
    } catch {
      toast.error('Fetch failed')
    } finally {
      setFetchingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleFetchAll = async () => {
    setFetchAllLoading(true)
    try {
      const res = await fetch('/api/subscriptions/fetch-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Fetch all failed')
        return
      }
      toast.success(`Fetched ${data.totalConfigs} configs from ${data.totalFetched} subscriptions (${data.totalNew} new)`)
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['configs'] })
    } catch {
      toast.error('Fetch all failed')
    } finally {
      setFetchAllLoading(false)
    }
  }

  const handleToggleAutoUpdate = (sub: SubscriptionLink) => {
    updateMutation.mutate({
      id: sub.id,
      data: { autoUpdate: !sub.autoUpdate },
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (deletingId) deleteMutation.mutate(deletingId)
  }

  const openManualImport = (subId: string) => {
    setManualSubId(subId)
    setManualContent('')
    setManualDialogOpen(true)
  }

  const handleManualImport = async () => {
    if (!manualSubId || !manualContent.trim()) {
      toast.error('Please paste the subscription content')
      return
    }
    setManualImporting(true)
    try {
      const res = await fetch('/api/subscriptions/import-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: manualSubId, content: manualContent.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Manual import failed')
        return
      }
      toast.success(`Imported ${data.configCount} configs (${data.newCount} new) via manual paste`)
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      setManualDialogOpen(false)
    } catch {
      toast.error('Manual import failed')
    } finally {
      setManualImporting(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setFormUrl(text.trim())
    } catch {
      toast.error('Failed to read clipboard')
    }
  }

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      toast.success('URL copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy URL')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage subscription links for auto-updating VPN configs
          </p>
        </div>
        <div className="flex gap-2">
          {subscriptions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchAll}
              disabled={fetchAllLoading}
              className="gap-1.5"
            >
              {fetchAllLoading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="inline-flex"
                >
                  <RefreshCw className="size-4" />
                </motion.span>
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="hidden sm:inline">Fetch All</span>
            </Button>
          )}
          <Button size="sm" onClick={openCreateDialog} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Subscription</span>
          </Button>
        </div>
      </div>

      {/* Stats Gradient Header */}
      {!isLoading && subscriptions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-5 dot-pattern">
            <div className="relative z-10 grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Rss className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subscriptions</p>
                  <p className="text-lg font-bold text-foreground">{stats.totalSubscriptions}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center">
                  <Database className="size-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Configs Imported</p>
                  <p className="text-lg font-bold text-foreground">{stats.totalConfigs}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                  <Activity className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last Fetch</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {stats.lastFetchRelative ?? <span className="text-muted-foreground">Never</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Subscription List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg shimmer" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-10 border-dashed">
            <div className="text-center space-y-4">
              <div className="relative mx-auto size-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <Rss className="size-7 text-muted-foreground" />
                <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                  <Plus className="size-3 text-primary-foreground" />
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">No subscriptions yet</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                  Add a subscription URL to automatically fetch and update your VPN configurations. Supports vmess, vless, trojan, shadowsocks, and more.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={openCreateDialog} className="gap-1.5">
                  <Link2 className="size-3.5" />
                  Add Subscription
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <AnimatePresence mode="popLayout">
            {subscriptions.map((sub, index) => {
              const status = getStatus(sub)
              const configCount = sub._count?.configs ?? sub.configCount
              const isFetching = fetchingIds.has(sub.id)
              return (
                <motion.div
                  key={sub.id}
                  variants={fadeUp}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  layout
                >
                  <Card className={`p-4 border-l-[3px] ${status.borderColor} card-hover-gradient transition-colors duration-200`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium truncate">{sub.name}</h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] gap-1 px-1.5 py-0 ${status.color} ${
                              status.label === 'Active' ? 'bg-emerald-500/10 border-emerald-500/20' :
                              status.label === 'Error' ? 'bg-red-500/10 border-red-500/20' :
                              'bg-muted border-muted'
                            }`}
                          >
                            <motion.span
                              className={`size-1.5 rounded-full ${status.dotColor}`}
                              animate={status.label === 'Active' ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
                              transition={status.label === 'Active' ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
                            />
                            {status.label}
                          </Badge>
                          {/* Config count indicator */}
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 bg-primary/5 border-primary/15 text-primary">
                            <Database className="size-2.5" />
                            {configCount} config{configCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>

                        {/* URL with copy button */}
                        <div className="flex items-center gap-1.5 group">
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-full flex-1">
                            {sub.url}
                          </p>
                          <button
                            onClick={() => handleCopyUrl(sub.url, sub.id)}
                            className="shrink-0 size-6 rounded flex items-center justify-center text-muted-foreground/0 group-hover:text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
                            aria-label="Copy URL"
                          >
                            {copiedId === sub.id ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {sub.lastFetchedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              Last sync: {getRelativeTime(sub.lastFetchedAt)}
                            </span>
                          )}
                          <span>
                            Auto-update: {getIntervalLabel(sub.updateInterval)}
                          </span>
                        </div>
                        {sub.lastError && (
                          <p className="text-xs text-red-400/80 truncate max-w-full flex items-center gap-1" title={sub.lastError}>
                            <AlertCircle className="size-3 shrink-0" />
                            {sub.lastError}
                          </p>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={sub.autoUpdate}
                            onCheckedChange={() => handleToggleAutoUpdate(sub)}
                            aria-label={`Toggle auto-update for ${sub.name}`}
                          />
                          <span className="text-xs text-muted-foreground hidden sm:inline">Auto</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFetch(sub.id)}
                          disabled={isFetching}
                          className="gap-1.5"
                        >
                          {isFetching ? (
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                              className="inline-flex"
                            >
                              <RefreshCw className="size-3.5" />
                            </motion.span>
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                          <span className="hidden sm:inline">Fetch Now</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openManualImport(sub.id)}
                          disabled={isFetching}
                          className="gap-1.5"
                          title="Paste subscription content manually (useful if URL fetch fails due to TLS/certificate issues)"
                        >
                          <ClipboardPaste className="size-3.5" />
                          <span className="hidden sm:inline">Manual Import</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(sub)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sub.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle>
            <DialogDescription>
              {editingSub
                ? 'Update your subscription link settings.'
                : 'Add a new subscription URL to auto-fetch VPN configurations.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sub-name">Name *</Label>
              <Input
                id="sub-name"
                placeholder="My Subscription"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-url">Subscription URL *</Label>
              <div className="flex gap-2">
                <Input
                  id="sub-url"
                  placeholder="https://example.com/sub"
                  className="font-mono text-xs flex-1"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handlePaste}
                >
                  <ClipboardPaste className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sub-autoupdate">Auto Update</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically fetch configs at the set interval
                </p>
              </div>
              <Switch
                id="sub-autoupdate"
                checked={formAutoUpdate}
                onCheckedChange={setFormAutoUpdate}
              />
            </div>
            {formAutoUpdate && (
              <div className="space-y-2">
                <Label>Update Interval</Label>
                <Select value={formInterval} onValueChange={setFormInterval}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervalOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : null}
              {editingSub ? 'Save Changes' : 'Add Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Import Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={(open) => { setManualDialogOpen(open); if (!open) setManualContent('') }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="size-5 text-primary" />
              Manual Import
            </DialogTitle>
            <DialogDescription>
              If the subscription URL cannot be fetched (e.g., due to certificate/TLS issues), you can paste the raw subscription content here. Open the subscription link in your browser, copy all the text, and paste it below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Subscription Content</Label>
              <Textarea
                placeholder="Paste the base64-encoded or plain-text subscription content here...&#10;&#10;Supports: vmess://, vless://, trojan://, ss://, hy2://, hysteria2://, wg://"
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                You can open the subscription URL in your browser, select all (Ctrl+A), copy, and paste here.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleManualImport}
              disabled={manualImporting || !manualContent.trim()}
            >
              {manualImporting ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : null}
              Import Configs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscription? All VPN configurations imported from this subscription will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}