"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, AlertTriangle, Zap } from "lucide-react"
import type { PortfolioData } from "@/lib/types"

interface KPIGridProps {
  portfolio: PortfolioData
}

export function KPIGrid({ portfolio }: KPIGridProps) {
  const reserveMargin = ((portfolio.totalOutput - portfolio.totalLoad) / portfolio.totalLoad) * 100
  const balancingCost = (portfolio.totalLoad * portfolio.balancingPrice) / 1000 // kCHF

  const kpis = [
    {
      label: "Reserve Margin",
      value: `${reserveMargin.toFixed(1)}%`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: reserveMargin > 10 ? "text-secondary" : "text-accent",
      trend: "stable",
    },
    {
      label: "Balancing Cost",
      value: `${balancingCost.toFixed(0)} kCHF`,
      icon: <Zap className="w-5 h-5" />,
      color: "text-primary",
      trend: "up",
    },
    {
      label: "CO₂ Intensity",
      value: "120 g/kWh",
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-secondary",
      trend: "down",
    },
    {
      label: "Winter Risk Score",
      value: "6.2/10",
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-accent",
      trend: "stable",
    },
    {
      label: "PV Curtailment Risk",
      value: "3.1%",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-primary",
      trend: "down",
    },
    {
      label: "Congestion Alerts",
      value: "1 active",
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-accent",
      trend: "stable",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {kpis.map((kpi, idx) => (
        <Card key={idx} className="p-4 hover:shadow-lg transition">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-primary">{kpi.value}</p>
            </div>
            <div className={`${kpi.color}`}>{kpi.icon}</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Trend: {kpi.trend === "up" ? "↗" : kpi.trend === "down" ? "↘" : "→"} {kpi.trend}
          </div>
        </Card>
      ))}
    </div>
  )
}
