import { create } from 'zustand'

export type TabType = 'overview' | 'configs' | 'subscriptions' | 'split-tunneling' | 'ping' | 'dns' | 'sharing'

interface VpnStore {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  selectedConfigId: string | null
  setSelectedConfigId: (id: string | null) => void
  connectedConfigName: string | null
  setConnectedConfigName: (name: string | null) => void
  pendingImportDialog: boolean
  setPendingImportDialog: (open: boolean) => void
}

export const useVpnStore = create<VpnStore>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedConfigId: null,
  setSelectedConfigId: (id) => set({ selectedConfigId: id }),
  connectedConfigName: null,
  setConnectedConfigName: (name) => set({ connectedConfigName: name }),
  pendingImportDialog: false,
  setPendingImportDialog: (open) => set({ pendingImportDialog: open }),
}))