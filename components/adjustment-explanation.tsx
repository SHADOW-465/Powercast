"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Sparkles, TrendingUp, TrendingDown } from "lucide-react"

/**
 * Adjustment Metadata from the backend forecast response
 */
export interface AdjustmentMetadata {
    adjusted: boolean
    total_adjustment_pct: number
    applied_rules_count: number
    explanation: string
    adjustment_confidence: number
    applied_rules: AppliedRule[]
}

export interface AppliedRule {
    lesson_id: string
    explanation: string
    adjustment_factor: number
    confidence: number
}

interface AdjustmentExplanationProps {
    metadata: AdjustmentMetadata | null
    className?: string
}

/**
 * Component displaying forecast adjustment explanations
 * 
 * Shows:
 * - Whether the forecast was context-adjusted
 * - Total adjustment percentage
 * - Applied rules with explanations
 * - Confidence indicators
 */
export function AdjustmentExplanation({ metadata, className = "" }: AdjustmentExplanationProps) {
    const [expanded, setExpanded] = useState(false)

    if (!metadata) {
        return null
    }

    const { adjusted, total_adjustment_pct, applied_rules_count, explanation, adjustment_confidence, applied_rules } = metadata

    // Determine status color
    const getStatusColor = () => {
        if (!adjusted) return "border-gray-300 bg-gray-50"
        if (Math.abs(total_adjustment_pct) < 5) return "border-green-300 bg-green-50"
        if (Math.abs(total_adjustment_pct) < 10) return "border-yellow-300 bg-yellow-50"
        return "border-orange-300 bg-orange-50"
    }

    // Adjustment direction indicator
    const AdjustmentIndicator = () => {
        if (!adjusted || total_adjustment_pct === 0) {
            return <CheckCircle2 className="w-5 h-5 text-gray-400" />
        }
        if (total_adjustment_pct > 0) {
            return <TrendingUp className="w-5 h-5 text-orange-500" />
        }
        return <TrendingDown className="w-5 h-5 text-blue-500" />
    }

    return (
        <Card className={`p-4 ${getStatusColor()} border-2 ${className}`}>
            {/* Header */}
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <div>
                        <h4 className="font-semibold text-sm text-gray-800">
                            {adjusted ? "Context-Adjusted Forecast" : "Base Forecast (No Adjustments)"}
                        </h4>
                        {adjusted && (
                            <p className="text-xs text-gray-600">
                                {applied_rules_count} rule{applied_rules_count !== 1 ? "s" : ""} applied •
                                {" "}{Math.round(adjustment_confidence * 100)}% confidence
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {adjusted && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-full border">
                            <AdjustmentIndicator />
                            <span className={`text-sm font-medium ${total_adjustment_pct > 0 ? "text-orange-600" :
                                    total_adjustment_pct < 0 ? "text-blue-600" : "text-gray-600"
                                }`}>
                                {total_adjustment_pct > 0 ? "+" : ""}{total_adjustment_pct.toFixed(1)}%
                            </span>
                        </div>
                    )}
                    {applied_rules_count > 0 && (
                        expanded ?
                            <ChevronUp className="w-5 h-5 text-gray-400" /> :
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && adjusted && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    {/* Overall Explanation */}
                    <div className="mb-4">
                        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Explanation</h5>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{explanation}</p>
                    </div>

                    {/* Applied Rules */}
                    {applied_rules && applied_rules.length > 0 && (
                        <div>
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Applied Rules</h5>
                            <div className="space-y-2">
                                {applied_rules.map((rule, idx) => (
                                    <div
                                        key={rule.lesson_id || idx}
                                        className="p-3 bg-white rounded-lg border border-gray-200"
                                    >
                                        <div className="flex items-start justify-between">
                                            <p className="text-sm text-gray-700 flex-1">{rule.explanation}</p>
                                            <div className="ml-2 flex items-center gap-1">
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${rule.adjustment_factor > 1
                                                        ? "bg-orange-100 text-orange-700"
                                                        : "bg-blue-100 text-blue-700"
                                                    }`}>
                                                    {((rule.adjustment_factor - 1) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-400 rounded-full"
                                                    style={{ width: `${rule.confidence * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-500">{Math.round(rule.confidence * 100)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Info Note */}
                    <div className="mt-4 p-3 bg-indigo-50 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-indigo-700">
                            Adjustments are based on historical patterns and learned rules.
                            Maximum adjustment is capped at ±15% of base forecast for safety.
                        </p>
                    </div>
                </div>
            )}
        </Card>
    )
}
