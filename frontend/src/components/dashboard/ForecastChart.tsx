"use client"

import { LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { cn } from "@/lib/utils"

interface ForecastDataPoint {
  timestamp: string
  point: number
  q10?: number
  q90?: number
}

interface ForecastChartProps {
  data: ForecastDataPoint[]
  title?: string
  showIntervals?: boolean
  height?: number
  className?: string
}

export function ForecastChart({ 
  data, 
  title = "Load Forecast", 
  showIntervals = true,
  height = 350,
  className 
}: ForecastChartProps) {
  // Transform data for recharts
  const chartData = data.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    point: Math.round(d.point),
    q10: d.q10 ? Math.round(d.q10) : undefined,
    q90: d.q90 ? Math.round(d.q90) : undefined,
  }))

  return (
    <div className={cn("card-glass", className)}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-6 h-0.5 rounded-sm bg-[rgb(var(--color-accent-cyan))]" />
            <span>Forecast</span>
          </div>
          {showIntervals && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-6 h-0.5 rounded-sm bg-[rgb(var(--color-accent-green))]" />
                <span>Q90</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-6 h-0.5 rounded-sm bg-[rgb(var(--color-accent-orange))]" />
                <span>Q10</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        {showIntervals ? (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="intervalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(0, 212, 255)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="rgb(0, 212, 255)" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="time" 
              stroke="rgb(var(--color-muted-foreground))"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="rgb(var(--color-muted-foreground))"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `${value} MW`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgb(15, 40, 71)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: 'rgb(255, 255, 255)' }}
            />
            <Area 
              type="monotone" 
              dataKey="q90" 
              stroke="rgb(var(--color-accent-green))"
              fill="url(#intervalGradient)"
              strokeWidth={1}
            />
            <Area 
              type="monotone" 
              dataKey="q10" 
              stroke="rgb(var(--color-accent-orange))"
              fill="rgb(15, 40, 71)"
              strokeWidth={1}
            />
            <Line 
              type="monotone" 
              dataKey="point" 
              stroke="rgb(var(--color-accent-cyan))" 
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="time" 
              stroke="rgb(var(--color-muted-foreground))"
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              stroke="rgb(var(--color-muted-foreground))"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `${value} MW`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgb(15, 40, 71)', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px' 
              }}
            />
            <Line 
              type="monotone" 
              dataKey="point" 
              stroke="rgb(var(--color-accent-cyan))" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
