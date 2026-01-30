"use client"

import { useMemo, useState, useEffect } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts"

interface ForecastDataPoint {
  timestamp?: string
  time?: string
  output_mw?: number
  value?: number
  q10: number
  q50: number
  q90: number
}

interface ForecastChartProps {
  data: ForecastDataPoint[]
  showConfidenceBands?: boolean
  height?: number
  color?: string
  title?: string
  enableBrush?: boolean // Enable scrollable brush for large datasets
  brushHeight?: number
}

// Custom tooltip with neumorphic styling
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0]?.payload

  return (
    <div className="neu-raised p-3 rounded-xl bg-[var(--surface)] min-w-[140px]">
      <p className="text-xs text-[var(--text-muted)] mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-[var(--text-secondary)]">Forecast</span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {(data.output_mw ?? data.value ?? data.q50 ?? 0).toFixed(0)} MW
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-[var(--text-muted)]">Q10-Q90</span>
          <span className="text-xs text-[var(--text-muted)]">
            {(data.q10 ?? 0).toFixed(0)} - {(data.q90 ?? 0).toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ForecastChart({
  data,
  showConfidenceBands = true,
  height = 300,
  color = "var(--accent-primary)",
  title,
  enableBrush = false,
  brushHeight = 30,
}: ForecastChartProps) {
  // Prepare chart data - normalize field names
  const chartData = useMemo(() => {
    return data.map((d, index) => {
      // Get the time value - prefer 'time' if present, otherwise format timestamp
      let timeLabel = d.time
      if (!timeLabel && d.timestamp) {
        try {
          const date = new Date(d.timestamp)
          // For large datasets, show date + time for clarity
          if (data.length > 192) { // More than 2 days of 15-min data
            timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
                       ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          } else {
            timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        } catch {
          timeLabel = d.timestamp
        }
      }
      
      // Get the value - prefer 'value' if present, otherwise use output_mw or q50
      const value = d.value ?? d.output_mw ?? d.q50 ?? 0
      
      return {
        ...d,
        time: timeLabel,
        value: value,
        confidenceRange: [d.q10 ?? value * 0.9, d.q90 ?? value * 1.1],
        index, // Keep index for brush reference
      }
    })
  }, [data])

  // Determine if we should show brush (auto-enable for large datasets)
  const shouldShowBrush = enableBrush || data.length > 200 // Auto-enable for 50+ hours

  // Local state to manage brush range - makes brush interactive
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | undefined>(undefined)

  // Reset brush range when data changes (e.g., new forecast loaded or horizon changed)
  useEffect(() => {
    if (!shouldShowBrush || chartData.length === 0) {
      setBrushRange(undefined)
      return
    }
    // Show first 96 points (24 hours) by default for large datasets
    const endIndex = Math.min(96, chartData.length - 1)
    setBrushRange({ startIndex: 0, endIndex })
  }, [shouldShowBrush, chartData.length])

  if (!data || data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-[var(--text-muted)]" style={{ height }}>
        No forecast data available
      </div>
    )
  }

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
          {title}
        </h4>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
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
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Confidence band (Q10-Q90) */}
          {showConfidenceBands && (
            <Area
              type="monotone"
              dataKey="q90"
              stroke="none"
              fill={color}
              fillOpacity={0.1}
              name="Q90"
            />
          )}
          {showConfidenceBands && (
            <Area
              type="monotone"
              dataKey="q10"
              stroke="none"
              fill="var(--background)"
              fillOpacity={1}
              name="Q10"
            />
          )}
          
          {/* Main forecast line */}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#colorValue)"
            fillOpacity={1}
            name="Forecast"
            dot={false}
            activeDot={{
              r: 6,
              fill: color,
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
          />
          
          {/* Scrollable brush for large datasets */}
          {shouldShowBrush && (
            <Brush
              dataKey="time"
              height={brushHeight}
              stroke={color}
              fill="var(--surface)"
              travellerWidth={8}
              startIndex={brushRange?.startIndex}
              endIndex={brushRange?.endIndex}
              onChange={(e) => {
                if (e && typeof e.startIndex === 'number' && typeof e.endIndex === 'number') {
                  setBrushRange({ startIndex: e.startIndex, endIndex: e.endIndex })
                }
              }}
              tickFormatter={() => ""} // Hide tick labels on brush
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      
      {/* Data point count indicator for large datasets */}
      {shouldShowBrush && (
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] text-[var(--text-muted)]">
            {chartData.length.toLocaleString()} data points
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            Drag handles to scroll
          </span>
        </div>
      )}
    </div>
  )
}

// Mini sparkline version for dashboard
export function SparklineChart({
  data,
  color = "var(--accent-primary)",
  height = 40,
}: {
  data: Array<{ value: number } | number>
  color?: string
  height?: number
}) {
  const chartData = data.map((item, index) => ({ 
    value: typeof item === 'number' ? item : item.value, 
    index 
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace(/[^a-z]/gi, "")})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
