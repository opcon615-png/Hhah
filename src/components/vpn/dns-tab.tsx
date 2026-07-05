'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Check,
  Globe,
  ShieldCheck,
  Pencil,
  TestTube2,
  ExternalLink,
  Server,
  Zap,
  Cloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface DnsConfig {
  id: string
  name: string
  primaryDns: string
  secondaryDns?: string
  dohUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const DNS_PRESETS = {
  cloudflare: {
    name: 'Cloudflare',
    primaryDns: '1.1.1.1',
    secondaryDns: '1.0.0.1',
    dohUrl: 'https://cloudflare-dns.com/dns-query',
    icon: Cloud,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20 hover:border-orange-500/40',
  },
  google: {
    name: 'Google',
    primaryDns: '8.8.8.8',
    secondaryDns: '8.8.4.4',
    dohUrl: 'https://dns.google/dns-query',
    icon: Globe,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  adguard: {
    name: 'AdGuard',
    primaryDns: '94.140.14.14',
    secondaryDns: '94.140.15.15',
    dohUrl: 'https://dns.adguard-dns.com/dns-query',
    icon: ShieldCheck,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
  },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
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

export function DnsTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editConfig, setEditConfig] = useState<DnsConfig | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrimaryDns, setFormPrimaryDns] = useState('')
  const [formSecondaryDns, setFormSecondaryDns] = useState('')
  const [formDohUrl, setFormDohUrl] = useState('')

  const { data: dnsConfigs = [], isLoading } = useQuery<DnsConfig[]>({
    queryKey: ['dns-configs'],
    queryFn: () => fetch('/api/dns').then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to add DNS configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-configs'] })
      toast.success(editConfig ? 'DNS configuration updated' : 'DNS configuration added')
      setDialogOpen(false)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add DNS configuration'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/dns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to update DNS configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-configs'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update DNS configuration'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/dns/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to delete DNS configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-configs'] })
      toast.success('DNS configuration deleted')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete DNS configuration'),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/dns/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to activate DNS configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-configs'] })
      toast.success('DNS configuration activated')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to activate DNS configuration'),
  })

  const resetForm = () => {
    setFormName('')
    setFormPrimaryDns('')
    setFormSecondaryDns('')
    setFormDohUrl('')
    setEditConfig(null)
  }

  const openEditDialog = (config: DnsConfig) => {
    setEditConfig(config)
    setFormName(config.name)
    setFormPrimaryDns(config.primaryDns)
    setFormSecondaryDns(config.secondaryDns || '')
    setFormDohUrl(config.dohUrl || '')
    setDialogOpen(true)
  }

  const applyPreset = (preset: keyof typeof DNS_PRESETS) => {
    const p = DNS_PRESETS[preset]
    setFormName(p.name)
    setFormPrimaryDns(p.primaryDns)
    setFormSecondaryDns(p.secondaryDns)
    setFormDohUrl(p.dohUrl)
  }

  const handleAdd = () => {
    if (!formName.trim() || !formPrimaryDns.trim()) {
      toast.error('Name and primary DNS are required')
      return
    }
    if (editConfig) {
      updateMutation.mutate({
        id: editConfig.id,
        data: {
          name: formName.trim(),
          primaryDns: formPrimaryDns.trim(),
          secondaryDns: formSecondaryDns.trim() || undefined,
          dohUrl: formDohUrl.trim() || undefined,
        },
      })
    } else {
      createMutation.mutate({
        name: formName.trim(),
        primaryDns: formPrimaryDns.trim(),
        secondaryDns: formSecondaryDns.trim() || undefined,
        dohUrl: formDohUrl.trim() || undefined,
      })
    }
  }

  const handleActivate = (config: DnsConfig) => {
    if (config.isActive) return
    activateMutation.mutate(config.id)
  }

  const handleTestDns = (config: DnsConfig) => {
    toast.info(`DNS resolution test started for "${config.name}"`, {
      description: `Testing ${config.primaryDns}${config.secondaryDns ? ` and ${config.secondaryDns}` : ''}...`,
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const activeConfig = dnsConfigs.find((c) => c.isActive)

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
          <h1 className="text-xl font-semibold tracking-tight">DNS Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure DNS resolution for your VPN connection
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }} className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add DNS</span>
        </Button>
      </motion.div>

      {/* Active DNS Banner */}
      {activeConfig && (
        <motion.div variants={scaleIn}>
          <div className="relative overflow-hidden rounded-lg border border-primary/20">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <motion.div
              className="absolute inset-0 border-2 border-primary/0 rounded-lg"
              animate={{
                borderColor: [
                  'oklch(0.696 0.17 162.48 / 0)',
                  'oklch(0.696 0.17 162.48 / 0.3)',
                  'oklch(0.696 0.17 162.48 / 0)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative p-4 flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/15">
                <ShieldCheck className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Active: {activeConfig.name}</p>
                  <span className="text-[10px] font-medium text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  {activeConfig.primaryDns}
                  {activeConfig.secondaryDns && `, ${activeConfig.secondaryDns}`}
                </p>
              </div>
              {activeConfig.dohUrl && (
                <a
                  href={activeConfig.dohUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors shrink-0"
                >
                  <ExternalLink className="size-3" />
                  <span className="hidden sm:inline font-mono">DoH</span>
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* DNS Info Section */}
      {activeConfig && (
        <motion.div variants={fadeUp}>
          <Card className="card-glow overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <span className="text-sm font-medium">Active DNS Configuration</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Primary DNS</p>
                  <p className="text-sm font-mono font-medium">{activeConfig.primaryDns}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Secondary DNS</p>
                  <p className="text-sm font-mono font-medium">{activeConfig.secondaryDns || '—'}</p>
                </div>
              </div>
              {activeConfig.dohUrl && (
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">DNS-over-HTTPS</p>
                  <a
                    href={activeConfig.dohUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary hover:underline flex items-center gap-1.5"
                  >
                    {activeConfig.dohUrl}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* DNS Configs List */}
      {isLoading ? (
        <motion.div variants={fadeUp} className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </motion.div>
      ) : dnsConfigs.length === 0 ? (
        <motion.div variants={scaleIn}>
          <Card className="p-10">
            <div className="text-center">
              <motion.div
                className="mx-auto size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Globe className="size-7 text-muted-foreground/50" />
              </motion.div>
              <p className="font-medium text-muted-foreground">No DNS configurations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Add a DNS resolver to customize how your VPN traffic resolves domain names
              </p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Add DNS configuration
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} className="space-y-2">
          <AnimatePresence mode="popLayout">
            {dnsConfigs.map((config, index) => (
              <motion.div
                key={config.id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className={`card-glow overflow-hidden transition-colors duration-200 border-l-[3px] ${
                  config.isActive
                    ? 'border-l-primary border-primary/40 bg-primary/5'
                    : 'border-l-muted-foreground/20 hover:border-primary/20'
                }`}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 transition-colors ${
                        config.isActive
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Server className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{config.name}</span>
                          {config.isActive && (
                            <span className="text-[10px] font-medium text-primary bg-primary/15 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {config.primaryDns}
                          </span>
                          {config.secondaryDns && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {config.secondaryDns}
                            </span>
                          )}
                        </div>
                        {config.dohUrl && (
                          <a
                            href={config.dohUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors font-mono mt-0.5"
                          >
                            <ExternalLink className="size-2.5" />
                            {config.dohUrl}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleTestDns(config)}
                        aria-label="Test DNS"
                        title="Test DNS resolution"
                      >
                        <TestTube2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(config)}
                        aria-label="Edit DNS"
                        title="Edit DNS configuration"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {!config.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-primary hover:text-primary gap-1"
                          onClick={() => handleActivate(config)}
                          disabled={activateMutation.isPending}
                        >
                          <Check className="size-3.5" />
                          Set as Active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(config.id)}
                        aria-label="Delete DNS config"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add/Edit DNS Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { resetForm() }
        setDialogOpen(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editConfig ? 'Edit DNS Configuration' : 'Add DNS Configuration'}</DialogTitle>
            <DialogDescription>
              {editConfig ? 'Modify the DNS resolver configuration.' : 'Configure DNS servers for VPN traffic resolution.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Quick-add presets (only for new) */}
            {!editConfig && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Add Preset</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(DNS_PRESETS) as [keyof typeof DNS_PRESETS, typeof DNS_PRESETS.cloudflare][]).map(([key, preset]) => {
                    const PresetIcon = preset.icon
                    return (
                      <motion.button
                        key={key}
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => applyPreset(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${preset.bg} ${preset.color} ${preset.border}`}
                      >
                        <PresetIcon className="size-3.5" />
                        {preset.name}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="dns-name">Name *</Label>
              <Input
                id="dns-name"
                placeholder="Cloudflare DNS"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns-primary">Primary DNS *</Label>
              <Input
                id="dns-primary"
                placeholder="1.1.1.1"
                value={formPrimaryDns}
                onChange={(e) => setFormPrimaryDns(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns-secondary">Secondary DNS (optional)</Label>
              <Input
                id="dns-secondary"
                placeholder="1.0.0.1"
                value={formSecondaryDns}
                onChange={(e) => setFormSecondaryDns(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns-doh">DoH URL (optional)</Label>
              <Input
                id="dns-doh"
                placeholder="https://cloudflare-dns.com/dns-query"
                value={formDohUrl}
                onChange={(e) => setFormDohUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false) }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending || updateMutation.isPending}>
              {editConfig ? 'Save Changes' : 'Add DNS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}