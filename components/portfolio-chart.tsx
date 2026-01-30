"use client"

import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { PortfolioData } from "@/lib/types"

interface PortfolioChartProps {
  portfolio: PortfolioData
}

// Simulated 24h data
const generateChartData = () => {
  const data = []
  const now = new Date()
  for (let i = -24; i <= 0; i++) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000)
    data.push({
      time: time.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }),
      output: 3800 + Math.sin(i / 12) * 400 + Math.random() * 200,
      load: 4200 + Math.cos(i / 6) * 600 + Math.random() * 300,
      forecast: 4100 + Math.cos(i / 6) * 550,
    })
  }
  return data
}

export function PortfolioChart({ portfolio }: PortfolioChartProps) {
  const data = generateChartData()

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border mb-6">
      <h3 className="text-lg font-semibold text-primary mb-4">Portfolio Output vs Load (24h)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="time" stroke="#666" />
          <YAxis stroke="#666" />
          <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e0e0e0", borderRadius: "8px" }} />
          <Legend />
          <Area
            type="monotone"
            dataKey="output"
            stroke="#003893"
            fill="#003893"
            fillOpacity={0.3}
            name="Portfolio Output"
          />
          <Area type="monotone" dataKey="load" stroke="#FF8F00" fill="#FF8F00" fillOpacity={0.3} name="Load" />
          <Line type="monotone" dataKey="forecast" stroke="#2E7D32" strokeDasharray="5 5" name="AI Forecast" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
