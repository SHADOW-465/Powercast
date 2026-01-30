export type PlantType = "solar" | "hydro" | "nuclear" | "thermal" | "wind"

/**
 * Generator unit configuration for a power plant
 * Each plant can have 1-10 generator units (inverters, turbines, etc.)
 */
export interface Generator {
  id: string
  name: string
  capacity: number // MW
  minTurndown: number // percentage (0-100) - minimum operating level
  rampRate: number // MW/min - how fast the generator can change output
  isOnline: boolean
  unitType?: PlantType // Optional - selected during progressive add flow
}

/**
 * Default generator templates by plant type
 */
export const GENERATOR_DEFAULTS: Record<PlantType, Partial<Generator>> = {
  solar: { minTurndown: 0, rampRate: 50 }, // Solar can go to 0, fast ramp
  hydro: { minTurndown: 20, rampRate: 30 }, // Hydro needs min flow, moderate ramp
  nuclear: { minTurndown: 50, rampRate: 5 }, // Nuclear high min, slow ramp
  thermal: { minTurndown: 30, rampRate: 10 }, // Thermal moderate constraints
  wind: { minTurndown: 0, rampRate: 40 }, // Wind can go to 0, moderate ramp
}

/**
 * Generator name suggestions by plant type
 */
export const GENERATOR_NAME_TEMPLATES: Record<PlantType, string[]> = {
  solar: ["Inverter", "String", "Array", "Block"],
  hydro: ["Turbine", "Unit", "Generator"],
  nuclear: ["Reactor", "Unit", "Block"],
  thermal: ["Boiler", "Unit", "Turbine"],
  wind: ["Turbine", "Unit", "Tower"],
}

export interface Plant {
  id: string
  name: string
  type: PlantType
  capacity_mw: number
  current_output_mw: number
  status: "online" | "offline" | "maintenance"
  location?: string
  efficiency_pct?: number
  created_at: string
  updated_at: string
}

export interface PlantMetrics {
  plant_id: string
  timestamp: string
  output_mw: number
  efficiency_pct: number
  temperature_c?: number
  weather_condition?: string
}

export const PLANT_COLORS: Record<PlantType, { primary: string; background: string }> = {
  solar: { primary: "var(--plant-solar)", background: "var(--plant-solar-bg)" },
  hydro: { primary: "var(--plant-hydro)", background: "var(--plant-hydro-bg)" },
  nuclear: { primary: "var(--plant-nuclear)", background: "var(--plant-nuclear-bg)" },
  thermal: { primary: "var(--plant-thermal)", background: "var(--plant-thermal-bg)" },
  wind: { primary: "var(--plant-wind)", background: "var(--plant-wind-bg)" },
}

export const PLANT_LABELS: Record<PlantType, string> = {
  solar: "Solar",
  hydro: "Hydro",
  nuclear: "Nuclear",
  thermal: "Thermal",
  wind: "Wind",
}
