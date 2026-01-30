"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from "lucide-react"
import { analyzeScenario } from "@/lib/gemini"
import type { PortfolioData } from "@/lib/types"

interface ScenariosTabProps {
  portfolio: PortfolioData
}

const scenarioTemplates = [
  {
    id: "winter-scarcity",
    name: "Winter Scarcity",
    description: "Low hydro inflow, high load, limited imports",
  },
  {
    id: "pv-ramp",
    name: "PV Ramp Event",
    description: "Rapid cloud cover, -50% PV in 30 minutes",
  },
  {
    id: "plant-outage",
    name: "Plant Outage",
    description: "Unexpected shutdown of Beznau II (365 MW loss)",
  },
  {
    id: "market-spike",
    name: "Market Spike",
    description: "Balancing prices exceed 500 CHF/MWh",
  },
]

export function ScenariosTab({ portfolio }: ScenariosTabProps) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyzeScenario = async (scenarioId: string) => {
    setSelectedScenario(scenarioId)
    setLoading(true)
    try {
      const scenario = scenarioTemplates.find((s) => s.id === scenarioId)
      const result = await analyzeScenario(portfolio, scenario?.name || "", [])
      setScenarioResult(result)
    } catch (error) {
      console.error("Scenario error:", error)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenarioTemplates.map((scenario) => (
          <Card
            key={scenario.id}
            className={`p-4 cursor-pointer transition border-2 ${
              selectedScenario === scenario.id
                ? "border-primary bg-blue-50"
                : "border-border hover:border-primary bg-white"
            }`}
            onClick={() => setSelectedScenario(scenario.id)}
          >
            <h4 className="font-semibold text-foreground mb-1">{scenario.name}</h4>
            <p className="text-sm text-muted-foreground mb-3">{scenario.description}</p>
            <Button
              onClick={() => handleAnalyzeScenario(scenario.id)}
              disabled={loading && selectedScenario === scenario.id}
              size="sm"
              className="w-full"
            >
              {loading && selectedScenario === scenario.id ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze"
              )}
            </Button>
          </Card>
        ))}
      </div>

      {/* Scenario Results */}
      {scenarioResult && (
        <div className="space-y-4">
          <Card className="p-6 bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">Scenario: {scenarioResult.name}</h3>
                <p className="text-red-800 mb-4">{scenarioResult.description}</p>

                {/* Impact Metrics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-white rounded border border-red-200">
                    <p className="text-xs text-muted-foreground">Cost Impact</p>
                    <p className="text-2xl font-bold text-red-600">+{scenarioResult.impacts.cost} kCHF</p>
                  </div>
                  <div className="p-3 bg-white rounded border border-red-200">
                    <p className="text-xs text-muted-foreground">CO₂ Impact</p>
                    <p className="text-2xl font-bold text-red-600">+{scenarioResult.impacts.co2} t</p>
                  </div>
                  <div className="p-3 bg-white rounded border border-red-200">
                    <p className="text-xs text-muted-foreground">Reserve Loss</p>
                    <p className="text-2xl font-bold text-red-600">-{scenarioResult.impacts.reserve} MW</p>
                  </div>
                </div>

                {/* Mitigations */}
                <div>
                  <h4 className="font-semibold text-red-900 mb-2">Recommended Mitigations</h4>
                  <ul className="space-y-2">
                    {scenarioResult.mitigations.map((mitigation, idx) => (
                      <li key={idx} className="text-sm text-red-800 flex items-start">
                        <span className="mr-2 font-bold">→</span>
                        {mitigation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          {/* Risk Assessment */}
          <Card className="p-6 bg-white border border-border">
            <h3 className="text-lg font-semibold text-primary mb-4">Risk Assessment Matrix</h3>
            <div className="space-y-3">
              {["Technical Feasibility", "Financial Impact", "System Stability", "Regulatory Compliance"].map(
                (factor, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">{factor}</p>
                      <p className="text-sm font-bold text-primary">{7 + idx}/10</p>
                    </div>
                    <div className="bg-gray-200 rounded h-2 overflow-hidden">
                      <div className="bg-secondary h-full" style={{ width: `${(7 + idx) * 10}%` }}></div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
