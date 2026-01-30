import { create } from "zustand"
import type { TimeUnit, TimelineValue, TIME_UNIT_MS } from "@/lib/types/forecast"

interface TimelineState {
  unit: TimeUnit
  count: number
  
  setTimeline: (unit: TimeUnit, count: number) => void
  setTimelineValue: (value: TimelineValue) => void
  
  // Computed helpers
  getMilliseconds: () => number
  getLabel: () => string
}

const UNIT_MS: Record<TimeUnit, number> = {
  min: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

const UNIT_LABELS: Record<TimeUnit, [string, string]> = {
  min: ["minute", "minutes"],
  hour: ["hour", "hours"],
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  unit: "hour",
  count: 24,

  setTimeline: (unit, count) => set({ unit, count }),
  
  setTimelineValue: (value) => set({ unit: value.unit, count: value.count }),

  getMilliseconds: () => {
    const { unit, count } = get()
    return count * UNIT_MS[unit]
  },
  
  getLabel: () => {
    const { unit, count } = get()
    const [singular, plural] = UNIT_LABELS[unit]
    return `${count} ${count === 1 ? singular : plural}`
  },
}))
