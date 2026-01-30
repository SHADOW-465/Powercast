"use client"

import { useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { PlantType } from "@/lib/types/plant"
import { PLANT_COLORS } from "@/lib/types/plant"
import type { ForecastDataPoint } from "@/lib/utils/mock-data"

interface MultiPlantChartProps {
  data: Record<PlantType, ForecastDataPoint[]>
  visiblePlants: PlantType[]
  height?: number
  showLegend?: boolean
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="neu-raised p-3 rounded-xl bg-[var(--surface)] min-w-[160px]">
      <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex justify-between gap-4 items-center">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-[var(--text-secondary)] capitalize">
                {entry.name}
              </span>
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {entry.value?.toFixed(0)} MW
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Custom legend
function CustomLegend({ payload, onClick }: any) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4">
      {payload.map((entry: any) => (
        <button
          key={entry.value}
          onClick={() => onClick?.(entry.value)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
          style={{ color: entry.color }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize">{entry.value}</span>
        </button>
      ))}
    </div>
  )
}

export function MultiPlantChart({
  data,
  visiblePlants,
  height = 350,
  showLegend = true,
}: MultiPlantChartProps) {
  // Merge all plant data by timestamp
  const chartData = useMemo(() => {
    const timestampMap = new Map<string, Record<string, number>>()

    for (const plantType of visiblePlants) {
      const plantData = data[plantType]
      if (!plantData) continue

      for (const point of plantData) {
        const existing = timestampMap.get(point.time) || { time: point.time }
        existing[plantType] = point.value
        timestampMap.set(point.time, existing)
      }
    }

    return Array.from(timestampMap.values())
  }, [data, visiblePlants])

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            {visiblePlants.map((plantType) => (
              <linearGradient
                key={plantType}
                id={`gradient-${plantType}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={PLANT_COLORS[plantType].primary}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={PLANT_COLORS[plantType].primary}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
            width={50}
            label={{
              value: "MW",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "var(--chart-axis)" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend content={<CustomLegend />} />}

          {visiblePlants.map((plantType) => (
            <Area
              key={plantType}
              type="monotone"
              dataKey={plantType}
              name={plantType}
              stroke={PLANT_COLORS[plantType].primary}
              strokeWidth={2}
              fill={`url(#gradient-${plantType})`}
              fillOpacity={1}
              dot={false}
              activeDot={{
                r: 5,
                fill: PLANT_COLORS[plantType].primary,
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
