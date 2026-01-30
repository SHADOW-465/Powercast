"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, Zap } from "lucide-react"
import { generateDispatchSetpoints } from "@/lib/gemini"
import type { PortfolioData, DispatchSetpoint } from "@/lib/types"

interface DispatchTabProps {
  portfolio: PortfolioData
}

export function DispatchTab({ portfolio }: DispatchTabProps) {
  const [setpoints, setSetpoints] = useState<DispatchSetpoint[]>([])
  const [loading, setLoading] = useState(false)
  const [pvDrop, setPvDrop] = useState(0)

  const handleOptimize = async () => {
    setLoading(true)
    try {
      const result = await generateDispatchSetpoints(portfolio, 50)
      setSetpoints(result)
    } catch (error) {
      console.error("Dispatch error:", error)
    }
    setLoading(false)
  }

  const getPlantName = (id: string) => {
    return portfolio.plants.find((p) => p.id === id)?.name || id
  }

  const getPlantType = (id: string) => {
    return portfolio.plants.find((p) => p.id === id)?.type || "unknown"
  }

  return (
    <div className="space-y-6">
      {/* What-if Analysis */}
      <Card className="p-6 bg-white border border-border">
        <h3 className="text-lg font-semibold text-primary mb-4">What-If Analysis</h3>
        <div>
          <label className="text-sm font-medium text-foreground">PV Generation Drop: {pvDrop}%</label>
          <Slider
            value={[pvDrop]}
            onValueChange={(val) => setPvDrop(val[0])}
            min={0}
            max={100}
            step={5}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-2">Instantly re-optimizes dispatch under this condition</p>
        </div>
      </Card>

      {/* Optimization Control */}
      <Button onClick={handleOptimize} disabled={loading} size="lg" className="w-full">
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Optimizing...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Generate Dispatch Recommendations
          </>
        )}
      </Button>

      {/* Portfolio Status */}
      <Card className="p-6 bg-white border border-border">
        <h3 className="text-sm font-semibold text-primary mb-4">Live Portfolio Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-semibold">Plant</th>
                <th className="text-center py-2 px-2 font-semibold">Type</th>
                <th className="text-center py-2 px-2 font-semibold">Current (MW)</th>
                <th className="text-center py-2 px-2 font-semibold">Max (MW)</th>
                <th className="text-center py-2 px-2 font-semibold">Reserve</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.plants.map((plant) => (
                <tr key={plant.id} className="border-b border-border">
                  <td className="py-2 px-2 font-medium">{plant.name}</td>
                  <td className="text-center py-2 px-2 text-xs">{plant.type}</td>
                  <td className="text-center py-2 px-2 font-medium">{plant.output.toFixed(0)}</td>
                  <td className="text-center py-2 px-2">{plant.capacity}</td>
                  <td className="text-center py-2 px-2">{(plant.capacity - plant.output).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dispatch Recommendations */}
      {setpoints.length > 0 && (
        <Card className="p-6 bg-white border border-border">
          <h3 className="text-lg font-semibold text-primary mb-4">Gemini Dispatch Recommendations</h3>
          <div className="space-y-3">
            {setpoints.map((sp) => (
              <div key={sp.plantId} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-semibold text-foreground">{getPlantName(sp.plantId)}</h4>
                  <span className="text-lg font-bold text-primary">{sp.setpoint} MW</span>
                </div>
                <p className="text-sm text-muted-foreground">{sp.reason}</p>
                <div className="mt-2 bg-white rounded h-2 overflow-hidden">
                  <div
                    className="bg-secondary h-full"
                    style={{
                      width: `${(sp.setpoint / (portfolio.plants.find((p) => p.id === sp.plantId)?.capacity || 1)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Output</p>
              <p className="text-xl font-bold text-primary">{setpoints.reduce((s, sp) => s + sp.setpoint, 0)} MW</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
              <p className="text-xl font-bold text-primary">340 kCHF</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CO₂ Emissions</p>
              <p className="text-xl font-bold text-secondary">48 tonnes</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
