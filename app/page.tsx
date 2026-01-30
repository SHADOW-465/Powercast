"use client"

import { DashboardTab } from "@/components/dashboard/dashboard-tab"
import { ForecastsTab } from "@/components/forecasts/forecasts-tab"
import { OptimizeTab } from "@/components/optimization/optimize-tab"
import { useNavigationStore } from "@/lib/store/navigation-store"

export default function HomePage() {
  const { activeTab, setActiveTab } = useNavigationStore()

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
      {activeTab === "dashboard" && <DashboardTab onNavigateToForecasts={() => setActiveTab("forecasts")} />}
      {activeTab === "forecasts" && <ForecastsTab />}
      {activeTab === "optimize" && <OptimizeTab />}
    </main>
  )
}
