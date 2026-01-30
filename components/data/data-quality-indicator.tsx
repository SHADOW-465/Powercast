"use client"

/**
 * Data Quality Indicator - Self-Healing Data Layer UI
 * 
 * Progressive disclosure component showing data quality status:
 * - Clean: "Data quality verified. No gaps detected." (positive)
 * - Minor: "Minor data gaps detected and safely interpolated." (informational)
 * - Major: "Data gaps exceed safe limits." (blocking)
 * 
 * Uses reassuring messaging with visual severity indicators.
 */

import { CheckCircle, Info, AlertTriangle, Database, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { useModelStore, DATA_QUALITY_MESSAGES, type DataQualityStatus } from "@/lib/store/model-store"
import { cn } from "@/lib/utils"

interface DataQualityIndicatorProps {
    className?: string
    showDetails?: boolean
}

const SEVERITY_CONFIG: Record<'positive' | 'informational' | 'blocking', {
    icon: typeof CheckCircle
    bgColor: string
    borderColor: string
    iconColor: string
    textColor: string
}> = {
    'positive': {
        icon: CheckCircle,
        bgColor: 'bg-[var(--accent-success)]/5',
        borderColor: 'border-[var(--accent-success)]/20',
        iconColor: 'text-[var(--accent-success)]',
        textColor: 'text-[var(--accent-success)]',
    },
    'informational': {
        icon: Info,
        bgColor: 'bg-[var(--accent-primary)]/5',
        borderColor: 'border-[var(--accent-primary)]/20',
        iconColor: 'text-[var(--accent-primary)]',
        textColor: 'text-[var(--text-primary)]',
    },
    'blocking': {
        icon: AlertTriangle,
        bgColor: 'bg-[var(--accent-danger)]/5',
        borderColor: 'border-[var(--accent-danger)]/20',
        iconColor: 'text-[var(--accent-danger)]',
        textColor: 'text-[var(--accent-danger)]',
    },
}

export function DataQualityIndicator({ className, showDetails = false }: DataQualityIndicatorProps) {
    const { dataQuality } = useModelStore()
    const [isExpanded, setIsExpanded] = useState(false)

    const qualityInfo = DATA_QUALITY_MESSAGES[dataQuality.status]
    const config = SEVERITY_CONFIG[qualityInfo.severity]
    const Icon = config.icon

    // Don't render for unknown status
    if (dataQuality.status === 'unknown') return null

    const hasDetails = Object.keys(dataQuality.missingValues).length > 0 || dataQuality.irregularIntervals > 0

    return (
        <div className={cn(
            "rounded-xl border transition-all",
            config.bgColor,
            config.borderColor,
            className
        )}>
            {/* Main indicator */}
            <div
                className={cn(
                    "flex items-center justify-between p-3",
                    hasDetails && showDetails && "cursor-pointer"
                )}
                onClick={() => hasDetails && showDetails && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", config.iconColor)} />
                    <span className={cn("text-sm font-medium", config.textColor)}>
                        {qualityInfo.message}
                    </span>
                </div>

                {hasDetails && showDetails && (
                    <button className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                    </button>
                )}
            </div>

            {/* Expanded details */}
            {isExpanded && hasDetails && (
                <div className="px-3 pb-3 pt-0 border-t border-[var(--border-subtle)] mt-0">
                    <div className="pt-3 space-y-2">
                        {/* Completeness meter */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-muted)]">Data Completeness</span>
                            <span className={cn("font-medium", config.textColor)}>
                                {dataQuality.completeness.toFixed(1)}%
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    dataQuality.completeness >= 95 ? "bg-[var(--accent-success)]" :
                                        dataQuality.completeness >= 80 ? "bg-[var(--accent-warning)]" :
                                            "bg-[var(--accent-danger)]"
                                )}
                                style={{ width: `${Math.min(dataQuality.completeness, 100)}%` }}
                            />
                        </div>

                        {/* Missing values breakdown */}
                        {Object.entries(dataQuality.missingValues).filter(([_, count]) => count > 0).length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs text-[var(--text-muted)] mb-1.5">Interpolated Fields:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(dataQuality.missingValues)
                                        .filter(([_, count]) => count > 0)
                                        .map(([field, count]) => (
                                            <span
                                                key={field}
                                                className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                                            >
                                                {field}: {count}
                                            </span>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Irregular intervals */}
                        {dataQuality.irregularIntervals > 0 && (
                            <p className="text-xs text-[var(--text-muted)]">
                                {dataQuality.irregularIntervals} irregular time intervals detected
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Compact inline version for header/status bar
 */
export function DataQualityBadge({ className }: { className?: string }) {
    const { dataQuality } = useModelStore()

    if (dataQuality.status === 'unknown') return null

    const qualityInfo = DATA_QUALITY_MESSAGES[dataQuality.status]
    const config = SEVERITY_CONFIG[qualityInfo.severity]
    const Icon = config.icon

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg",
            config.bgColor,
            className
        )}>
            <Icon className={cn("w-3 h-3", config.iconColor)} />
            <span className="text-xs text-[var(--text-secondary)]">
                {dataQuality.completeness.toFixed(0)}% complete
            </span>
        </div>
    )
}
