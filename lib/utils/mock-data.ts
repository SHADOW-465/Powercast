import type { PlantType } from "@/lib/types/plant"

export interface ForecastDataPoint {
  timestamp: string
  time: string // formatted time for display
  value: number
  q10: number
  q50: number
  q90: number
  plantType?: PlantType
}

// Generate mock forecast data with confidence bands
export function generateMockForecastData(
  hours: number = 24,
  baseValue: number = 500,
  volatility: number = 0.15
): ForecastDataPoint[] {
  const data: ForecastDataPoint[] = []
  const now = new Date()
  
  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now.getTime() + i * 60 * 60 * 1000)
    
    // Simulate daily pattern (higher during day, lower at night)
    const hour = timestamp.getHours()
    const dailyFactor = 0.7 + 0.3 * Math.sin((hour - 6) * Math.PI / 12)
    
    // Add some random walk
    const noise = (Math.random() - 0.5) * volatility * baseValue
    const value = baseValue * dailyFactor + noise
    
    // Confidence bands
    const uncertainty = baseValue * volatility * (0.5 + i * 0.02) // Grows with horizon
    
    data.push({
      timestamp: timestamp.toISOString(),
      time: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: Math.max(0, value),
      q10: Math.max(0, value - uncertainty * 1.28),
      q50: Math.max(0, value),
      q90: Math.max(0, value + uncertainty * 1.28),
    })
  }
  
  return data
}

// Generate multi-plant forecast data
export function generateMultiPlantForecast(hours: number = 24): Record<PlantType, ForecastDataPoint[]> {
  return {
    solar: generateMockForecastData(hours, 450, 0.25), // High volatility
    hydro: generateMockForecastData(hours, 620, 0.08), // Low volatility
    nuclear: generateMockForecastData(hours, 950, 0.02), // Very stable
    thermal: generateMockForecastData(hours, 280, 0.12),
    wind: generateMockForecastData(hours, 180, 0.35), // Very high volatility
  }
}

// Generate sparkline data (simplified for small charts)
export function generateSparklineData(points: number = 24): number[] {
  const data: number[] = []
  let value = 50 + Math.random() * 50
  
  for (let i = 0; i < points; i++) {
    value += (Math.random() - 0.5) * 20
    value = Math.max(10, Math.min(100, value))
    data.push(value)
  }
  
  return data
}

// Format power value
export function formatPower(mw: number): string {
  if (mw >= 1000) {
    return `${(mw / 1000).toFixed(1)} GW`
  }
  return `${Math.round(mw)} MW`
}

// Format percentage
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

// Format currency
export function formatCurrency(value: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
