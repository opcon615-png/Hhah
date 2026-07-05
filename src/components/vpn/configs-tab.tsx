'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Upload,
  Trash2,
  Pencil,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  QrCode,
  Search,
  ClipboardPaste,
  FileText,
  Shield,
  ArrowRightLeft,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useVpnStore } from '@/lib/store'

interface VpnConfig {
  id: string
  name: string
  protocol: string
  server: string
  port: number
  configData: string
  remark?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

const protocols = ['vmess', 'vless', 'trojan', 'shadowsocks', 'wireguard', 'hysteria2']

const filterChips = [
  { label: 'All', value: 'all' },
  { label: 'VMess', value: 'vmess' },
  { label: 'VLESS', value: 'vless' },
  { label: 'Trojan', value: 'trojan' },
  { label: 'SS', value: 'shadowsocks' },
  { label: 'WG', value: 'wireguard' },
  { label: 'HY2', value: 'hysteria2' },
]

function getProtocolClass(protocol: string): string {
  const map: Record<string, string> = {
    vmess: 'protocol-vmess',
    vless: 'protocol-vless',
    trojan: 'protocol-trojan',
    shadowsocks: 'protocol-shadowsocks',
    wireguard: 'protocol-wireguard',
    hysteria2: 'protocol-hysteria2',
  }
  return map[protocol] || ''
}

function getCardBorderClass(protocol: string): string {
  const map: Record<string, string> = {
    vmess: 'card-border-vmess card-glow-vmess',
    vless: 'card-border-vless card-glow-vless',
    trojan: 'card-border-trojan card-glow-trojan',
    shadowsocks: 'card-border-shadowsocks card-glow-shadowsocks',
    wireguard: 'card-border-wireguard card-glow-wireguard',
    hysteria2: 'card-border-hysteria2 card-glow-hysteria2',
  }
  return map[protocol] || ''
}

function getProtocolIcon(protocol: string): string {
  const map: Record<string, string> = {
    vmess: '⚡',
    vless: '🔮',
    trojan: '🐴',
    shadowsocks: '🧦',
    wireguard: '🔗',
    hysteria2: '🚀',
  }
  return map[protocol] || '🌐'
}

function getProtocolDisplay(protocol: string): string {
  const map: Record<string, string> = {
    vmess: 'VMess',
    vless: 'VLESS',
    trojan: 'Trojan',
    shadowsocks: 'SS',
    wireguard: 'WG',
    hysteria2: 'HY2',
  }
  return map[protocol] || protocol
}

function generateShareLink(config: VpnConfig): string {
  const { name, protocol, server, port, configData } = config
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(configData)
  } catch {
    // configData is not valid JSON
  }

  switch (protocol) {
    case 'vmess': {
      if (parsed && typeof parsed === 'object') {
        const obj = {
          v: '2',
          ps: name,
          add: server,
          port: port,
          id: String(parsed.id || ''),
          aid: Number(parsed.alterId) || 0,
          net: String(parsed.network || 'tcp'),
          type: String(parsed.type || 'none'),
          host: String(parsed.host || ''),
          path: String(parsed.path || ''),
          tls: String(parsed.tls || ''),
        }
        return 'vmess://' + btoa(JSON.stringify(obj))
      }
      return configData
    }
    case 'vless': {
      if (parsed && typeof parsed === 'object') {
        const id = String(parsed.id || '')
        const network = String(parsed.network || 'tcp')
        const tls = String(parsed.tls || '')
        return `vless://${id}@${server}:${port}?encryption=none&type=${network}&security=${tls}#${encodeURIComponent(name)}`
      }
      return configData
    }
    case 'trojan': {
      const password = parsed ? String(parsed.password || '') : configData
      const tls = parsed ? String(parsed.tls || 'tls') : 'tls'
      return `trojan://${password}@${server}:${port}?security=${tls}#${encodeURIComponent(name)}`
    }
    case 'shadowsocks': {
      const method = parsed ? String(parsed.method || 'aes-256-gcm') : 'aes-256-gcm'
      const password = parsed ? String(parsed.password || '') : configData
      const userInfo = btoa(`${method}:${password}`)
      return `ss://${userInfo}@${server}:${port}#${encodeURIComponent(name)}`
    }
    case 'wireguard': {
      return configData
    }
    case 'hysteria2': {
      const password = parsed ? String(parsed.password || '') : configData
      return `hysteria2://${password}@${server}:${port}#${encodeURIComponent(name)}`
    }
    default:
      return configData
  }
}

function detectProtocol(data: string): string {
  const d = data.trim()
  if (d.startsWith('vmess://')) return 'vmess'
  if (d.startsWith('vless://')) return 'vless'
  if (d.startsWith('trojan://')) return 'trojan'
  if (d.startsWith('ss://')) return 'shadowsocks'
  if (d.startsWith('wg://') || d.includes('[Interface]')) return 'wireguard'
  if (d.startsWith('hysteria2://') || d.startsWith('hy2://')) return 'hysteria2'
  try {
    const parsed = JSON.parse(atob(d))
    if (parsed.v) return parsed.v === 'vmess' ? 'vmess' : 'vless'
  } catch { /* not base64 json */ }
  return 'vmess'
}

function getAutoDetectedType(data: string): string {
  const d = data.trim()
  if (d.startsWith('vmess://') || d.startsWith('vless://') || d.startsWith('trojan://') || d.startsWith('ss://') || d.startsWith('hysteria2://') || d.startsWith('hy2://')) {
    return 'v2ray'
  }
  try { JSON.parse(d); return 'json' } catch { /* not json */ }
  try { atob(d); return 'base64' } catch { /* not base64 */ }
  return 'v2ray'
}

function parseImportPreview(data: string): { count: number; protocols: string[] } {
  const lines = data.trim().split('\n').filter((l) => l.trim())
  const protocolSet = new Set<string>()
  for (const line of lines) {
    const p = detectProtocol(line)
    protocolSet.add(p)
  }
  return { count: lines.length, protocols: Array.from(protocolSet) }
}

function formatConfigData(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

export function ConfigsTab() {
  const queryClient = useQueryClient()
  const { pendingImportDialog, setPendingImportDialog } = useVpnStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<VpnConfig | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importData, setImportData] = useState('')
  const [importType, setImportType] = useState('')
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrConfig, setQrConfig] = useState<VpnConfig | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Watch for pending import dialog from overview
  useEffect(() => {
    if (pendingImportDialog) {
      setPendingImportDialog(false)
      // Use flushSync-like approach: queue dialog open after state reset
      const timer = setTimeout(() => {
        setImportType('')
        setImportData('')
        setImportDialogOpen(true)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [pendingImportDialog, setPendingImportDialog])

  // Form state
  const [formName, setFormName] = useState('')
  const [formProtocol, setFormProtocol] = useState('')
  const [formServer, setFormServer] = useState('')
  const [formPort, setFormPort] = useState('')
  const [formConfigData, setFormConfigData] = useState('')

  const { data: configs = [], isLoading } = useQuery<VpnConfig[]>({
    queryKey: ['configs'],
    queryFn: () => fetch('/api/configs').then((r) => r.json()),
  })

  const filteredConfigs = useMemo(() => {
    let result = configs
    if (activeFilter !== 'all') {
      result = result.filter((c) => c.protocol === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.server.toLowerCase().includes(q) ||
          c.protocol.toLowerCase().includes(q)
      )
    }
    return result
  }, [configs, activeFilter, searchQuery])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to create configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      toast.success('Configuration created')
      setEditDialogOpen(false)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create configuration'),
  })

  const cloneMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to duplicate configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      toast.success('Configuration duplicated')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to duplicate configuration'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/configs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) return r.json().then((e) => { throw new Error(e.error || 'Failed to update configuration') })
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      toast.success('Configuration updated')
      setEditDialogOpen(false)
      setEditingConfig(null)
      resetForm()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update configuration'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/configs/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      toast.success('Configuration deleted')
      setDeleteDialogOpen(false)
      setDeletingId(null)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete configuration'),
  })

  const importMutation = useMutation({
    mutationFn: async (data: { type: string; data: string }) => {
      const res = await fetch('/api/configs/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')
      return json
    },
    onSuccess: (result: { imported: number; total: number; failed?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['configs'] })
      if (result.total > 1) {
        toast.success(`Imported ${result.imported} of ${result.total} configs${result.failed ? ` (${result.failed} failed)` : ''}`)
      } else {
        toast.success('Configuration imported')
      }
      setImportDialogOpen(false)
      setImportData('')
      setImportType('')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to import configuration'),
  })

  const resetForm = () => {
    setFormName('')
    setFormProtocol('')
    setFormServer('')
    setFormPort('')
    setFormConfigData('')
  }

  const openCreateDialog = () => {
    resetForm()
    setEditingConfig(null)
    setEditDialogOpen(true)
  }

  const openEditDialog = (config: VpnConfig) => {
    setEditingConfig(config)
    setFormName(config.name)
    setFormProtocol(config.protocol)
    setFormServer(config.server)
    setFormPort(config.port.toString())
    setFormConfigData(config.configData || '')
    setEditDialogOpen(true)
  }

  const handleSave = () => {
    if (!formName.trim() || !formProtocol || !formServer.trim() || !formPort) {
      toast.error('Please fill in all required fields')
      return
    }
    const payload = {
      name: formName.trim(),
      protocol: formProtocol,
      server: formServer.trim(),
      port: parseInt(formPort, 10),
      configData: formConfigData,
    }
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleClone = (config: VpnConfig) => {
    cloneMutation.mutate({
      name: `${config.name} (Copy)`,
      protocol: config.protocol,
      server: config.server,
      port: config.port,
      configData: config.configData,
    })
  }

  function resolveImportType(data: string, selectedType: string): string {
    if (selectedType) return selectedType
    return getAutoDetectedType(data)
  }

  const handleImport = () => {
    if (!importData.trim()) {
      toast.error('Please paste a configuration')
      return
    }
    const importTypeResolved = resolveImportType(importData, importType)
    importMutation.mutate({ type: importTypeResolved, data: importData.trim() })
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setImportData(text)
        if (!importType) setImportType(getAutoDetectedType(text))
        toast.success('Pasted from clipboard')
      }
    } catch {
      toast.error('Unable to read clipboard. Please paste manually.')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.txt') && !file.type.startsWith('text/')) {
      toast.error('Please upload a .txt file')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        setImportData(text)
        if (!importType) setImportType(getAutoDetectedType(text))
        toast.success(`Loaded ${file.name}`)
      }
    }
    reader.readAsText(file)
    // Reset file input so re-uploading the same file works
    e.target.value = ''
  }

  const handleToggleActive = (config: VpnConfig) => {
    updateMutation.mutate({
      id: config.id,
      data: { isActive: !config.isActive },
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (deletingId) deleteMutation.mutate(deletingId)
  }

  const importPreview = useMemo(() => {
    if (!importData.trim()) return null
    return parseImportPreview(importData)
  }, [importData])

  const hasValidationError = useMemo(() => {
    if (!importData.trim()) return null
    const resolved = resolveImportType(importData, importType)
    if (resolved === 'v2ray') {
      const lines = importData.trim().split('\n').filter((l) => l.trim())
      const invalidLines = lines.filter((line) => {
        const d = line.trim()
        return !d.startsWith('vmess://') && !d.startsWith('vless://') && !d.startsWith('trojan://') && !d.startsWith('ss://') && !d.startsWith('wg://') && !d.startsWith('hysteria2://') && !d.startsWith('hy2://')
      })
      if (invalidLines.length > 0) return `${invalidLines.length} line(s) don't match any known protocol format`
      return null
    }
    if (resolved === 'json') {
      try { JSON.parse(importData); return null } catch { return 'Invalid JSON format' }
    }
    if (resolved === 'base64') {
      try { atob(importData.trim()); return null } catch { return 'Invalid base64 encoding' }
    }
    return null
  }, [importData, importType])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configurations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your VPN server configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setImportType(''); setImportData(''); setImportDialogOpen(true) }}>
            <Upload className="size-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Config</span>
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      {!isLoading && configs.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, server, or protocol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setActiveFilter(chip.value)}
                className={`
                  px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer
                  ${activeFilter === chip.value
                    ? chip.value === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : `${getProtocolClass(chip.value)} shadow-sm`
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                {chip.label}
                {chip.value !== 'all' && (
                  <span className="ml-1 opacity-60">
                    {configs.filter((c) => c.protocol === chip.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Config List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : configs.length === 0 ? (
        <Card className="p-8">
          <div className="text-center flex flex-col items-center gap-4">
            <div className="relative">
              <div className="size-20 rounded-full bg-muted/60 flex items-center justify-center">
                <Shield className="size-10 text-muted-foreground/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-background border border-border flex items-center justify-center">
                <Plus className="size-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">No configurations yet</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Get started by importing an existing VPN config or adding one manually. Supports VMess, VLESS, Trojan, Shadowsocks, WireGuard, and Hysteria2.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setImportType(''); setImportData(''); setImportDialogOpen(true) }}>
                <Upload className="size-3.5" />
                Import Config
              </Button>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="size-3.5" />
                Add Manually
              </Button>
            </div>
          </div>
        </Card>
      ) : filteredConfigs.length === 0 ? (
        <Card className="p-8">
          <div className="text-center flex flex-col items-center gap-3">
            <Search className="size-8 text-muted-foreground/40" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium">No matching configurations</h3>
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : `No ${getProtocolDisplay(activeFilter)} configs found`
                }
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setActiveFilter('all') }}>
              Clear filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredConfigs.map((config, index) => (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <Card className={`overflow-hidden transition-all duration-200 ${getCardBorderClass(config.protocol)}`}>
                  <div
                    onClick={() => setExpandedId(expandedId === config.id ? null : config.id)}
                    className="w-full text-left p-4 flex items-center justify-between cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedId(expandedId === config.id ? null : config.id) }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-2.5 rounded-full shrink-0 transition-colors ${config.isActive ? 'bg-primary shadow-[0_0_8px_var(--color-primary)]' : 'bg-muted-foreground/30'}`} />
                      <span className="text-base shrink-0" role="img" aria-label={config.protocol}>
                        {getProtocolIcon(config.protocol)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{config.name}</span>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-mono uppercase shrink-0 border-transparent ${getProtocolClass(config.protocol)}`}
                          >
                            {getProtocolDisplay(config.protocol)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {config.server}:{config.port}
                          {config.remark && ` · ${config.remark}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={config.isActive}
                        onCheckedChange={() => handleToggleActive(config)}
                        aria-label={`Toggle ${config.name}`}
                      />
                      {expandedId === config.id ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedId === config.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0 border-t border-border">
                          <div className="pt-3 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Protocol</span>
                                <p className="font-mono mt-0.5">{config.protocol}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Server</span>
                                <p className="font-mono mt-0.5">{config.server}:{config.port}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Created</span>
                                <p className="mt-0.5">{new Date(config.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Updated</span>
                                <p className="mt-0.5">{new Date(config.updatedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            {config.configData && (
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground text-sm">Config Data</span>
                                </div>
                                <div className="mt-1 relative group">
                                  <pre className="p-3 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-md text-xs font-mono max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all leading-relaxed">
                                    {formatConfigData(config.configData)}
                                  </pre>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(config.configData || '')
                                      toast.success('Config data copied')
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Copy config data"
                                  >
                                    <Copy className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(config.configData || '')
                                  toast.success('Config data copied')
                                }}
                              >
                                <Copy className="size-3.5" />
                                Copy Config
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setQrConfig(config)
                                  setQrDialogOpen(true)
                                }}
                              >
                                <QrCode className="size-3.5" />
                                QR Code
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClone(config)}
                                disabled={cloneMutation.isPending}
                              >
                                <ArrowRightLeft className="size-3.5" />
                                Clone
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(config)}
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(config.id)}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'New Configuration'}</DialogTitle>
            <DialogDescription>
              {editingConfig ? 'Update your VPN configuration details.' : 'Add a new VPN server configuration.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="config-name">Name *</Label>
              <Input
                id="config-name"
                placeholder="My Server"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Protocol *</Label>
              <Select value={formProtocol} onValueChange={setFormProtocol}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select protocol" />
                </SelectTrigger>
                <SelectContent>
                  {protocols.map((p) => (
                    <SelectItem key={p} value={p} className="font-mono text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="config-server">Server *</Label>
                <Input
                  id="config-server"
                  placeholder="1.2.3.4"
                  value={formServer}
                  onChange={(e) => setFormServer(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-port">Port *</Label>
                <Input
                  id="config-port"
                  type="number"
                  placeholder="443"
                  value={formPort}
                  onChange={(e) => setFormPort(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-data">Config Data (JSON)</Label>
              <Textarea
                id="config-data"
                placeholder='{"id": "...", "alterId": 0}'
                className="font-mono text-xs min-h-24"
                value={formConfigData}
                onChange={(e) => setFormConfigData(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingConfig ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Configuration</DialogTitle>
            <DialogDescription>
              Paste a v2ray link, base64 encoded config, or raw configuration string.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Paste & Upload buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteFromClipboard}
                className="flex-1"
              >
                <ClipboardPaste className="size-3.5" />
                Paste from Clipboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <FileText className="size-3.5" />
                Upload .txt File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div className="space-y-2">
              <Label>Import Type</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={importData ? getAutoDetectedType(importData) : 'Auto-detect'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v2ray" className="font-mono text-xs">v2ray Link (vmess/vless/trojan/ss/hy2)</SelectItem>
                  <SelectItem value="base64" className="font-mono text-xs">Base64 Encoded</SelectItem>
                  <SelectItem value="json" className="font-mono text-xs">Raw JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-data">Configuration Data</Label>
              <Textarea
                id="import-data"
                placeholder="vmess://... or base64 string"
                className="font-mono text-xs h-40 resize-none overflow-y-auto break-all whitespace-pre-wrap"
                value={importData}
                onChange={(e) => {
                  setImportData(e.target.value)
                  if (!importType) setImportType(getAutoDetectedType(e.target.value))
                }}
              />
            </div>

            {/* Validation feedback */}
            {hasValidationError && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <Zap className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{hasValidationError}</p>
              </div>
            )}

            {/* Import preview */}
            {importPreview && !hasValidationError && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Preview</span>
                  <span>·</span>
                  <span>{importPreview.count} config{importPreview.count !== 1 ? 's' : ''} detected</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {importPreview.protocols.map((p) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className={`text-[10px] font-mono uppercase border-transparent ${getProtocolClass(p)}`}
                    >
                      {getProtocolIcon(p)} {getProtocolDisplay(p)}
                    </Badge>
                  ))}
                </div>
                <div className="p-3 bg-muted/50 rounded-md text-xs font-mono max-h-24 overflow-y-auto overflow-x-hidden custom-scrollbar break-all whitespace-pre-wrap">
                  {importData.trim().split('\n').map((line, i) => (
                    <div key={i} className="py-0.5 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground mr-2 select-none">{i + 1}.</span>
                      {line.trim().length > 80 ? `${line.trim().slice(0, 80)}...` : line.trim()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || !importData.trim() || !!hasValidationError}
            >
              <Upload className="size-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-primary" />
              QR Code - {qrConfig?.name}
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with your VPN client to import the configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrConfig && (
              <>
                <div className="bg-white rounded-lg p-3">
                  <QRCodeSVG
                    value={generateShareLink(qrConfig)}
                    size={200}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">Share Link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generateShareLink(qrConfig)}
                      className="font-mono text-xs h-9"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(generateShareLink(qrConfig))
                        toast.success('Link copied to clipboard')
                      }}
                    >
                      <Copy className="size-3.5" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this configuration? This action cannot be undone.
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