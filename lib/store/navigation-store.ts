"use client"

import { create } from "zustand"

export type TabId = "dashboard" | "forecasts" | "optimize"

interface NavigationStore {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
