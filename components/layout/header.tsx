"use client"

import { useState } from "react"
import { Zap, Menu, X, User, LogOut, Settings, LayoutDashboard, TrendingUp, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuth } from "@/lib/hooks/use-auth"
import { useNavigationStore, type TabId } from "@/lib/store/navigation-store"
import { cn } from "@/lib/utils"
import { ActiveModelIndicator } from "@/components/layout/active-model-indicator"

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "forecasts", label: "Forecasts", icon: TrendingUp },
  { id: "optimize", label: "Optimize", icon: Sparkles },
]

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { activeTab, setActiveTab } = useNavigationStore()

  const handleLogout = async () => {
    await signOut()
    setIsProfileMenuOpen(false)
  }

  return (
    <>
      {/* Floating Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 py-2">
          {/* Pill-Box Header Container */}
          <div className="h-full px-4 flex items-center justify-between rounded-full bg-[var(--surface)]/90 backdrop-blur-xl border border-[var(--border-subtle)] shadow-lg shadow-black/5">

            {/* Logo + Name */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-md">
                <Zap className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-base font-semibold text-[var(--text-primary)] hidden sm:block">
                Powercast AI
              </span>
            </div>

            {/* Active Model Indicator - Desktop */}
            <div className="hidden lg:block">
              <ActiveModelIndicator />
            </div>

            {/* Center: Pill-Box Tab Navigation - Desktop */}
            <div className="hidden md:flex items-center">
              <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--background)]/60 border border-[var(--border-subtle)]">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-[var(--accent-primary)] text-white shadow-md shadow-[var(--accent-primary)]/25"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <div className="hidden md:block">
                <ThemeToggle />
              </div>

              {/* User Profile - Desktop */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-[var(--background)]/60 border border-[var(--border-subtle)] hover:bg-[var(--surface)] transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] max-w-[100px] truncate hidden lg:inline">
                    {user?.email?.split('@')[0] || "User"}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 p-2 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] shadow-xl shadow-black/10 z-50 animate-fade-in">
                    {/* User Info */}
                    <div className="p-3 mb-2 rounded-xl bg-[var(--background)]/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {user?.user_metadata?.name || user?.email?.split('@')[0] || "User"}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]/50 rounded-xl transition-colors">
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>

                    <div className="my-1.5 border-t border-[var(--border-subtle)]" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--accent-danger)] hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-full bg-[var(--background)]/60 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Menu Panel - Floating Pill Card */}
          <div className="fixed top-20 left-4 right-4 z-50 p-4 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] shadow-xl shadow-black/10 md:hidden animate-fade-in">
            {/* Mobile Tab Navigation */}
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
                Navigation
              </p>
              <div className="flex flex-col gap-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setIsMobileMenuOpen(false)
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive
                          ? "bg-[var(--accent-primary)] text-white shadow-md shadow-[var(--accent-primary)]/25"
                          : "bg-[var(--background)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background)]"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Theme Section */}
            <div className="py-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Theme
                </p>
                <ThemeToggle />
              </div>
            </div>

            {/* Mobile User Section */}
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <div className="p-3 rounded-xl bg-[var(--background)]/50 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {user?.user_metadata?.name || user?.email?.split('@')[0] || "User"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-sm font-medium text-[var(--accent-danger)] hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
