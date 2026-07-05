'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  GripVertical,
  ShieldOff,
  ShieldCheck,
  Layers,
  CheckCircle2,
  Globe,
  Smartphone,
  Network,
  AlertTriangle,
  Loader2,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'

interface SplitTunnelRule {
  id: string
  type: 'whitelist' | 'blacklist'
  targetType: 'domain' | 'app' | 'ip'
  value: string
  enabled: boolean
  order: number
  createdAt: string
}

function getTargetColor(type: 'domain' | 'app' | 'ip') {
  switch (type) {
    case 'domain': return { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: Globe }
    case 'app': return { border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', icon: Smartphone }
    case 'ip': return { border: 'border-l-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: Network }
  }
}

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.03 } },
}

function SortableRule({
  rule,
  index,
  onToggle,
  onDelete,
}: {
  rule: SplitTunnelRule
  index: number
  onToggle: (rule: SplitTunnelRule) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const targetColor = getTargetColor(rule.targetType)
  const TargetIcon = targetColor.icon

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={fadeUp}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      layout
      className={`flex items-center gap-3 p-3 rounded-lg border border-border bg-card card-hover-gradient border-l-[3px] ${targetColor.border} transition-colors ${
        isDragging ? 'opacity-60 shadow-lg z-50 scale-[1.02]' : ''
      } ${!rule.enabled ? 'opacity-50' : ''}`}
    >
      {/* Drag handle with dotted pattern */}
      <button
        className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none py-1 px-0.5 rounded border border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <div className="flex flex-col gap-0.5">
          <GripVertical className="size-3.5" />
        </div>
      </button>

      {/* Target type badge with icon */}
      <Badge
        variant="outline"
        className={`text-[10px] font-mono uppercase shrink-0 w-16 justify-center gap-1 px-1.5 py-0 ${targetColor.bg} ${targetColor.text} border-transparent`}
      >
        <TargetIcon className="size-2.5" />
        {rule.targetType}
      </Badge>

      <span className="text-sm font-mono flex-1 min-w-0 truncate">{rule.value}</span>

      <Switch
        checked={rule.enabled}
        onCheckedChange={() => onToggle(rule)}
        aria-label={`Toggle ${rule.value}`}
      />

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(rule.id)}
        aria-label="Delete rule"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </motion.div>
  )
}

export function SplitTunnelingTab() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'whitelist' | 'blacklist'>('whitelist')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [formTargetType, setFormTargetType] = useState<'domain' | 'app' | 'ip'>('domain')
  const [formValue, setFormValue] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)
  const [bulkText, setBulkText] = useState('')
  const [bulkTargetType, setBulkTargetType] = useState<'domain' | 'app' | 'ip'>('domain')
  const [bulkAdding, setBulkAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const { data: rules = [], isLoading } = useQuery<SplitTunnelRule[]>({
    queryKey: ['split-tunneling'],
    queryFn: () => fetch('/api/split-tunneling').then((r) => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (data: { type: string; targetType: string; value: string; enabled: boolean }) =>
      fetch('/api/split-tunneling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to add rule') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-tunneling'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add rule'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/split-tunneling/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to update rule') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-tunneling'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update rule'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/split-tunneling/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to delete rule') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-tunneling'] })
      toast.success('Rule deleted')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete rule'),
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; order: number }[]) =>
      fetch('/api/split-tunneling/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to reorder rules') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-tunneling'] })
    },
  })

  const filteredRules = rules
    .filter((r) => r.type === mode)
    .sort((a, b) => a.order - b.order)

  // Computed stats
  const whitelistRules = rules.filter((r) => r.type === 'whitelist')
  const blacklistRules = rules.filter((r) => r.type === 'blacklist')
  const totalRules = rules.length
  const enabledRules = rules.filter((r) => r.enabled).length
  const whitelistCount = whitelistRules.length
  const blacklistCount = blacklistRules.length
  const currentRules = mode === 'whitelist' ? whitelistRules : blacklistRules
  const domainCount = currentRules.filter((r) => r.targetType === 'domain').length
  const appCount = currentRules.filter((r) => r.targetType === 'app').length
  const ipCount = currentRules.filter((r) => r.targetType === 'ip').length
  const majorityMode = whitelistCount >= blacklistCount ? 'whitelist' : 'blacklist'
  const stats = { totalRules, enabledRules, whitelistCount, blacklistCount, majorityMode, domainCount, appCount, ipCount }

  const resetForm = () => {
    setFormTargetType('domain')
    setFormValue('')
    setFormEnabled(true)
  }

  const handleAddRule = () => {
    if (!formValue.trim()) {
      toast.error('Please enter a value')
      return
    }
    createMutation.mutate(
      {
        type: mode,
        targetType: formTargetType,
        value: formValue.trim(),
        enabled: formEnabled,
      },
      {
        onSuccess: () => {
          toast.success('Rule added')
          setDialogOpen(false)
          resetForm()
        },
      }
    )
  }

  const handleBulkAdd = async () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) {
      toast.error('Please enter at least one rule')
      return
    }
    setBulkAdding(true)
    let successCount = 0
    let failCount = 0
    for (const line of lines) {
      try {
        await createMutation.mutateAsync({
          type: mode,
          targetType: bulkTargetType,
          value: line,
          enabled: true,
        })
        successCount++
      } catch {
        failCount++
      }
    }
    setBulkAdding(false)
    if (failCount === 0) {
      toast.success(`${successCount} rule${successCount > 1 ? 's' : ''} added`)
      setBulkDialogOpen(false)
      setBulkText('')
    } else {
      toast.success(`${successCount} rule${successCount > 1 ? 's' : ''} added, ${failCount} failed`)
      if (failCount === lines.length) return
      setBulkDialogOpen(false)
      setBulkText('')
    }
    queryClient.invalidateQueries({ queryKey: ['split-tunneling'] })
  }

  const handleClearAll = () => {
    const modeRules = rules.filter((r) => r.type === mode)
    for (const rule of modeRules) {
      deleteMutation.mutate(rule.id)
    }
    toast.success(`All ${mode} rules cleared`)
    setClearDialogOpen(false)
  }

  const handleToggle = (rule: SplitTunnelRule) => {
    updateMutation.mutate({ id: rule.id, data: { enabled: !rule.enabled } })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const handleDragEnd = (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = filteredRules.findIndex((r) => r.id === active.id)
    const newIndex = filteredRules.findIndex((r) => r.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(filteredRules, oldIndex, newIndex)
    reorderMutation.mutate(newOrder.map((r, i) => ({ id: r.id, order: i })))
  }

  // Build target type count display
  const targetTypeParts: string[] = []
  if (stats.domainCount > 0) targetTypeParts.push(`${stats.domainCount} domain${stats.domainCount > 1 ? 's' : ''}`)
  if (stats.appCount > 0) targetTypeParts.push(`${stats.appCount} app${stats.appCount > 1 ? 's' : ''}`)
  if (stats.ipCount > 0) targetTypeParts.push(`${stats.ipCount} IP${stats.ipCount > 1 ? 's' : ''}`)
  const targetTypeDisplay = targetTypeParts.length > 0 ? targetTypeParts.join(', ') : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Split Tunneling</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control which traffic goes through the VPN
          </p>
        </div>
        <div className="flex gap-2">
          {filteredRules.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBulkTargetType('domain'); setBulkText(''); setBulkDialogOpen(true) }}
            className="gap-1.5"
          >
            <FileText className="size-4" />
            <span className="hidden sm:inline">Bulk Add</span>
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Rule</span>
          </Button>
        </div>
      </div>

      {/* Info Card */}
      {!isLoading && rules.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-5 dot-pattern">
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Layers className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Rules</p>
                  <p className="text-lg font-bold text-foreground">{stats.totalRules}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enabled</p>
                  <p className="text-lg font-bold text-foreground">{stats.enabledRules}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                  <ShieldCheck className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Whitelist</p>
                  <p className="text-lg font-bold text-foreground">{stats.whitelistCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center">
                  <ShieldOff className="size-4 text-red-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Blacklist</p>
                  <p className="text-lg font-bold text-foreground">{stats.blacklistCount}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tabs for Whitelist / Blacklist */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'whitelist' | 'blacklist')}>
        <div className="relative">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-grid h-10 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger
              value="whitelist"
              className="relative gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Whitelist
              {stats.whitelistCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center">
                  {stats.whitelistCount}
                </Badge>
              )}
              {mode === 'whitelist' && (
                <motion.div
                  layoutId="tab-active-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="blacklist"
              className="relative gap-1.5 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
            >
              <ShieldOff className="size-3.5 text-red-400" />
              Blacklist
              {stats.blacklistCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center">
                  {stats.blacklistCount}
                </Badge>
              )}
              {mode === 'blacklist' && (
                <motion.div
                  layoutId="tab-active-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-red-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={mode} className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full shimmer" />
              ))}
            </div>
          ) : filteredRules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-10 border-dashed">
                <div className="text-center space-y-4">
                  <div className="relative mx-auto size-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    {mode === 'whitelist' ? (
                      <ShieldCheck className="size-7 text-muted-foreground" />
                    ) : (
                      <ShieldOff className="size-7 text-muted-foreground" />
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                      <Plus className="size-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">No {mode} rules yet</p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                      {mode === 'whitelist'
                        ? 'Whitelist mode: Only matching traffic will be routed through the VPN tunnel. Add domains, apps, or IP ranges to allow.'
                        : 'Blacklist mode: Matching traffic will bypass the VPN tunnel. Add domains, apps, or IP ranges to exclude.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
                      <Plus className="size-3.5" />
                      Add Rule
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setBulkTargetType('domain'); setBulkText(''); setBulkDialogOpen(true) }} className="gap-1.5">
                      <FileText className="size-3.5" />
                      Bulk Add
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {/* Target type count display */}
              {targetTypeDisplay && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="size-3 text-emerald-400" />
                  <span>{targetTypeDisplay}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{filteredRules.filter((r) => r.enabled).length} of {filteredRules.length} enabled</span>
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredRules.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      <AnimatePresence>
                        {filteredRules.map((rule, index) => (
                          <SortableRule
                            key={rule.id}
                            rule={rule}
                            index={index}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </SortableContext>
              </DndContext>

              <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1.5">
                <GripVertical className="size-3" />
                Drag to reorder priority
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rule</DialogTitle>
            <DialogDescription>
              Add a new {mode} rule. {mode === 'whitelist' ? 'Only matching traffic will use VPN.' : 'Matching traffic will bypass VPN.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label>Target Type</Label>
              <RadioGroup
                value={formTargetType}
                onValueChange={(v) => setFormTargetType(v as 'domain' | 'app' | 'ip')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="domain" id="type-domain" />
                  <Label htmlFor="type-domain" className="font-normal cursor-pointer">Domain</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="app" id="type-app" />
                  <Label htmlFor="type-app" className="font-normal cursor-pointer">App</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ip" id="type-ip" />
                  <Label htmlFor="type-ip" className="font-normal cursor-pointer">IP</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-value">
                Value {formTargetType === 'domain' ? '(e.g. *.google.com)' : formTargetType === 'ip' ? '(e.g. 192.168.1.0/24)' : '(e.g. com.chrome)'})
              </Label>
              <Input
                id="rule-value"
                placeholder={formTargetType === 'domain' ? '*.example.com' : formTargetType === 'ip' ? '10.0.0.0/8' : 'com.app.name'}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-enabled">Enabled</Label>
              <Switch
                id="rule-enabled"
                checked={formEnabled}
                onCheckedChange={setFormEnabled}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule} disabled={createMutation.isPending}>
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Add Rules</DialogTitle>
            <DialogDescription>
              Paste multiple values, one per line. Each line will be added as a separate {mode} rule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <Label>Target Type</Label>
              <RadioGroup
                value={bulkTargetType}
                onValueChange={(v) => setBulkTargetType(v as 'domain' | 'app' | 'ip')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="domain" id="bulk-type-domain" />
                  <Label htmlFor="bulk-type-domain" className="font-normal cursor-pointer">Domain</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="app" id="bulk-type-app" />
                  <Label htmlFor="bulk-type-app" className="font-normal cursor-pointer">App</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ip" id="bulk-type-ip" />
                  <Label htmlFor="bulk-type-ip" className="font-normal cursor-pointer">IP</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-values">
                Values (one per line)
              </Label>
              <Textarea
                id="bulk-values"
                placeholder={bulkTargetType === 'domain'
                  ? '*.google.com\n*.github.com\n*.cloudflare.com'
                  : bulkTargetType === 'ip'
                    ? '10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16'
                    : 'com.chrome\ncom.android.chrome\norg.telegram.messenger'}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="font-mono text-xs min-h-[120px]"
              />
              {bulkText.trim().length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {bulkText.split('\n').filter((l) => l.trim().length > 0).length} rule{bulkText.split('\n').filter((l) => l.trim().length > 0).length > 1 ? 's' : ''} to add
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAdd}
              disabled={bulkAdding || bulkText.trim().length === 0}
            >
              {bulkAdding ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : null}
              Add Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Clear All {mode === 'whitelist' ? 'Whitelist' : 'Blacklist'} Rules
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {filteredRules.length} {mode} rules? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}