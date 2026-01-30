export interface Plant {
  id: string
  name: string
  type: "hydro" | "nuclear" | "pv" | "thermal"
  capacity: number
  output: number
  minOutput: number
  maxOutput: number
  rampRate: number
  reservoirLevel?: number
  reservoirCapacity?: number
  location: string
}

export interface PortfolioData {
  plants: Plant[]
  totalLoad: number
  totalOutput: number
  timestamp: Date
  balancingPrice: number
}

export interface Forecast {
  timestamp: Date
  netLoad: { p10: number; p50: number; p90: number }
  pvGeneration: { p10: number; p50: number; p90: number }
  hydroFlexibility: number
  balancingNeeds: { up: number; down: number }
  confidence: "high" | "medium" | "low"
  risks: string[]
  recommendations: string[]
}

export interface DispatchSetpoint {
  plantId: string
  setpoint: number
  reason: string
}

export interface Scenario {
  name: string
  description: string
  impacts: {
    cost: number
    co2: number
    reserve: number
  }
  mitigations: string[]
}

export interface AppState {
  portfolio: PortfolioData | null
  forecast: Forecast | null
  setpoints: DispatchSetpoint[]
  carbonWeight: number
  portfolioFilter: "full" | "hydro-only" | "pv-only"
  timeRange: number
}
