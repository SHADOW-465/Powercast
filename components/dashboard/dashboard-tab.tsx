"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { NeuCard, NeuCardHeader, NeuCardTitle, NeuCardContent } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import {
  Zap,
  TrendingUp,
  Activity,
  Sun,
  Droplets,
  Atom,
  Flame,
  Wind,
  Upload,
  FileCheck,
  X,
  AlertCircle,
  Rocket,
  Sparkles,
  RefreshCw,
  Plus,
  MapPin
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlantType, Generator } from "@/lib/types/plant"
import { parseCSV, validateCSV, getDataSummary, type CSVParseResult } from "@/lib/utils/csv-parser"
import {
  usePlantSessionStore,
  generateForecastFromCSV,
  calculateInferenceMetrics,
  type PlantLocation
} from "@/lib/store/plant-session-store"
import { ScadaConnector } from "@/components/settings/scada-connector"
import { AddUnitModal } from "@/components/generators/add-unit-modal"
import { GeneratorCard } from "@/components/generators/generator-card"
import { useModelStore, isKnownRegion, getTimezoneForRegion } from "@/lib/store/model-store"
import { UploadFeedbackPanel } from "@/components/data/upload-feedback-panel"
import { DataQualityIndicator } from "@/components/data/data-quality-indicator"
import { SystemIntelligenceStatus } from "@/components/dashboard/system-intelligence-status"

interface DashboardTabProps {
  onNavigateToForecasts: () => void
}

const PRESET_LOCATIONS = [
  { name: "Mumbai, India", lat: 19.076, lon: 72.8777 },
  { name: "Delhi, India", lat: 28.6139, lon: 77.209 },
  { name: "Chennai, India", lat: 13.0827, lon: 80.2707 },
  { name: "Zurich, Switzerland", lat: 47.3769, lon: 8.5417 },
  { name: "Geneva, Switzerland", lat: 46.2044, lon: 6.1432 },
  { name: "Custom", lat: 0, lon: 0 },
]

// Plant type configuration
const PLANT_TYPES: { type: PlantType; label: string; icon: typeof Sun }[] = [
  { type: "solar", label: "Solar", icon: Sun },
  { type: "wind", label: "Wind", icon: Wind },
  { type: "hydro", label: "Hydro", icon: Droplets },
  { type: "thermal", label: "Thermal", icon: Flame },
  { type: "nuclear", label: "Nuclear", icon: Atom },
]

export function DashboardTab({ onNavigateToForecasts }: DashboardTabProps) {
  const [plantName, setPlantName] = useState("")
  const [plantType, setPlantType] = useState<PlantType>("solar")
  const [capacity, setCapacity] = useState<number>(500)
  const [latitude, setLatitude] = useState<number>(19.076)
  const [longitude, setLongitude] = useState<number>(72.8777)
  const [locationName, setLocationName] = useState("Mumbai, India")
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [isInitializing, setIsInitializing] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Modal state for Add/Edit Unit
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false)
  const [editingGenerator, setEditingGenerator] = useState<Generator | null>(null)

  const store = usePlantSessionStore()

  useEffect(() => {
    usePlantSessionStore.persist.rehydrate()
    setHydrated(true)
  }, [])

  const {
    forecastInitialized,
    setPlantConfig,
    uploadCSV,
    initializeForecast,
    clearSession,
    setLocation,
    plantType: storedPlantType,
    plantName: storedPlantName,
    capacity: storedCapacity,
    inferenceMetrics,
    generators,
    addGenerator,
    removeGenerator,
    updateGenerator,
    getTotalGeneratorCapacity
  } = store

  const kpiData = useMemo(() => {
    if (forecastInitialized && inferenceMetrics) {
      return [
        { label: "Peak Output", value: inferenceMetrics.peakOutput.toLocaleString(), unit: "MW", icon: Zap },
        { label: "Avg Efficiency", value: inferenceMetrics.avgEfficiency.toFixed(1), unit: "%", icon: Activity },
        { label: "Accuracy", value: inferenceMetrics.modelAccuracy.toFixed(1), unit: "%", icon: TrendingUp },
        { label: "Total Energy", value: (inferenceMetrics.totalEnergy / 1000).toFixed(1), unit: "GWh", icon: Sparkles },
      ]
    }
    return [
      { label: "Peak Output", value: "—", unit: "", icon: Zap },
      { label: "Efficiency", value: "—", unit: "", icon: Activity },
      { label: "Accuracy", value: "97.2", unit: "%", icon: TrendingUp },
      { label: "Status", value: "Ready", unit: "", icon: Sparkles },
    ]
  }, [forecastInitialized, inferenceMetrics])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(e.type === "dragenter" || e.type === "dragover")
  }, [])

  // Model store for region detection
  const {
    setActiveRegion,
    setModelStatus,
    setDataQuality,
    setUploadFeedback,
    detectRegionFromCode,
    clearModelState
  } = useModelStore()

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setValidationErrors([])
    setValidationWarnings([])
    if (!plantName) setPlantName(selectedFile.name.replace(".csv", "").replace(/_/g, " "))
    const result = await parseCSV(selectedFile)
    setParseResult(result)

    // Use selected plant type for validation
    const validation = validateCSV(result, plantType)
    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)

    // Region detection from CSV (Smart Traffic Controller)
    if (result.data.length > 0 && result.columns.includes('region_code')) {
      const regionCode = result.data[0].region_code as string
      const isNew = !isKnownRegion(regionCode)
      const timezone = getTimezoneForRegion(regionCode)

      // Set model status
      setModelStatus(isNew ? 'not_found' : 'loading')

      // Detect and set region
      const regionInfo = detectRegionFromCode(regionCode)
      setActiveRegion(regionInfo)

      // Set upload feedback (UI display)
      setUploadFeedback({
        detectedRegionCode: regionCode,
        mappedTimezone: timezone,
        pipelineSelected: isNew ? 'training' : 'forecast',
        isNewRegion: isNew
      })

      // Evaluate data quality
      const totalCells = result.data.length * result.columns.length
      const missingCells = result.data.reduce((acc, row) => {
        return acc + Object.values(row).filter(v => v === null || v === undefined || v === '').length
      }, 0)
      const completeness = ((totalCells - missingCells) / totalCells) * 100

      setDataQuality({
        status: completeness >= 99 ? 'clean' : completeness >= 95 ? 'minor_gaps_fixed' : 'major_gaps_detected',
        completeness,
        missingValues: {},
        irregularIntervals: 0,
        message: ''
      })
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.name.endsWith(".csv")) await processFile(droppedFile)
    else setValidationErrors(["Please upload a CSV file"])
  }, [plantType, plantName])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile?.name.endsWith(".csv")) await processFile(selectedFile)
    else if (selectedFile) setValidationErrors(["Please upload a CSV file"])
  }

  const clearFile = () => {
    setFile(null)
    setParseResult(null)
    setValidationErrors([])
    setValidationWarnings([])
  }

  const handleInitializeForecast = async () => {
    if (!file || !parseResult || validationErrors.length > 0 || !plantName.trim()) return
    setIsInitializing(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // Use selected plant type from state
      setPlantConfig(plantType, plantName, capacity)
      setLocation({ latitude, longitude, name: locationName })
      uploadCSV(parseResult.data, file.name)
      // Generate forecast for max horizon (12 weeks = 2016 hours)
      const forecastData = generateForecastFromCSV(parseResult.data, 2016)
      const metrics = calculateInferenceMetrics(forecastData, capacity)
      initializeForecast(forecastData, metrics)
      onNavigateToForecasts()
    } catch (error) {
      console.error("Failed to initialize forecast:", error)
      setValidationErrors(["Failed to initialize forecast. Please try again."])
    } finally {
      setIsInitializing(false)
    }
  }

  const handleClearSession = () => {
    clearSession()
    setFile(null)
    setParseResult(null)
    setPlantName("")
    setCapacity(500)
    setValidationErrors([])
    setValidationWarnings([])
  }

  // Add/Edit generator handlers
  const handleAddGenerator = (generator: Generator) => {
    if (editingGenerator) {
      updateGenerator(generator.id, generator)
    } else {
      addGenerator(generator)
    }
    setEditingGenerator(null)
  }

  const handleEditGenerator = (generator: Generator) => {
    setEditingGenerator(generator)
    setIsAddUnitModalOpen(true)
  }

  const handleToggleOnline = (id: string) => {
    const gen = generators.find(g => g.id === id)
    if (gen) {
      updateGenerator(id, { isOnline: !gen.isOnline })
    }
  }

  // Capacity calculations
  const totalGeneratorCapacity = getTotalGeneratorCapacity()
  const capacityDifference = totalGeneratorCapacity - capacity
  const isOverCapacity = capacityDifference > 0
  const capacityPercentage = capacity > 0 ? Math.min((totalGeneratorCapacity / capacity) * 100, 100) : 0

  const summary = parseResult ? getDataSummary(parseResult.data) : null
  const isReadyToInitialize = file && parseResult && validationErrors.length === 0 && plantName.trim() && capacity > 0

  if (!hydrated) {
    return <div className="h-[80vh] flex items-center justify-center text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {forecastInitialized ? "Session Active" : "Powercast Command Center"}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {forecastInitialized
              ? `${storedPlantName} (${storedPlantType?.toUpperCase()}) - ${storedCapacity} MW`
              : "Configure plant and upload data to generate forecasts"
            }
          </p>
        </div>
        {forecastInitialized && (
          <NeuButton variant="ghost" size="sm" onClick={handleClearSession}>
            <RefreshCw className="w-4 h-4 mr-1" /> New Session
          </NeuButton>
        )}
      </div>

      {/* KPI Row - Compact */}
      <div className="grid grid-cols-4 gap-2">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon
          return (
            <NeuCard key={kpi.label} variant="flat" padding="sm">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[var(--accent-primary)]" />
                <div>
                  <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{kpi.value}<span className="text-xs font-normal ml-0.5">{kpi.unit}</span></p>
                </div>
              </div>
            </NeuCard>
          )
        })}
      </div>

      {/* Config + Upload in single row */}
      {!forecastInitialized && (
        <div className="grid grid-cols-2 gap-3">
          {/* Plant Configuration - Redesigned */}
          <NeuCard variant="raised" padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="font-semibold text-sm text-[var(--text-primary)]">Configure Plant</span>
            </div>

            {/* Name + Capacity inline */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input
                type="text"
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
                placeholder="Plant name"
                className="px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] bg-transparent focus:outline-none"
              />
              <div className="relative">
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">MW</span>
              </div>
            </div>

            {/* Plant Type Selector */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Zap className="w-3.5 h-3.5" />
                <span>Plant Type</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PLANT_TYPES.map(({ type, label, icon: Icon }) => {
                  const isSelected = plantType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setPlantType(type)}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                        isSelected
                          ? "neu-raised scale-[1.02] ring-2 ring-offset-1 ring-offset-[var(--bg-card)]"
                          : "neu-flat text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-[1.01]"
                      )}
                      style={isSelected ? {
                        background: `linear-gradient(135deg, var(--plant-${type})15, var(--plant-${type})08)`,
                        // @ts-ignore - CSS custom property for ring color
                        '--tw-ring-color': `var(--plant-${type})`
                      } as React.CSSProperties : undefined}
                    >
                      {/* Selection indicator dot */}
                      {isSelected && (
                        <span
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--bg-card)] flex items-center justify-center"
                          style={{ backgroundColor: `var(--plant-${type})` }}
                        >
                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                      <Icon
                        className={cn(
                          "w-4 h-4 transition-all",
                          isSelected ? "drop-shadow-sm" : ""
                        )}
                        style={isSelected ? { color: `var(--plant-${type})` } : undefined}
                      />
                      <span className={isSelected ? "text-[var(--text-primary)]" : ""}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Location Configuration */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <MapPin className="w-3.5 h-3.5" />
                <span>Location</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={PRESET_LOCATIONS.find(p => p.name === locationName)?.name || "Custom"}
                  onChange={(e) => {
                    const preset = PRESET_LOCATIONS.find(p => p.name === e.target.value)
                    if (preset) {
                      setLocationName(preset.name)
                      if (preset.name !== "Custom") {
                        setLatitude(preset.lat)
                        setLongitude(preset.lon)
                      }
                    }
                  }}
                  className="px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none appearance-none"
                >
                  {PRESET_LOCATIONS.map(p => (
                    <option key={p.name} value={p.name} className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                      {p.name}
                    </option>
                  ))}
                </select>
                {locationName === "Custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      placeholder="Lat"
                      className="px-2 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                    />
                    <input
                      type="number"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      placeholder="Lon"
                      className="px-2 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-muted)] bg-transparent flex items-center justify-between">
                    <span>{latitude.toFixed(2)}, {longitude.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Generator Fleet Section - Action-First Redesign */}
            <div className="pt-4 border-t border-[var(--border-default)]">
              {/* Header with Add Button at TOP */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span className="font-semibold text-sm text-[var(--text-primary)]">Generator Fleet</span>
                  <span className="text-xs text-[var(--text-muted)]">({generators.length}/10)</span>
                </div>
                <NeuButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setEditingGenerator(null)
                    setIsAddUnitModalOpen(true)
                  }}
                  disabled={generators.length >= 10}
                  className="!py-1.5 !px-3"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Unit
                </NeuButton>
              </div>

              {/* Generator Cards List */}
              {generators.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {generators.map((gen) => (
                    <GeneratorCard
                      key={gen.id}
                      generator={gen}
                      onEdit={handleEditGenerator}
                      onDelete={removeGenerator}
                      onToggleOnline={handleToggleOnline}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-[var(--text-muted)] neu-inset rounded-xl mb-3">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No units configured yet</p>
                  <p className="text-xs mt-1">Click "Add Unit" to get started</p>
                </div>
              )}

              {/* Subtle Capacity Progress - Only show if generators exist */}
              {generators.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      Total: {totalGeneratorCapacity} MW
                    </span>
                    {isOverCapacity && (
                      <span className="text-[var(--accent-warning)]">
                        {capacityDifference} MW over target
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        isOverCapacity
                          ? "bg-[var(--accent-warning)]"
                          : "bg-[var(--accent-primary)]"
                      )}
                      style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </NeuCard>

          {/* CSV Upload - Compact */}
          <NeuCard variant="raised" padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="font-semibold text-sm text-[var(--text-primary)]">Upload Data</span>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer",
                isDragging ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5" : "border-[var(--border-default)]"
              )}
            >
              <input type="file" accept=".csv" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileCheck className="w-5 h-5 text-[var(--accent-primary)]" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{file.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{parseResult?.rowCount} rows</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); clearFile() }} className="p-1 neu-flat rounded-lg">
                    <X className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-6 h-6 mx-auto mb-1 text-[var(--text-muted)]" />
                  <p className="text-xs text-[var(--text-muted)]">Drop CSV or click to browse</p>
                </div>
              )}
            </div>

            {validationErrors.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-[var(--accent-danger)]/10 text-xs">
                {validationErrors.map((e, i) => (
                  <div key={i} className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-[var(--accent-danger)]" />{e}</div>
                ))}
              </div>
            )}

            {summary && summary.rowCount > 0 && validationErrors.length === 0 && (
              <div className="mt-2 text-xs text-[var(--text-muted)] grid grid-cols-2 gap-1">
                <span>Avg: {summary.avgOutput.toFixed(0)} MW</span>
                <span>Max: {summary.maxOutput.toFixed(0)} MW</span>
              </div>
            )}
          </NeuCard>

          {/* Upload Feedback Panel - Smart Traffic Controller */}
          <UploadFeedbackPanel className="col-span-2" />

          {/* Data Quality Indicator */}
          <DataQualityIndicator className="col-span-2" showDetails />
        </div>
      )}

      {/* System Intelligence Status - Always visible when forecast initialized */}
      {forecastInitialized && (
        <SystemIntelligenceStatus className="mb-3" />
      )}

      {/* Initialize Button */}
      {!forecastInitialized && (
        <NeuButton
          variant="primary"
          size="md"
          onClick={handleInitializeForecast}
          loading={isInitializing}
          disabled={!isReadyToInitialize || isInitializing}
          className="w-full"
        >
          <Rocket className="w-4 h-4 mr-2" />
          Initialize Forecast
        </NeuButton>
      )}

      {/* Quick Actions when active */}
      {forecastInitialized && (
        <div className="grid grid-cols-2 gap-3">
          <NeuCard variant="raised" padding="md" className="cursor-pointer hover:scale-[1.01] transition-transform" onClick={onNavigateToForecasts}>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[var(--accent-primary)]" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">View Forecasts</p>
                <p className="text-xs text-[var(--text-muted)]">Predictions with confidence bands</p>
              </div>
            </div>
          </NeuCard>
          <NeuCard variant="raised" padding="md" className="cursor-pointer hover:scale-[1.01] transition-transform">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[var(--accent-warning)]" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">Optimizations</p>
                <p className="text-xs text-[var(--text-muted)]">Recommendations for {storedPlantType}</p>
              </div>
            </div>
          </NeuCard>
        </div>
      )}

      {/* SCADA Connector - Show when session is active */}
      {forecastInitialized && (
        <ScadaConnector />
      )}

      {/* Add Unit Modal */}
      <AddUnitModal
        isOpen={isAddUnitModalOpen}
        onClose={() => {
          setIsAddUnitModalOpen(false)
          setEditingGenerator(null)
        }}
        onAdd={handleAddGenerator}
        existingGenerators={generators}
        plantCapacity={capacity}
        editGenerator={editingGenerator}
      />
    </div>
  )
}
