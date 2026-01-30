"use client"

import { useState, useMemo } from "react"
import { NeuCard, NeuCardHeader, NeuCardTitle, NeuCardContent } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { SparklineChart } from "@/components/charts"
import { usePlants, usePlantForecast } from "@/lib/hooks"
import { 
  Plus, 
  Sun, 
  Droplets, 
  Atom, 
  Flame, 
  Wind,
  MapPin,
  Activity,
  Settings,
  Edit,
  Power
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { Plant } from "@/lib/supabase/database.types"

const PLANT_ICONS: Record<string, typeof Sun> = {
  solar: Sun,
  hydro: Droplets,
  nuclear: Atom,
  thermal: Flame,
  wind: Wind,
}

const PLANT_COLORS: Record<string, { primary: string; bg: string }> = {
  solar: { primary: "var(--plant-solar)", bg: "var(--plant-solar-bg)" },
  hydro: { primary: "var(--plant-hydro)", bg: "var(--plant-hydro-bg)" },
  nuclear: { primary: "var(--plant-nuclear)", bg: "var(--plant-nuclear-bg)" },
  thermal: { primary: "var(--plant-thermal)", bg: "var(--plant-thermal-bg)" },
  wind: { primary: "var(--plant-wind)", bg: "var(--plant-wind-bg)" },
}

const FILTER_OPTIONS: { value: string | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "solar", label: "Solar" },
  { value: "hydro", label: "Hydro" },
  { value: "nuclear", label: "Nuclear" },
  { value: "thermal", label: "Thermal" },
  { value: "wind", label: "Wind" },
]

export function PlantsTab() {
  const { data: plantsData, isLoading, refetch } = usePlants()
  const [filterType, setFilterType] = useState<string | "all">("all")
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  
  const plants = plantsData?.plants || []
  
  // Generate sparkline-like data for each plant
  const sparklineData = useMemo(() => {
    const data: Record<string, Array<{ value: number }>> = {}
    plants.forEach((plant) => {
      data[plant.id] = [
        { value: plant.current_output_mw * 0.9 },
        { value: plant.current_output_mw * 0.95 },
        { value: plant.current_output_mw },
        { value: plant.current_output_mw * 1.05 },
        { value: plant.current_output_mw * 1.1 },
        { value: plant.current_output_mw * 1.08 },
        { value: plant.current_output_mw * 1.02 },
        { value: plant.current_output_mw },
      ]
    })
    return data
  }, [plants])
 
  const filteredPlants = filterType === "all" 
    ? plants 
    : plants.filter((p) => p.type === filterType)
 
  const totalOutput = plants.reduce((sum, p) => sum + p.current_output_mw, 0)
  const totalCapacity = plants.reduce((sum, p) => sum + p.capacity_mw, 0)
  const onlinePlants = plants.filter((p) => p.status === "online").length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Power Plants
          </h2>
          <p className="text-[var(--text-muted)]">
            Manage and monitor your power generation assets
          </p>
        </div>
        <NeuButton variant="primary" size="md">
          <Plus className="w-4 h-4 mr-2" />
          Add Plant
        </NeuButton>
      </div>
 
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <NeuCard key={i} variant="raised" padding="lg">
              <Skeleton className="h-8 w-2/3 mb-4" />
              <Skeleton className="h-24 w-full" />
            </NeuCard>
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NeuCard variant="flat" padding="md">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{plants.length}</p>
                <p className="text-sm text-[var(--text-muted)]">Total Plants</p>
              </div>
            </NeuCard>
            <NeuCard variant="flat" padding="md">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--accent-success)]">{onlinePlants}</p>
                <p className="text-sm text-[var(--text-muted)]">Online</p>
              </div>
            </NeuCard>
            <NeuCard variant="flat" padding="md">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--accent-primary)]">{Math.round(totalOutput).toLocaleString()}</p>
                <p className="text-sm text-[var(--text-muted)]">Total MW</p>
              </div>
            </NeuCard>
            <NeuCard variant="flat" padding="md">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {totalCapacity > 0 ? ((totalOutput / totalCapacity) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-sm text-[var(--text-muted)]">Utilization</p>
              </div>
            </NeuCard>
          </div>
 
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                  filterType === filter.value
                    ? "neu-pressed text-[var(--accent-primary)]"
                    : "neu-flat text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
 
          {/* Plants Grid */}
          {filteredPlants.length === 0 ? (
            <NeuCard variant="raised" padding="lg">
              <div className="text-center py-12">
                <Activity className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)] opacity-50" />
                <p className="text-[var(--text-muted)]">No plants found for this filter</p>
              </div>
            </NeuCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlants.map((plant) => {
                const Icon = PLANT_ICONS[plant.type] || Sun
                const colors = PLANT_COLORS[plant.type] || { primary: "var(--accent-primary)", bg: "var(--accent-bg)" }
                const utilization = Math.round((plant.current_output_mw / plant.capacity_mw) * 100)
                
                return (
                  <NeuCard 
                    key={plant.id} 
                    variant="raised" 
                    padding="lg" 
                    className="group cursor-pointer"
                    onClick={() => setSelectedPlant(selectedPlant === plant.id ? null : plant.id)}
                  >
                    <NeuCardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-3 rounded-xl transition-transform group-hover:scale-110"
                            style={{ backgroundColor: colors.bg }}
                          >
                            <Icon className="w-6 h-6" style={{ color: colors.primary }} />
                          </div>
                          <div>
                            <NeuCardTitle className="group-hover:text-[var(--accent-primary)] transition-colors text-base">
                              {plant.name}
                            </NeuCardTitle>
                            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
                              <MapPin className="w-3 h-3" />
                              {plant.location || "No location"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-xs font-medium capitalize",
                            plant.status === "online" 
                              ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]"
                              : plant.status === "maintenance"
                              ? "bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]"
                              : "bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                          )}>
                            {plant.status}
                          </span>
                        </div>
                      </div>
                    </NeuCardHeader>
                    
                    <NeuCardContent>
                      <div className="space-y-4 mt-4">
                        {/* Sparkline */}
                        <div className="h-12">
                          <SparklineChart 
                            data={sparklineData[plant.id] || []}
                            color={colors.primary}
                            height={48}
                          />
                        </div>
                        
                        {/* Output */}
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-[var(--text-muted)]">Current Output</span>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {Math.round(plant.current_output_mw)} / {plant.capacity_mw} MW
                            </span>
                          </div>
                          <div className="h-2 neu-inset rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${utilization}%`,
                                backgroundColor: colors.primary 
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Stats Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-secondary)]">
                              {plant.efficiency_pct ? `${plant.efficiency_pct}%` : "N/A"} efficiency
                            </span>
                          </div>
                          <span className="text-sm font-medium" style={{ color: colors.primary }}>
                            {utilization}%
                          </span>
                        </div>
  
                        {/* Expanded Actions */}
                        {selectedPlant === plant.id && (
                          <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)] animate-fade-in">
                            <NeuButton variant="secondary" size="sm" className="flex-1">
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </NeuButton>
                            <NeuButton variant="secondary" size="sm" className="flex-1">
                              <Settings className="w-3 h-3 mr-1" />
                              Config
                            </NeuButton>
                            <NeuButton variant="ghost" size="sm">
                              <Power className="w-3 h-3" />
                            </NeuButton>
                          </div>
                        )}
                      </div>
                    </NeuCardContent>
                  </NeuCard>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
