"use client"

/**
 * Timezone Badge Component
 * 
 * Displays timezone near region name with tooltip explaining time alignment.
 * Part of the "Local Watch Awareness" phase.
 */

import { Clock } from "lucide-react"
import { useModelStore, getTimezoneForRegion } from "@/lib/store/model-store"
import { cn } from "@/lib/utils"

interface TimezoneBadgeProps {
    className?: string
    showIcon?: boolean
}

export function TimezoneBadge({ className, showIcon = true }: TimezoneBadgeProps) {
    const { activeRegion } = useModelStore()

    const timezone = activeRegion?.timezone ?? 'Asia/Kolkata'

    // Format timezone for display (e.g., "IST" for Asia/Kolkata)
    const timezoneDisplay = timezone === 'Asia/Kolkata' ? 'IST' : timezone.split('/').pop() ?? timezone

    // Get current time in the region's timezone
    const currentTime = new Date().toLocaleTimeString('en-IN', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })

    return (
        <div
            className={cn(
                "group relative flex items-center gap-1.5 px-2 py-1 rounded-lg",
                "bg-[var(--bg-secondary)] border border-[var(--border-subtle)]",
                "cursor-help transition-all hover:border-[var(--accent-primary)]/30",
                className
            )}
            title="All forecasts are aligned to local grid behavior"
        >
            {showIcon && (
                <Clock className="w-3 h-3 text-[var(--text-muted)]" />
            )}
            <span className="text-xs text-[var(--text-secondary)]">
                {timezoneDisplay}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
                {currentTime}
            </span>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 
        bg-[var(--surface)] rounded-lg border border-[var(--border-subtle)] shadow-lg
        opacity-0 invisible group-hover:opacity-100 group-hover:visible
        transition-all duration-200 whitespace-nowrap z-50 text-xs"
            >
                <div className="text-[var(--text-primary)] font-medium mb-1">
                    Timezone: {timezone}
                </div>
                <div className="text-[var(--text-muted)]">
                    All forecasts aligned to local grid behavior
                </div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
          border-4 border-transparent border-t-[var(--border-subtle)]"
                />
            </div>
        </div>
    )
}
