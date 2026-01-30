"use client"

import { Card } from "@/components/ui/card"

export function RiskHeatmap() {
  const constraints = [
    { plant: "Laufenburg", reservoir: "low", ramp: "normal", grid: "normal" },
    { plant: "Nant de Drance", reservoir: "normal", ramp: "normal", grid: "normal" },
    { plant: "Grimsel", reservoir: "normal", ramp: "normal", grid: "congestion" },
    { plant: "Beznau I", reservoir: "n/a", ramp: "normal", grid: "normal" },
    { plant: "Alpine PV", reservoir: "n/a", ramp: "high", grid: "normal" },
  ]

  const getRiskColor = (risk: string) => {
    if (risk === "low" || risk === "normal" || risk === "n/a") return "bg-green-100 text-green-700"
    if (risk === "high" || risk === "congestion") return "bg-red-100 text-red-700"
    return "bg-yellow-100 text-yellow-700"
  }

  return (
    <Card className="p-6 bg-white border border-border">
      <h3 className="text-lg font-semibold text-primary mb-4">Plants × Constraints Risk Matrix</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 font-semibold text-primary">Plant</th>
              <th className="text-center py-2 px-3 font-semibold text-primary">Reservoir</th>
              <th className="text-center py-2 px-3 font-semibold text-primary">Ramp Rate</th>
              <th className="text-center py-2 px-3 font-semibold text-primary">Grid</th>
            </tr>
          </thead>
          <tbody>
            {constraints.map((row, idx) => (
              <tr key={idx} className="border-b border-border last:border-b-0">
                <td className="py-3 px-3 font-medium">{row.plant}</td>
                <td className={`text-center py-3 px-3 rounded ${getRiskColor(row.reservoir)}`}>
                  {row.reservoir === "n/a" ? "—" : row.reservoir === "low" ? "⚠ Low" : "✓ Normal"}
                </td>
                <td className={`text-center py-3 px-3 rounded ${getRiskColor(row.ramp)}`}>
                  {row.ramp === "high" ? "↑ High" : "✓ Normal"}
                </td>
                <td className={`text-center py-3 px-3 rounded ${getRiskColor(row.grid)}`}>
                  {row.grid === "congestion" ? "⚠ Congestion" : "✓ Normal"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
