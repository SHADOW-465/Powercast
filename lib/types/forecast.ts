import type { PlantType } from "./plant"

export interface Forecast {
  plant_id: string
  plant_type: PlantType
  timestamps: string[]
  point_forecast: number[]
  q10: number[]
  q50: number[]
  q90: number[]
  metadata: ForecastMetadata
}

export interface ForecastMetadata {
  model_type: string
  horizon_steps: number
  coverage: number
  generated_at: string
  mape?: number
  inference_time_ms?: number
}

export interface ForecastDataPoint {
  timestamp: string
  value: number
  q10: number
  q50: number
  q90: number
}

export type TimeUnit = "min" | "hour" | "day" | "week" | "month"

export interface TimelineValue {
  unit: TimeUnit
  count: number
}

export const TIME_UNIT_MS: Record<TimeUnit, number> = {
  min: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}
