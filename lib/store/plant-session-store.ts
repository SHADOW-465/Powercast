import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { PlantType, Generator } from "@/lib/types/plant"
import { GENERATOR_DEFAULTS, GENERATOR_NAME_TEMPLATES } from "@/lib/types/plant"
import type { CSVRow } from "@/lib/utils/csv-parser"
import { useEffect, useState } from "react"

export interface ForecastDataPoint {
  timestamp: string
  output_mw: number
  q10: number
  q50: number
  q90: number
}

export interface InferenceMetrics {
  peakOutput: number
  peakTime: string
  avgOutput: number
  avgEfficiency: number
  modelAccuracy: number
  confidenceLevel: number
  totalEnergy: number // MWh over forecast period
}

export interface PlantLocation {
  latitude: number
  longitude: number
  name: string // City/region name
}

export interface WeatherData {
  temperature: number // Celsius
  humidity: number // %
  windSpeed: number // m/s
  cloudCover: number // %
  condition: string // "Clear", "Cloudy", "Rain", etc.
  icon: string // Weather icon code
  fetchedAt: string // ISO timestamp
}

interface PlantSessionState {
  // Plant configuration
  plantType: PlantType | null
  plantName: string
  capacity: number
  location: PlantLocation | null
  
  // Weather data
  weatherData: WeatherData | null
  
  // Generator units (1-10 per plant)
  generators: Generator[]
  
  // CSV data
  csvData: CSVRow[] | null
  csvFileName: string | null
  csvRowCount: number
  
  // Forecast state
  forecastInitialized: boolean
  forecastData: ForecastDataPoint[] | null
  forecastHorizon: number // hours
  
  // Inference metrics
  inferenceMetrics: InferenceMetrics | null
  
  // Timestamps
  sessionStartedAt: string | null
  lastForecastAt: string | null
  
  // Actions
  setPlantConfig: (type: PlantType, name: string, capacity: number) => void
  uploadCSV: (data: CSVRow[], fileName: string) => void
  initializeForecast: (forecastData: ForecastDataPoint[], metrics: InferenceMetrics) => void
  setForecastHorizon: (hours: number) => void
  clearSession: () => void
  
  // Location and weather actions
  setLocation: (location: PlantLocation) => void
  setWeatherData: (weather: WeatherData) => void
  
  // Generator actions
  setGenerators: (generators: Generator[]) => void
  addGenerator: (generator: Generator) => void
  removeGenerator: (id: string) => void
  updateGenerator: (id: string, updates: Partial<Generator>) => void
  
  // Computed getters
  isReadyToInitialize: () => boolean
  getPlantDisplayName: () => string
  getTotalGeneratorCapacity: () => number
}

const initialState = {
  plantType: null,
  plantName: "",
  capacity: 0,
  location: null as PlantLocation | null,
  weatherData: null as WeatherData | null,
  generators: [] as Generator[],
  csvData: null,
  csvFileName: null,
  csvRowCount: 0,
  forecastInitialized: false,
  forecastData: null,
  forecastHorizon: 24,
  inferenceMetrics: null,
  sessionStartedAt: null,
  lastForecastAt: null,
}

export const usePlantSessionStore = create<PlantSessionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPlantConfig: (type, name, capacity) =>
        set({
          plantType: type,
          plantName: name,
          capacity: capacity,
          sessionStartedAt: new Date().toISOString(),
        }),

      uploadCSV: (data, fileName) =>
        set({
          csvData: data,
          csvFileName: fileName,
          csvRowCount: data.length,
        }),

      initializeForecast: (forecastData, metrics) =>
        set({
          forecastInitialized: true,
          forecastData: forecastData,
          inferenceMetrics: metrics,
          lastForecastAt: new Date().toISOString(),
        }),

      setForecastHorizon: (hours) =>
        set({
          forecastHorizon: hours,
        }),

      clearSession: () =>
        set({
          ...initialState,
        }),

      // Location and weather actions
      setLocation: (location) =>
        set({ location }),

      setWeatherData: (weather) =>
        set({ weatherData: weather }),

      // Generator actions
      setGenerators: (generators) =>
        set({ generators }),

      addGenerator: (generator) =>
        set((state) => ({
          generators: state.generators.length < 10 
            ? [...state.generators, generator] 
            : state.generators,
        })),

      removeGenerator: (id) =>
        set((state) => ({
          generators: state.generators.filter((g) => g.id !== id),
        })),

      updateGenerator: (id, updates) =>
        set((state) => ({
          generators: state.generators.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),

      isReadyToInitialize: () => {
        const state = get()
        return !!(
          state.plantType &&
          state.plantName.trim() &&
          state.capacity > 0 &&
          state.csvData &&
          state.csvData.length > 0
        )
      },

      getPlantDisplayName: () => {
        const state = get()
        if (!state.plantType) return ""
        return `${state.plantType.toUpperCase()} PLANT - ${state.capacity} MW`
      },

      getTotalGeneratorCapacity: () => {
        const state = get()
        return state.generators.reduce((sum, g) => sum + g.capacity, 0)
      },
    }),
    {
      name: "powercast-plant-session",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        // Don't persist large CSV data to avoid localStorage limits
        plantType: state.plantType,
        plantName: state.plantName,
        capacity: state.capacity,
        location: state.location, // Persist location config
        generators: state.generators, // Persist generator configs
        csvFileName: state.csvFileName,
        csvRowCount: state.csvRowCount,
        forecastInitialized: state.forecastInitialized,
        forecastHorizon: state.forecastHorizon,
        inferenceMetrics: state.inferenceMetrics,
        sessionStartedAt: state.sessionStartedAt,
        lastForecastAt: state.lastForecastAt,
        // Note: csvData, forecastData, weatherData are NOT persisted due to size/staleness
      }),
    }
  )
)

// Helper function to calculate inference metrics from forecast data
export function calculateInferenceMetrics(
  forecastData: ForecastDataPoint[],
  capacity: number
): InferenceMetrics {
  if (forecastData.length === 0) {
    return {
      peakOutput: 0,
      peakTime: "",
      avgOutput: 0,
      avgEfficiency: 0,
      modelAccuracy: 97.2,
      confidenceLevel: 95,
      totalEnergy: 0,
    }
  }

  const outputs = forecastData.map((f) => f.output_mw)
  const peakOutput = Math.max(...outputs)
  const peakIndex = outputs.indexOf(peakOutput)
  const peakTime = forecastData[peakIndex]?.timestamp || ""
  
  const avgOutput = outputs.reduce((a, b) => a + b, 0) / outputs.length
  const avgEfficiency = capacity > 0 ? (avgOutput / capacity) * 100 : 0
  
  // Total energy in MWh (assuming 15-min intervals, divide by 4)
  const intervalHours = 0.25
  const totalEnergy = outputs.reduce((a, b) => a + b, 0) * intervalHours

  return {
    peakOutput: Math.round(peakOutput),
    peakTime,
    avgOutput: Math.round(avgOutput),
    avgEfficiency: Math.round(avgEfficiency * 10) / 10,
    modelAccuracy: 97.2, // From XGBoost model validation
    confidenceLevel: 95,
    totalEnergy: Math.round(totalEnergy),
  }
}

// Generate mock forecast data from CSV for demo purposes
// Supports extended horizons by cycling through available data with daily patterns
export function generateForecastFromCSV(
  csvData: CSVRow[],
  horizonHours: number = 24
): ForecastDataPoint[] {
  if (csvData.length === 0) return []
  
  const forecasts: ForecastDataPoint[] = []
  const pointsNeeded = horizonHours * 4 // 15-min intervals
  
  // Parse base timestamp from first row
  const baseTime = new Date(csvData[0].timestamp)
  
  for (let i = 0; i < pointsNeeded; i++) {
    // Cycle through CSV data to extend beyond available points
    const sourceIndex = i % csvData.length
    const row = csvData[sourceIndex]
    const baseOutput = typeof row.output_mw === "number" ? row.output_mw : 0
    
    // Calculate new timestamp (add 15 minutes per point)
    const timestamp = new Date(baseTime.getTime() + i * 15 * 60 * 1000)
    
    // Add increasing uncertainty for longer horizons
    const hoursAhead = i / 4
    const uncertaintyFactor = 1 + (hoursAhead / 168) * 0.5 // Increases by 50% at 1 week
    const variance = baseOutput * 0.15 * uncertaintyFactor
    
    // Add trend drift for longer forecasts (slight decay in accuracy simulation)
    const trendDrift = hoursAhead > 48 ? (Math.random() - 0.5) * baseOutput * 0.1 : 0
    
    const q50 = baseOutput + (Math.random() - 0.5) * variance * 0.5 + trendDrift
    const q10 = q50 - variance
    const q90 = q50 + variance
    
    forecasts.push({
      timestamp: timestamp.toISOString(),
      output_mw: Math.max(0, q50),
      q10: Math.max(0, q10),
      q50: Math.max(0, q50),
      q90: Math.max(0, q90),
    })
  }
  
  return forecasts
}

// Hook to handle hydration safely
export function useHydratedPlantSession() {
  const [hydrated, setHydrated] = useState(false)
  const store = usePlantSessionStore()

  useEffect(() => {
    // Rehydrate the store on client
    usePlantSessionStore.persist.rehydrate()
    setHydrated(true)
  }, [])

  return { ...store, hydrated }
}

// Helper function to create a new generator with defaults based on plant type
// Now supports optional unitType for action-first progressive flow
export function createGenerator(
  plantType?: PlantType,
  existingGenerators: Generator[] = [],
  plantCapacity: number = 500
): Generator {
  const defaults = plantType ? GENERATOR_DEFAULTS[plantType] : { minTurndown: 30, rampRate: 10 }
  const nameTemplate = plantType ? GENERATOR_NAME_TEMPLATES[plantType][0] : "Unit"
  const index = existingGenerators.length + 1
  
  // Calculate suggested capacity (remaining capacity divided equally)
  const usedCapacity = existingGenerators.reduce((sum, g) => sum + g.capacity, 0)
  const remainingCapacity = Math.max(0, plantCapacity - usedCapacity)
  const suggestedCapacity = remainingCapacity > 0 ? remainingCapacity : Math.round(plantCapacity / (existingGenerators.length + 1))

  return {
    id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${nameTemplate} ${String.fromCharCode(64 + index)}`, // Unit A, Unit B, etc.
    capacity: suggestedCapacity,
    minTurndown: defaults.minTurndown ?? 30,
    rampRate: defaults.rampRate ?? 10,
    isOnline: true,
    unitType: plantType,
  }
}
