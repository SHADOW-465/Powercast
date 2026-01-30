"use client"

/**
 * System Intelligence Status - Unified Status Panel
 * 
 * Combined panel showing:
 * - Active model and region
 * - Timezone alignment
 * - Data quality health
 * - Model last trained date
 * 
 * Replaces implicit single-model assumption with explicit model visibility.
 */

import { Brain, MapPin, Clock, Database, Sparkles, RefreshCw } from "lucide-react"
import { NeuCard } from "@/components/ui/neu-card"
import { useModelStore, formatLastTrained, MODEL_STATUS_MESSAGES, DATA_QUALITY_MESSAGES } from "@/lib/store/model-store"
import { cn } from "@/lib/utils"

interface SystemIntelligenceStatusProps {
    className?: string
    compact?: boolean
}

export function SystemIntelligenceStatus({ className, compact = false }: SystemIntelligenceStatusProps) {
    const { activeRegion, modelStatus, dataQuality } = useModelStore()

    // Compact version for inline display
    if (compact) {
        return (
            <div className={cn("flex items-center gap-3", className)}>
                {/* Model Status */}
                <div className="flex items-center gap-1.5 text-xs">
                    <Brain className={cn(
                        "w-3.5 h-3.5",
                        modelStatus === 'loaded' ? "text-[var(--accent-success)]" :
                            modelStatus === 'loading' ? "text-[var(--accent-warning)] animate-pulse" :
                                "text-[var(--text-muted)]"
                    )} />
                    <span className="text-[var(--text-secondary)]">
                        {activeRegion?.name ?? 'No model'}
                    </span>
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-[var(--border-subtle)]" />

                {/* Timezone */}
                <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-secondary)]">
                        {activeRegion?.timezone === 'Asia/Kolkata' ? 'IST' : activeRegion?.timezone ?? 'UTC'}
                    </span>
                </div>

                {/* Data Quality */}
                {dataQuality.status !== 'unknown' && (
                    <>
                        <div className="w-px h-4 bg-[var(--border-subtle)]" />
                        <div className="flex items-center gap-1.5 text-xs">
                            <Database className={cn(
                                "w-3.5 h-3.5",
                                dataQuality.status === 'clean' ? "text-[var(--accent-success)]" :
                                    dataQuality.status === 'minor_gaps_fixed' ? "text-[var(--accent-primary)]" :
                                        "text-[var(--accent-danger)]"
                            )} />
                            <span className="text-[var(--text-secondary)]">
                                {dataQuality.completeness.toFixed(0)}%
                            </span>
                        </div>
                    </>
                )}
            </div>
        )
    }

    // Full card version
    return (
        <NeuCard variant="flat" padding="md" className={cn("", className)}>
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="font-semibold text-sm text-[var(--text-primary)]">System Intelligence</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Active Model */}
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2 mb-2">
                        <Brain className={cn(
                            "w-4 h-4",
                            modelStatus === 'loaded' ? "text-[var(--accent-success)]" :
                                modelStatus === 'loading' ? "text-[var(--accent-warning)] animate-pulse" :
                                    modelStatus === 'not_found' ? "text-[var(--accent-primary)]" :
                                        "text-[var(--text-muted)]"
                        )} />
                        <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Model</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {activeRegion?.name ?? MODEL_STATUS_MESSAGES[modelStatus]}
                    </p>
                    {activeRegion?.lastTrained && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Trained: {formatLastTrained(activeRegion.lastTrained)}
                        </p>
                    )}
                </div>

                {/* Region & Timezone */}
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Region</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                        {activeRegion?.code ?? 'Not selected'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">
                            {activeRegion?.timezone ?? 'Asia/Kolkata'}
                        </span>
                    </div>
                </div>

                {/* Data Quality */}
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2 mb-2">
                        <Database className={cn(
                            "w-4 h-4",
                            dataQuality.status === 'clean' ? "text-[var(--accent-success)]" :
                                dataQuality.status === 'minor_gaps_fixed' ? "text-[var(--accent-primary)]" :
                                    dataQuality.status === 'major_gaps_detected' ? "text-[var(--accent-danger)]" :
                                        "text-[var(--text-muted)]"
                        )} />
                        <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Data Health</span>
                    </div>
                    <p className={cn(
                        "text-sm font-medium",
                        dataQuality.status === 'clean' ? "text-[var(--accent-success)]" :
                            dataQuality.status === 'minor_gaps_fixed' ? "text-[var(--text-primary)]" :
                                dataQuality.status === 'major_gaps_detected' ? "text-[var(--accent-danger)]" :
                                    "text-[var(--text-muted)]"
                    )}>
                        {dataQuality.status === 'unknown' ? 'Awaiting data' :
                            dataQuality.status === 'clean' ? 'Verified' :
                                dataQuality.status === 'minor_gaps_fixed' ? 'Interpolated' :
                                    'Needs attention'}
                    </p>
                    {dataQuality.status !== 'unknown' && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {dataQuality.completeness.toFixed(1)}% complete
                        </p>
                    )}
                </div>

                {/* Pipeline Status */}
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className={cn(
                            "w-4 h-4",
                            modelStatus === 'loading' ? "text-[var(--accent-warning)] animate-spin" :
                                modelStatus === 'loaded' ? "text-[var(--accent-success)]" :
                                    "text-[var(--text-muted)]"
                        )} />
                        <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Status</span>
                    </div>
                    <p className={cn(
                        "text-sm font-medium",
                        modelStatus === 'loaded' ? "text-[var(--accent-success)]" :
                            modelStatus === 'loading' ? "text-[var(--accent-warning)]" :
                                modelStatus === 'not_found' ? "text-[var(--accent-primary)]" :
                                    "text-[var(--text-muted)]"
                    )}>
                        {modelStatus === 'idle' ? 'Ready' :
                            modelStatus === 'loading' ? 'Processing' :
                                modelStatus === 'loaded' ? 'Active' :
                                    'Preparing'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {MODEL_STATUS_MESSAGES[modelStatus].split('.')[0]}
                    </p>
                </div>
            </div>
        </NeuCard>
    )
}
