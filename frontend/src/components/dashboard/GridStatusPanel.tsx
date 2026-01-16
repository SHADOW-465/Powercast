"use client"

import { cn } from "@/lib/utils"

interface StatusItem {
  label: string
  value: string | number
  status: 'adequate' | 'risk' | 'medium'
}

interface GridStatusPanelProps {
  items: StatusItem[]
  className?: string
}

export function GridStatusPanel({ items, className }: GridStatusPanelProps) {
  const statusStyles = {
    adequate: 'bg-[rgba(0,255,136,0.15)] text-[rgb(var(--color-accent-green))]',
    risk: 'bg-[rgba(255,68,68,0.15)] text-[rgb(var(--color-accent-red))]',
    medium: 'bg-[rgba(255,215,0,0.15)] text-[rgb(var(--color-accent-yellow))]',
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {items.map((item, index) => (
        <div key={index} className="card-glass p-4">
          <div className="text-xs uppercase tracking-wide mb-2 text-[rgb(var(--color-muted))]">
            {item.label}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-foreground">
              {item.value}
            </div>
            <div className={cn(
              "px-2.5 py-1 rounded text-xs font-semibold",
              statusStyles[item.status]
            )}>
              {item.status.toUpperCase()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
