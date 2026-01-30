"use client"

import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  TrendingUp, 
  Sparkles
} from "lucide-react"

export type TabId = "dashboard" | "forecasts" | "optimize"

interface TabNavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "forecasts", label: "Forecasts", icon: TrendingUp },
  { id: "optimize", label: "Optimize", icon: Sparkles },
]

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="sticky top-16 z-40 bg-[var(--background)] border-b border-[var(--border-default)] px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "neu-pressed text-[var(--accent-primary)]"
                    : "neu-flat text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

// Mobile bottom navigation alternative
export function MobileBottomNav({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border-default)] px-2 py-2 md:hidden safe-area-pb">
      <div className="flex items-center justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                isActive
                  ? "text-[var(--accent-primary)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
