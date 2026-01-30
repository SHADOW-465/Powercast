"use client"

/**
 * Active Model Indicator - Top Status Bar Component
 * 
 * Displays: "Using Model: {{region_name}} (Last Trained: {{date}})"
 * Shows model status with visual indicators (green=loaded, amber=loading, blue=new)
 * Always visible in header status bar
 */

import { useMemo } from "react"
import { Brain, Loader2, Sparkles, AlertCircle } from "lucide-react"
import { useModelStore, formatLastTrained, MODEL_STATUS_MESSAGES, type ModelStatus } from "@/lib/store/model-store"
import { cn } from "@/lib/utils"

interface ActiveModelIndicatorProps {
    className?: string
    compact?: boolean
}

const STATUS_CONFIG: Record<ModelStatus, {
    icon: typeof Brain
    color: string
    bgColor: string
    animate?: boolean
}> = {
    'idle': {
        icon: Brain,
        color: 'text-[var(--text-muted)]',
        bgColor: 'bg-[var(--bg-secondary)]',
    },
    'loading': {
        icon: Loader2,
        color: 'text-[var(--accent-warning)]',
        bgColor: 'bg-[var(--accent-warning)]/10',
        animate: true,
    },
    'loaded': {
        icon: Brain,
        color: 'text-[var(--accent-success)]',
        bgColor: 'bg-[var(--accent-success)]/10',
    },
    'not_found': {
        icon: Sparkles,
        color: 'text-[var(--accent-primary)]',
        bgColor: 'bg-[var(--accent-primary)]/10',
    },
}

export function ActiveModelIndicator({ className, compact = false }: ActiveModelIndicatorProps) {
    const { activeRegion, modelStatus } = useModelStore()

    const config = STATUS_CONFIG[modelStatus]
    const Icon = config.icon

    const displayText = useMemo(() => {
        if (modelStatus === 'idle' || !activeRegion) {
            return MODEL_STATUS_MESSAGES['idle']
        }

        if (modelStatus === 'loading') {
            return MODEL_STATUS_MESSAGES['loading']
        }

        if (modelStatus === 'not_found') {
            return `New region: ${activeRegion.name}`
        }

        // Model loaded
        const lastTrained = formatLastTrained(activeRegion.lastTrained)
        if (compact) {
            return activeRegion.name
        }
        return `Using: ${activeRegion.name} (${lastTrained})`
    }, [activeRegion, modelStatus, compact])

    return (
        <div
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                config.bgColor,
                className
            )}
        >
            <Icon
                className={cn(
                    "w-3.5 h-3.5",
                    config.color,
                    config.animate && "animate-spin"
                )}
            />
            <span
                className={cn(
                    "text-xs font-medium",
                    modelStatus === 'loaded' ? "text-[var(--text-primary)]" : config.color
                )}
            >
                {displayText}
            </span>

            {/* Status dot indicator */}
            {modelStatus === 'loaded' && (
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-success)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-success)]"></span>
                </span>
            )}
        </div>
    )
}
