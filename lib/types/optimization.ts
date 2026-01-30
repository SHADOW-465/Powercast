export interface OptimizationSuggestion {
  id: string
  type: "dispatch" | "maintenance" | "cost" | "efficiency"
  priority: "high" | "medium" | "low"
  title: string
  description: string
  impact: {
    metric: string
    value: string
    direction: "up" | "down"
  }
  affected_plants: string[]
  confidence: number
  created_at: string
  applied_at?: string
}

export interface OptimizationResult {
  suggestions: OptimizationSuggestion[]
  potential_savings: number
  potential_efficiency_gain: number
  co2_reduction_tons: number
  generated_at: string
}

export type OptimizationType = OptimizationSuggestion["type"]
export type OptimizationPriority = OptimizationSuggestion["priority"]
