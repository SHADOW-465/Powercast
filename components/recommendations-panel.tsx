"use client"

import { Card } from "@/components/ui/card"
import { AlertTriangle, TrendingUp, Zap } from "lucide-react"

export function RecommendationsPanel() {
  const recommendations = [
    {
      id: 1,
      title: "Increase Hydro Flexibility",
      description: "Reservoir levels are optimal. Prepare Nant de Drance for pumping to capture upcoming PV surplus.",
      priority: "high",
      action: "Deploy in 2 hours",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      id: 2,
      title: "PV Forecast Alert",
      description: "Cloud cover expected 14:00-16:00 UTC. Reduce thermal ramp-up. Maintain reserve margin >8%.",
      priority: "medium",
      action: "Monitor",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    {
      id: 3,
      title: "Optimize Balancing Bid",
      description: "Market spike forecast for SCP products. Adjust pricing strategy to capture margin.",
      priority: "low",
      action: "Recommend",
      icon: <Zap className="w-5 h-5" />,
    },
  ]

  const getPriorityColor = (priority: string) => {
    if (priority === "high") return "border-l-4 border-red-500"
    if (priority === "medium") return "border-l-4 border-yellow-500"
    return "border-l-4 border-blue-500"
  }

  return (
    <Card className="p-6 bg-white border border-border">
      <h3 className="text-lg font-semibold text-primary mb-4">Gemini AI Recommendations</h3>
      <div className="space-y-4">
        {recommendations.map((rec) => (
          <div key={rec.id} className={`p-4 bg-gray-50 rounded-lg ${getPriorityColor(rec.priority)}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="text-primary">{rec.icon}</div>
                <h4 className="font-semibold text-foreground">{rec.title}</h4>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded font-medium ${
                  rec.priority === "high"
                    ? "bg-red-100 text-red-700"
                    : rec.priority === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {rec.priority.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
            <button className="text-sm font-medium text-primary hover:text-secondary transition">{rec.action} →</button>
          </div>
        ))}
      </div>
    </Card>
  )
}
