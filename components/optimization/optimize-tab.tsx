"use client"

import { useState, useMemo, useEffect } from "react"
import { NeuCard, NeuCardHeader, NeuCardTitle, NeuCardContent } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { 
  Sparkles, TrendingUp, ArrowRight, Lightbulb, CheckCircle, X, Zap, Clock, Target, DollarSign,
  Sun, Droplets, Atom, Flame, Wind, AlertCircle, Power, Wrench, Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"
import { usePlantSessionStore } from "@/lib/store/plant-session-store"
import type { PlantType } from "@/lib/types/plant"

type SuggestionType = "dispatch" | "maintenance" | "cost" | "efficiency"

interface PlantSuggestion {
  id: string
  title: string
  description: string
  type: SuggestionType
  priority: "high" | "medium" | "low"
  impact: string
  plantTypes: PlantType[]
}

const PLANT_ICONS: Record<PlantType, typeof Sun> = {
  solar: Sun, hydro: Droplets, nuclear: Atom, thermal: Flame, wind: Wind,
}

const PLANT_COLORS: Record<PlantType, string> = {
  solar: "var(--plant-solar)", hydro: "var(--plant-hydro)", nuclear: "var(--plant-nuclear)", 
  thermal: "var(--plant-thermal)", wind: "var(--plant-wind)",
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "var(--accent-danger)", medium: "var(--accent-warning)", low: "var(--accent-success)",
}

const PLANT_SUGGESTIONS: PlantSuggestion[] = [
  { id: "solar-1", title: "Reduce inverter load during low irradiance", description: "Switch to standby mode when irradiance < 200 W/m²", type: "efficiency", priority: "high", impact: "+15% equipment life", plantTypes: ["solar"] },
  { id: "solar-2", title: "Optimize panel tilt for winter", description: "Adjust tilt by 12° for better sun angle", type: "dispatch", priority: "medium", impact: "+8% capture", plantTypes: ["solar"] },
  { id: "solar-3", title: "Schedule panel cleaning", description: "Clear skies forecast - maximize output", type: "maintenance", priority: "low", impact: "+3% output", plantTypes: ["solar"] },
  { id: "hydro-1", title: "Optimize reservoir release", description: "Align water release with peak demand 6-9 PM", type: "dispatch", priority: "high", impact: "+12% revenue", plantTypes: ["hydro"] },
  { id: "hydro-2", title: "Turbine efficiency check", description: "2.3% degradation detected vs baseline", type: "maintenance", priority: "medium", impact: "+2.3% efficiency", plantTypes: ["hydro"] },
  { id: "hydro-3", title: "Reduce night generation", description: "Store water for peak hours", type: "cost", priority: "medium", impact: "CHF 8K/mo savings", plantTypes: ["hydro"] },
  { id: "wind-1", title: "Adjust blade pitch in turbulence", description: "Reduce structural stress during high turbulence", type: "efficiency", priority: "high", impact: "-18% stress", plantTypes: ["wind"] },
  { id: "wind-2", title: "Yaw optimization", description: "Faster yaw response for wind direction changes", type: "dispatch", priority: "medium", impact: "+5% capture", plantTypes: ["wind"] },
  { id: "wind-3", title: "Gearbox inspection due", description: "Approaching maintenance threshold", type: "maintenance", priority: "low", impact: "99.5% uptime", plantTypes: ["wind"] },
  { id: "nuclear-1", title: "Schedule refueling optimally", description: "Align with forecasted demand dip", type: "maintenance", priority: "high", impact: "Optimal grid stability", plantTypes: ["nuclear"] },
  { id: "nuclear-2", title: "Cooling system optimization", description: "Adjust flow for 0.8% heat rate improvement", type: "efficiency", priority: "medium", impact: "+0.8% efficiency", plantTypes: ["nuclear"] },
  { id: "thermal-1", title: "Ramp down during solar peak", description: "Reduce output 12:00-14:00 to save fuel", type: "dispatch", priority: "high", impact: "CHF 12K/mo savings", plantTypes: ["thermal"] },
  { id: "thermal-2", title: "Combustion optimization", description: "Adjust air-fuel ratio", type: "efficiency", priority: "medium", impact: "+1.5% efficiency", plantTypes: ["thermal"] },
]

export function OptimizeTab() {
  const [hydrated, setHydrated] = useState(false)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const store = usePlantSessionStore()

  useEffect(() => {
    usePlantSessionStore.persist.rehydrate()
    setHydrated(true)
  }, [])

  const { forecastInitialized, plantType, plantName, capacity, inferenceMetrics, generators, forecastData } = store

  const PlantIcon = plantType ? PLANT_ICONS[plantType] : Zap
  const plantColor = plantType ? PLANT_COLORS[plantType] : "var(--accent-primary)"

  const generatorRecommendations = useMemo(() => {
    if (!forecastData || forecastData.length === 0 || !generators || generators.length === 0) return []

    const avgLoad = forecastData.reduce((sum, d) => sum + d.output_mw, 0) / forecastData.length

    return generators.map(gen => {
      // Logic: If average forecast output < generator.minTurndown% of total capacity -> recommend OFF
      const minLoadThreshold = (capacity * (gen.minTurndown / 100))
      const shouldBeOnline = avgLoad >= minLoadThreshold

      return {
        generator: gen,
        currentStatus: gen.isOnline,
        recommendedStatus: shouldBeOnline,
        reason: shouldBeOnline ? "Load sufficient for operation" : "Load below min turndown",
        loadPercent: (avgLoad / capacity) * 100
      }
    })
  }, [forecastData, generators, capacity])

  const totalOnlineCapacity = generators?.filter(g => g.isOnline).reduce((sum, g) => sum + g.capacity, 0) || 0
  const totalRecommendedCapacity = generatorRecommendations.filter(r => r.recommendedStatus).reduce((sum, r) => sum + r.generator.capacity, 0)

  // Maintenance Windows Detection (4-hour+ low-load periods)
  interface MaintenanceWindow {
    startTime: string
    endTime: string
    duration: number // hours
    avgLoad: number // MW
    loadPercent: number // % of capacity
  }

  const maintenanceWindows = useMemo((): MaintenanceWindow[] => {
    if (!forecastData || forecastData.length === 0 || !capacity) return []

    const windows: MaintenanceWindow[] = []
    const lowLoadThreshold = capacity * 0.3 // 30% of capacity = low load
    const minWindowDuration = 16 // 16 intervals = 4 hours (15-min intervals)

    let windowStart: number | null = null
    let windowSum = 0

    for (let i = 0; i < forecastData.length; i++) {
      const point = forecastData[i]
      const isLowLoad = point.output_mw < lowLoadThreshold

      if (isLowLoad) {
        if (windowStart === null) {
          windowStart = i
          windowSum = point.output_mw
        } else {
          windowSum += point.output_mw
        }
      } else {
        // Check if we have a valid window
        if (windowStart !== null) {
          const windowLength = i - windowStart
          if (windowLength >= minWindowDuration) {
            const startPoint = forecastData[windowStart]
            const endPoint = forecastData[i - 1]
            const avgLoad = windowSum / windowLength
            
            windows.push({
              startTime: startPoint.timestamp,
              endTime: endPoint.timestamp,
              duration: windowLength / 4, // Convert to hours
              avgLoad: Math.round(avgLoad),
              loadPercent: Math.round((avgLoad / capacity) * 100)
            })
          }
        }
        windowStart = null
        windowSum = 0
      }
    }

    // Check for window at end of data
    if (windowStart !== null) {
      const windowLength = forecastData.length - windowStart
      if (windowLength >= minWindowDuration) {
        const startPoint = forecastData[windowStart]
        const endPoint = forecastData[forecastData.length - 1]
        const avgLoad = windowSum / windowLength
        
        windows.push({
          startTime: startPoint.timestamp,
          endTime: endPoint.timestamp,
          duration: windowLength / 4,
          avgLoad: Math.round(avgLoad),
          loadPercent: Math.round((avgLoad / capacity) * 100)
        })
      }
    }

    // Return top 5 windows sorted by duration (longest first)
    return windows.sort((a, b) => b.duration - a.duration).slice(0, 5)
  }, [forecastData, capacity])

  // Format timestamp for display
  const formatWindowTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + 
             ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return timestamp
    }
  }

  const plantSuggestions = useMemo(() => {
    if (!plantType) return []
    return PLANT_SUGGESTIONS.filter(s => 
      s.plantTypes.includes(plantType) && !appliedIds.has(s.id) && !dismissedIds.has(s.id)
    )
  }, [plantType, appliedIds, dismissedIds])

  const handleApply = (id: string) => {
    setAppliedIds(prev => new Set([...prev, id]))
    toast.success("Optimization applied!")
  }

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]))
  }

  if (!hydrated) {
    return <div className="h-[80vh] flex items-center justify-center text-[var(--text-muted)]">Loading...</div>
  }

  if (!forecastInitialized || !plantType) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Active Session</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">Configure a plant in Dashboard to get optimization recommendations.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${plantColor}20` }}>
            <PlantIcon className="w-6 h-6" style={{ color: plantColor }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Optimizations</h2>
            <p className="text-xs text-[var(--text-muted)]">{plantName} - {plantType?.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-[var(--accent-success)]" />
            <span className="font-semibold">CHF 28K</span>
            <span className="text-[var(--text-muted)]">potential/mo</span>
          </div>
          <div className="flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-[var(--accent-warning)]" />
            <span className="font-semibold">{plantSuggestions.length}</span>
            <span className="text-[var(--text-muted)]">suggestions</span>
          </div>
        </div>
      </div>

      {/* Generator Dispatch Table */}
      <NeuCard variant="flat" padding="sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[var(--accent-warning)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Generator Dispatch</h3>
          </div>
          
          {generators && generators.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] border-b border-[var(--border-primary)]">
                      <th className="text-left pb-2 font-medium">Generator</th>
                      <th className="text-right pb-2 font-medium">Capacity</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                      <th className="text-center pb-2 font-medium">Rec.</th>
                      <th className="text-left pb-2 pl-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-primary)]">
                    {generatorRecommendations.map((rec) => (
                      <tr key={rec.generator.id} className="group">
                        <td className="py-2 font-medium text-[var(--text-primary)]">{rec.generator.name}</td>
                        <td className="py-2 text-right text-[var(--text-muted)]">{rec.generator.capacity} MW</td>
                        <td className="py-2 text-center">
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                            rec.currentStatus 
                              ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" 
                              : "bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                          }`}>
                            <Power className="w-3 h-3" />
                            <span>{rec.currentStatus ? "ON" : "OFF"}</span>
                          </div>
                        </td>
                        <td className="py-2 text-center">
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-colors duration-300 ${
                            rec.recommendedStatus 
                              ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]" 
                              : "bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              rec.recommendedStatus ? "bg-[var(--accent-success)]" : "bg-[var(--accent-danger)]"
                            }`} />
                            <span>{rec.recommendedStatus ? "ON" : "OFF"}</span>
                          </div>
                        </td>
                        <td className="py-2 pl-2 text-[var(--text-muted)] truncate max-w-[150px]">{rec.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex items-center justify-between pt-2 text-xs border-t border-[var(--border-primary)]">
                <div className="text-[var(--text-muted)]">
                  Online: <span className="font-medium text-[var(--text-primary)]">{totalOnlineCapacity} MW</span> / {capacity} MW total
                </div>
                <div className="text-[var(--text-muted)]">
                  Recommended: <span className="font-medium text-[var(--text-primary)]">{totalRecommendedCapacity} MW</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-xs text-[var(--text-muted)]">
              Configure generators in Dashboard to see dispatch recommendations
            </div>
          )}
        </div>
      </NeuCard>

      {/* Maintenance Windows */}
      <NeuCard variant="flat" padding="sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Maintenance Windows</h3>
            </div>
            <span className="text-xs text-[var(--text-muted)]">4h+ low-load periods</span>
          </div>
          
          {maintenanceWindows.length > 0 ? (
            <div className="space-y-2">
              {maintenanceWindows.map((window, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--background-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)]">
                        {formatWindowTime(window.startTime)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        to {formatWindowTime(window.endTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="font-semibold text-[var(--text-primary)]">{window.duration}h</p>
                      <p className="text-[10px] text-[var(--text-muted)]">duration</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-[var(--accent-success)]">{window.loadPercent}%</p>
                      <p className="text-[10px] text-[var(--text-muted)]">avg load</p>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-[var(--text-muted)] text-center pt-1">
                Ideal windows for scheduled maintenance without impacting generation
              </p>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-[var(--text-muted)]">
              No low-load maintenance windows detected in current forecast
            </div>
          )}
        </div>
      </NeuCard>

      {/* Suggestions List - Compact */}
      {plantSuggestions.length === 0 ? (
        <NeuCard variant="flat" padding="lg">
          <div className="text-center py-8">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-[var(--accent-success)]" />
            <p className="font-semibold text-[var(--text-primary)]">All caught up!</p>
            <p className="text-xs text-[var(--text-muted)]">No pending recommendations</p>
          </div>
        </NeuCard>
      ) : (
        <div className="space-y-2">
          {plantSuggestions.map((s) => (
            <NeuCard key={s.id} variant="flat" padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div 
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PRIORITY_COLORS[s.priority] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-[var(--text-primary)] truncate">{s.title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{s.description}</p>
                  </div>
                  <div className="text-xs text-[var(--accent-success)] font-medium whitespace-nowrap">{s.impact}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <NeuButton variant="primary" size="sm" onClick={() => handleApply(s.id)}>
                    Apply
                  </NeuButton>
                  <button onClick={() => handleDismiss(s.id)} className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)]">
                    <X className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>
            </NeuCard>
          ))}
        </div>
      )}

      {/* Applied Count */}
      {appliedIds.size > 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <CheckCircle className="w-3.5 h-3.5 text-[var(--accent-success)]" />
          <span>{appliedIds.size} optimization{appliedIds.size > 1 ? 's' : ''} applied</span>
        </div>
      )}
    </div>
  )
}
