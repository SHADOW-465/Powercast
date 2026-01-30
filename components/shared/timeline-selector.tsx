"use client"

import { useState } from "react"
import { ChevronDown, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export type TimeUnit = "min" | "hour" | "day" | "week" | "month"

export interface TimelineValue {
  unit: TimeUnit
  count: number
}

const PRESETS: { label: string; unit: TimeUnit; count: number }[] = [
  { label: "15m", unit: "min", count: 15 },
  { label: "1h", unit: "hour", count: 1 },
  { label: "6h", unit: "hour", count: 6 },
  { label: "24h", unit: "hour", count: 24 },
  { label: "7d", unit: "day", count: 7 },
  { label: "30d", unit: "day", count: 30 },
  { label: "3mo", unit: "month", count: 3 },
  { label: "12mo", unit: "month", count: 12 },
]

interface TimelineSelectorProps {
  value?: TimelineValue
  onChange?: (value: TimelineValue) => void
}

export function TimelineSelector({ 
  value = { unit: "hour", count: 24 }, 
  onChange 
}: TimelineSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState<TimelineValue>(value)

  const currentPreset = PRESETS.find(
    (p) => p.unit === selectedValue.unit && p.count === selectedValue.count
  )

  const handleSelect = (preset: typeof PRESETS[0]) => {
    const newValue = { unit: preset.unit, count: preset.count }
    setSelectedValue(newValue)
    onChange?.(newValue)
    setIsOpen(false)
  }

  const formatDisplay = (): string => {
    if (currentPreset) return currentPreset.label
    const unitLabels: Record<TimeUnit, [string, string]> = {
      min: ["min", "mins"],
      hour: ["hr", "hrs"],
      day: ["day", "days"],
      week: ["wk", "wks"],
      month: ["mo", "mos"],
    }
    const [singular, plural] = unitLabels[selectedValue.unit]
    return `${selectedValue.count}${selectedValue.count === 1 ? singular : plural}`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 neu-flat rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
      >
        <Clock className="w-4 h-4" />
        <span>{formatDisplay()}</span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 p-2 neu-raised rounded-xl min-w-[180px] animate-scale-in">
            <div className="text-xs font-medium text-[var(--text-muted)] px-2 py-1 mb-1">
              Forecast Horizon
            </div>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleSelect(preset)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    currentPreset?.label === preset.label
                      ? "neu-pressed text-[var(--accent-primary)]"
                      : "hover:bg-[var(--background-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
