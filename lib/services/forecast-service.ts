/**
 * Forecast Service
 * 
 * Utility functions for fetching forecasts from the backend API.
 */

import type { ForecastDataPoint } from "@/lib/store/plant-session-store"
import type { PlantType } from "@/lib/types/plant"

export interface ForecastResponse {
  forecast: ForecastDataPoint[]
  metadata: {
    model_type: string
    horizon_hours: number
    interval_minutes: number
    plant_type: string
    generated_at: string
    confidence: number
    source: string
    warning?: string
  }
}

/**
 * Fetch forecast from the backend API
 */
export async function fetchForecast(
  plantType: PlantType,
  capacity: number,
  horizon: number = 24,
  historicalData?: Array<{ timestamp: string; output_mw: number }>
): Promise<ForecastResponse> {
  const response = await fetch("/api/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plantType,
      capacity,
      horizon,
      historicalData,
    }),
  })

  if (!response.ok) {
    throw new Error(`Forecast API error: ${response.status}`)
  }

  const data = await response.json()

  // Transform backend response to match frontend types
  const forecast: ForecastDataPoint[] = data.forecast.map((point: {
    timestamp: string
    output_mw?: number
    point?: number
    q10: number
    q50: number
    q90: number
  }) => ({
    timestamp: point.timestamp,
    output_mw: point.output_mw ?? point.point ?? point.q50,
    q10: point.q10,
    q50: point.q50,
    q90: point.q90,
  }))

  return {
    forecast,
    metadata: data.metadata,
  }
}

/**
 * Check backend health status
 */
export async function checkBackendHealth(): Promise<{
  status: string
  backend: string
  capabilities: string[]
}> {
  try {
    const response = await fetch("/api/forecast")
    if (response.ok) {
      return await response.json()
    }
    return { status: "error", backend: "unavailable", capabilities: [] }
  } catch {
    return { status: "error", backend: "unavailable", capabilities: [] }
  }
}
