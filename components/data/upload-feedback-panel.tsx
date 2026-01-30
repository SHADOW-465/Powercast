"use client"

/**
 * Upload Feedback Panel - Smart Traffic Controller UI
 * 
 * Shows post-upload feedback including:
 * - detected_region_code
 * - mapped_timezone
 * - pipeline_selected (Training or Forecast)
 * 
 * Uses calm, reassuring messaging for region handling.
 */

import { MapPin, Clock, GitBranch, CheckCircle, Sparkles } from "lucide-react"
import { useModelStore, isKnownRegion, type PipelineType } from "@/lib/store/model-store"
import { cn } from "@/lib/utils"

interface UploadFeedbackPanelProps {
    className?: string
}

const PIPELINE_CONFIG: Record<PipelineType, { label: string; icon: typeof GitBranch; color: string }> = {
    'training': {
        label: 'Training Pipeline',
        icon: Sparkles,
        color: 'text-[var(--accent-primary)]'
    },
    'forecast': {
        label: 'Forecast Pipeline',
        icon: CheckCircle,
        color: 'text-[var(--accent-success)]'
    }
}

export function UploadFeedbackPanel({ className }: UploadFeedbackPanelProps) {
    const { uploadFeedback, activeRegion } = useModelStore()

    if (!uploadFeedback) return null

    const { detectedRegionCode, mappedTimezone, pipelineSelected, isNewRegion } = uploadFeedback
    const pipelineConfig = PIPELINE_CONFIG[pipelineSelected]
    const PipelineIcon = pipelineConfig.icon

    return (
        <div className={cn(
            "p-4 rounded-xl border transition-all animate-fade-in",
            isNewRegion
                ? "bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]/20"
                : "bg-[var(--accent-success)]/5 border-[var(--accent-success)]/20",
            className
        )}>
            {/* Header message */}
            <div className="flex items-center gap-2 mb-3">
                {isNewRegion ? (
                    <>
                        <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            New region detected. Preparing AI training environment.
                        </span>
                    </>
                ) : (
                    <>
                        <CheckCircle className="w-4 h-4 text-[var(--accent-success)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                            Region recognized. Running forecast using existing model.
                        </span>
                    </>
                )}
            </div>

            {/* Feedback fields */}
            <div className="grid grid-cols-3 gap-3">
                {/* Detected Region */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Region</p>
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {activeRegion?.name ?? detectedRegionCode ?? 'Unknown'}
                        </p>
                    </div>
                </div>

                {/* Mapped Timezone */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Timezone</p>
                        <p className="text-xs font-medium text-[var(--text-primary)]">
                            {mappedTimezone === 'Asia/Kolkata' ? 'IST (UTC+5:30)' : mappedTimezone}
                        </p>
                    </div>
                </div>

                {/* Pipeline Selected */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <PipelineIcon className={cn("w-3.5 h-3.5", pipelineConfig.color)} />
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Pipeline</p>
                        <p className={cn("text-xs font-medium", pipelineConfig.color)}>
                            {pipelineConfig.label}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
