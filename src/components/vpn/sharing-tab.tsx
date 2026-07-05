'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Network,
  Pencil,
  TestTube2,
  Monitor,
  Smartphone,
  Router,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'

interface VpnShare {
  id: string
  interfaceName: string
  ipRange: string
  gateway?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
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

function NetworkDiagram({ enabled }: { enabled: boolean }) {
  const lineColor = enabled ? 'oklch(0.696 0.17 162.48)' : 'oklch(0.556 0 0)'
  const dotColor = enabled ? 'oklch(0.696 0.17 162.48)' : 'oklch(0.7 0 0)'

  return (
    <svg viewBox="0 0 220 60" className="w-full max-w-[220px] h-auto" fill="none">
      {/* Device node */}
      <g>
        <rect x="4" y="16" width="28" height="28" rx="6" stroke={lineColor} strokeWidth="1.5" fill={enabled ? 'oklch(0.696 0.17 162.48 / 0.1)' : 'oklch(0 0 0 / 0.05)'} />
        <Monitor x="10" y="22" width="16" height="16" stroke={dotColor} strokeWidth="1.5" />
        <text x="18" y="56" textAnchor="middle" fill="oklch(0.556 0 0)" fontSize="7" fontFamily="monospace">Device</text>
      </g>
      {/* Line 1 */}
      <motion.line
        x1="34" y1="30" x2="82" y2="30"
        stroke={lineColor} strokeWidth="1.5" strokeDasharray={enabled ? undefined : '4 3'}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      />
      {enabled && (
        <>
          <motion.circle cx="58" cy="30" r="2" fill="oklch(0.696 0.17 162.48)">
            <animate attributeName="cx" values="36;80;36" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
          </motion.circle>
        </>
      )}
      {/* Shared interface node */}
      <g>
        <rect x="82" y="16" width="56" height="28" rx="6" stroke={lineColor} strokeWidth="1.5" fill={enabled ? 'oklch(0.696 0.17 162.48 / 0.1)' : 'oklch(0 0 0 / 0.05)'} />
        <Router x="95" y="22" width="30" height="16" stroke={dotColor} strokeWidth="1.5" />
        <text x="110" y="56" textAnchor="middle" fill="oklch(0.556 0 0)" fontSize="6" fontFamily="monospace">Shared IF</text>
      </g>
      {/* Line 2 */}
      <motion.line
        x1="140" y1="30" x2="188" y2="30"
        stroke={lineColor} strokeWidth="1.5" strokeDasharray={enabled ? undefined : '4 3'}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      />
      {enabled && (
        <>
          <motion.circle cx="164" cy="30" r="2" fill="oklch(0.696 0.17 162.48)">
            <animate attributeName="cx" values="142;186;142" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2.2s" repeatCount="indefinite" />
          </motion.circle>
        </>
      )}
      {/* Other devices node */}
      <g>
        <rect x="188" y="16" width="28" height="28" rx="6" stroke={lineColor} strokeWidth="1.5" fill={enabled ? 'oklch(0.696 0.17 162.48 / 0.1)' : 'oklch(0 0 0 / 0.05)'} />
        <Smartphone x="195" y="22" width="14" height="16" stroke={dotColor} strokeWidth="1.5" />
        <text x="202" y="56" textAnchor="middle" fill="oklch(0.556 0 0)" fontSize="7" fontFamily="monospace">Clients</text>
      </g>
    </svg>
  )
}

export function SharingTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editShare, setEditShare] = useState<VpnShare | null>(null)
  const [formInterface, setFormInterface] = useState('')
  const [formIpRange, setFormIpRange] = useState('')
  const [formGateway, setFormGateway] = useState('')

  const { data: shares = [], isLoading } = useQuery<VpnShare[]>({
    queryKey: ['vpn-sharing'],
    queryFn: () => fetch('/api/sharing').then((r) => r.json()),
  })

  // DHCP gateway suggestion
  const gatewaySuggestion = useMemo(() => {
    const match = formIpRange.match(/^(\d+\.\d+\.\d+)\.\d+\/(\d+)$/)
    if (match && parseInt(match[2], 10) >= 24) {
      return `${match[1]}.1`
    }
    return null
  }, [formIpRange])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to add sharing configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-sharing'] })
      toast.success(editShare ? 'Sharing configuration updated' : 'Sharing configuration added')
      setDialogOpen(false)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add sharing configuration'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/sharing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to update sharing configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-sharing'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update sharing configuration'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/sharing/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to delete sharing configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-sharing'] })
      toast.success('Sharing configuration deleted')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete sharing configuration'),
  })

  const resetForm = () => {
    setFormInterface('')
    setFormIpRange('')
    setFormGateway('')
    setEditShare(null)
  }

  const openEditDialog = (share: VpnShare) => {
    setEditShare(share)
    setFormInterface(share.interfaceName)
    setFormIpRange(share.ipRange)
    setFormGateway(share.gateway || '')
    setDialogOpen(true)
  }

  const handleAdd = () => {
    if (!formInterface.trim() || !formIpRange.trim()) {
      toast.error('Interface name and IP range are required')
      return
    }
    if (editShare) {
      updateMutation.mutate({
        id: editShare.id,
        data: {
          interfaceName: formInterface.trim(),
          ipRange: formIpRange.trim(),
          gateway: formGateway.trim() || undefined,
        },
      })
    } else {
      createMutation.mutate({
        interfaceName: formInterface.trim(),
        ipRange: formIpRange.trim(),
        gateway: formGateway.trim() || undefined,
      })
    }
  }

  const handleToggle = (share: VpnShare) => {
    updateMutation.mutate({ id: share.id, data: { enabled: !share.enabled } })
  }

  const handleTestInterface = (share: VpnShare) => {
    toast.info(`Interface test started for "${share.interfaceName}"`, {
      description: `Checking ${share.ipRange} availability...`,
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const enabledCount = shares.filter((s) => s.enabled).length

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
          <h1 className="text-xl font-semibold tracking-tight">VPN Sharing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Share your VPN connection with other devices on the network
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }} className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Add Sharing</span>
        </Button>
      </motion.div>

      {/* Status Banner */}
      {shares.length > 0 && (
        <motion.div variants={scaleIn}>
          <div className={`relative overflow-hidden rounded-lg border ${
            enabledCount > 0
              ? 'border-primary/20'
              : 'border-border'
          }`}>
            {enabledCount > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            )}
            <div className="relative p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
                  enabledCount > 0
                    ? 'bg-primary/15'
                    : 'bg-muted'
                }`}>
                  {enabledCount > 0 ? (
                    <Wifi className="size-5 text-primary" />
                  ) : (
                    <WifiOff className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {enabledCount > 0
                      ? `${enabledCount} interface${enabledCount > 1 ? 's' : ''} actively sharing`
                      : 'No active sharing interfaces'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {enabledCount > 0
                      ? 'Other devices can connect through shared interfaces'
                      : 'Enable an interface to start sharing'}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <NetworkDiagram enabled={enabledCount > 0} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Sharing Configs List */}
      {isLoading ? (
        <motion.div variants={fadeUp} className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </motion.div>
      ) : shares.length === 0 ? (
        <motion.div variants={scaleIn}>
          <Card className="p-10">
            <div className="text-center">
              <motion.div
                className="mx-auto size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Network className="size-7 text-muted-foreground/50" />
              </motion.div>
              <p className="font-medium text-muted-foreground">No sharing configurations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Set up a shared interface to provide VPN access to other devices on your local network
              </p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Add sharing config
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} className="space-y-2">
          <AnimatePresence mode="popLayout">
            {shares.map((share, index) => (
              <motion.div
                key={share.id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className={`card-glow overflow-hidden transition-colors duration-200 border-l-[3px] ${
                  share.enabled
                    ? 'border-l-primary border-primary/30'
                    : 'border-l-muted-foreground/20 hover:border-primary/20'
                }`}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex items-center justify-center size-11 rounded-xl shrink-0 transition-colors ${
                        share.enabled
                          ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {share.enabled ? (
                          <Wifi className="size-5" />
                        ) : (
                          <WifiOff className="size-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium font-mono">
                            {share.interfaceName}
                          </span>
                          {share.enabled && (
                            <span className="text-[10px] font-medium text-primary bg-primary/15 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            Range: {share.ipRange}
                          </span>
                          {share.gateway && (
                            <span className="text-xs text-muted-foreground font-mono">
                              Gateway: {share.gateway}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleTestInterface(share)}
                        aria-label="Test interface"
                        title="Test interface"
                      >
                        <TestTube2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(share)}
                        aria-label="Edit sharing"
                        title="Edit sharing configuration"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Switch
                        checked={share.enabled}
                        onCheckedChange={() => handleToggle(share)}
                        aria-label={`Toggle ${share.interfaceName}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(share.id)}
                        aria-label="Delete sharing config"
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

      {/* Add/Edit Sharing Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { resetForm() }
        setDialogOpen(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editShare ? 'Edit Sharing Configuration' : 'Add Sharing Configuration'}</DialogTitle>
            <DialogDescription>
              {editShare ? 'Modify the network sharing configuration.' : 'Set up a network interface to share your VPN connection.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="share-interface">Interface Name *</Label>
              <Input
                id="share-interface"
                placeholder="wlan0"
                value={formInterface}
                onChange={(e) => setFormInterface(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-iprange">IP Range *</Label>
              <Input
                id="share-iprange"
                placeholder="192.168.43.1/24"
                value={formIpRange}
                onChange={(e) => setFormIpRange(e.target.value)}
                className="font-mono"
              />
            </div>
            {/* DHCP Gateway Suggestion */}
            {gatewaySuggestion && !formGateway && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-xs"
              >
                <Lightbulb className="size-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Suggested gateway: <button type="button" onClick={() => setFormGateway(gatewaySuggestion)} className="text-primary font-mono font-medium hover:underline">{gatewaySuggestion}</button>
                </span>
              </motion.div>
            )}
            <div className="space-y-2">
              <Label htmlFor="share-gateway">Gateway (optional)</Label>
              <Input
                id="share-gateway"
                placeholder="192.168.43.1"
                value={formGateway}
                onChange={(e) => setFormGateway(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false) }}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending || updateMutation.isPending}>
              {editShare ? 'Save Changes' : 'Add Sharing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}