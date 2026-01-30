"use client"

import { useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { generateForecast } from "@/lib/gemini"
import type { PortfolioData } from "@/lib/types"

interface ForecastsTabProps {
  portfolio: PortfolioData
}

export function ForecastsTab({ portfolio }: ForecastsTabProps) {
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [horizon, setHorizon] = useState(24)

  const handleGenerateForecast = async () => {
    setLoading(true)
    try {
      const result = await generateForecast(portfolio)
      setForecast(result)
    } catch (error) {
      console.error("Forecast error:", error)
    }
    setLoading(false)
  }

  // Generate chart data
  const generateChartData = () => {
    const data = []
    for (let h = 0; h <= horizon; h++) {
      data.push({
        hour: `H+${h}`,
        p10: 3800 + Math.sin(h / 6) * 300 + Math.random() * 200,
        p50: 4100 + Math.sin(h / 6) * 400 + Math.random() * 250,
        p90: 4400 + Math.sin(h / 6) * 500 + Math.random() * 300,
        pv: Math.max(0, 300 * Math.sin((h - 6) / 6)),
      })
    }
    return data
  }

  const data = generateChartData()

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-border">
        <div>
          <label className="text-sm font-medium text-foreground">Forecast Horizon</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="mt-1 px-3 py-2 rounded border border-border text-sm"
          >
            <option value={24}>24 hours</option>
            <option value={168}>7 days</option>
          </select>
        </div>
        <Button onClick={handleGenerateForecast} disabled={loading} className="mt-7">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Forecast"
          )}
        </Button>
      </div>

      {/* Ensemble Forecast Chart */}
      <Card className="p-6 bg-white border border-border">
        <h3 className="text-lg font-semibold text-primary mb-4">Probabilistic Net Load Forecast (P10/P50/P90)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="hour" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e0e0e0" }} />
            <Legend />
            <Area type="monotone" dataKey="p10" stroke="#003893" fill="#003893" fillOpacity={0.1} name="P10" />
            <Area type="monotone" dataKey="p50" stroke="#2E7D32" fill="#2E7D32" fillOpacity={0.3} name="P50" />
            <Area type="monotone" dataKey="p90" stroke="#FF8F00" fill="#FF8F00" fillOpacity={0.1} name="P90" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Forecast Results */}
      {forecast && (
        <div className="space-y-4">
          <Card className="p-6 bg-white border border-border">
            <h3 className="text-lg font-semibold text-primary mb-4">Gemini Forecast Summary</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded">
                <p className="text-xs text-muted-foreground">P50 Net Load</p>
                <p className="text-2xl font-bold text-primary">{forecast.netLoad.p50} MW</p>
              </div>
              <div className="p-3 bg-green-50 rounded">
                <p className="text-xs text-muted-foreground">PV Generation</p>
                <p className="text-2xl font-bold text-secondary">{forecast.pvGeneration.p50} MW</p>
              </div>
              <div className="p-3 bg-orange-50 rounded">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-2xl font-bold text-accent">{forecast.confidence}</p>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold text-foreground mb-2">Key Risks</h4>
              <ul className="space-y-1">
                {forecast.risks.map((risk, idx) => (
                  <li key={idx} className="text-sm text-foreground flex items-start">
                    <span className="mr-2">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {forecast.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-foreground flex items-start">
                    <span className="mr-2">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Forecast Data Table */}
          <Card className="p-6 bg-white border border-border">
            <h3 className="text-sm font-semibold text-primary mb-3">Detailed Forecast</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold">Hour</th>
                    <th className="text-center py-2 px-2 font-semibold">P10</th>
                    <th className="text-center py-2 px-2 font-semibold">P50</th>
                    <th className="text-center py-2 px-2 font-semibold">P90</th>
                    <th className="text-center py-2 px-2 font-semibold">PV Gen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 12).map((row, idx) => (
                    <tr key={idx} className="border-b border-border">
                      <td className="py-2 px-2">{row.hour}</td>
                      <td className="text-center py-2 px-2">{Math.round(row.p10)}</td>
                      <td className="text-center py-2 px-2 font-medium">{Math.round(row.p50)}</td>
                      <td className="text-center py-2 px-2">{Math.round(row.p90)}</td>
                      <td className="text-center py-2 px-2">{Math.round(row.pv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
