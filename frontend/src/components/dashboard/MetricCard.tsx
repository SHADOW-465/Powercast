"use client"

import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'cyan' | 'green' | 'yellow' | 'orange' | 'red'
  className?: string
}

export function MetricCard({ 
  label, 
  value, 
  unit, 
  trend, 
  variant = 'cyan',
  className 
}: MetricCardProps) {
  const variantColors = {
    cyan: 'text-[rgb(var(--color-accent-cyan))]',
    green: 'text-[rgb(var(--color-accent-green))]',
    yellow: 'text-[rgb(var(--color-accent-yellow))]',
    orange: 'text-[rgb(var(--color-accent-orange))]',
    red: 'text-[rgb(var(--color-accent-red))]',
  }

  return (
    <div className={cn("card-glass", className)}>
      <div className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className={cn("text-4xl font-bold", variantColors[variant])}>
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground">{unit}</span>
          )}
        </div>
        {trend && (
          <div className="flex items-center gap-2 text-sm">
            <span className={trend.isPositive ? 'text-green-500' : 'text-red-500'}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-muted-foreground">from last hour</span>
          </div>
        )}
      </div>
    </div>
  )
}
