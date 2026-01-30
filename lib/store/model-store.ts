/**
 * Model Store - Multi-Region AI Model State Management
 * 
 * "Library of Brains" - Manages regional AI model state, timezone mapping,
 * and data quality status for the Indian power grid forecasting system.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

// =============================================================================
// TYPES
// =============================================================================

export type ModelStatus = 'idle' | 'loading' | 'loaded' | 'not_found'
export type DataQualityStatus = 'unknown' | 'clean' | 'minor_gaps_fixed' | 'major_gaps_detected'
export type PipelineType = 'training' | 'forecast'

export interface RegionInfo {
  code: string
  name: string
  timezone: string
  lastTrained: string | null
  modelVersion: string | null
}

export interface DataQualityReport {
  status: DataQualityStatus
  completeness: number
  missingValues: Record<string, number>
  irregularIntervals: number
  message: string
}

export interface UploadFeedback {
  detectedRegionCode: string | null
  mappedTimezone: string | null
  pipelineSelected: PipelineType
  isNewRegion: boolean
}

export interface ModelState {
  // Active model info
  activeRegion: RegionInfo | null
  modelStatus: ModelStatus
  dataQuality: DataQualityReport
  uploadFeedback: UploadFeedback | null
  
  // Actions
  setActiveRegion: (region: RegionInfo) => void
  setModelStatus: (status: ModelStatus) => void
  setDataQuality: (report: DataQualityReport) => void
  setUploadFeedback: (feedback: UploadFeedback | null) => void
  detectRegionFromCode: (regionCode: string) => RegionInfo
  clearModelState: () => void
}

// =============================================================================
// REGION CONFIGURATION (Indian Grid)
// =============================================================================

export const REGION_TIMEZONES: Record<string, { name: string; timezone: string }> = {
  'SOUTH_TN_TNEB': { name: 'Tamil Nadu (TNEB)', timezone: 'Asia/Kolkata' },
  'NORTH_UP_UPPCL': { name: 'Uttar Pradesh (UPPCL)', timezone: 'Asia/Kolkata' },
  'WEST_MH_MSEDCL': { name: 'Maharashtra (MSEDCL)', timezone: 'Asia/Kolkata' },
  'EAST_WB_WBSEDCL': { name: 'West Bengal (WBSEDCL)', timezone: 'Asia/Kolkata' },
  'SOUTH_KA_KPTCL': { name: 'Karnataka (KPTCL)', timezone: 'Asia/Kolkata' },
  'SOUTH_AP_APSPDCL': { name: 'Andhra Pradesh (APSPDCL)', timezone: 'Asia/Kolkata' },
  'NORTH_RJ_RVUNL': { name: 'Rajasthan (RVUNL)', timezone: 'Asia/Kolkata' },
  'WEST_GJ_GUVNL': { name: 'Gujarat (GUVNL)', timezone: 'Asia/Kolkata' },
  'SOUTH_KL_KSEB': { name: 'Kerala (KSEB)', timezone: 'Asia/Kolkata' },
  'NORTH_DL_DERC': { name: 'Delhi (DERC)', timezone: 'Asia/Kolkata' },
}

// =============================================================================
// DATA QUALITY MESSAGES (Calm Engineering Tone)
// =============================================================================

export const DATA_QUALITY_MESSAGES: Record<DataQualityStatus, { message: string; severity: 'positive' | 'informational' | 'blocking' }> = {
  'unknown': { 
    message: 'Awaiting data upload...', 
    severity: 'informational' 
  },
  'clean': { 
    message: 'Data quality verified. No gaps detected.', 
    severity: 'positive' 
  },
  'minor_gaps_fixed': { 
    message: 'Minor data gaps detected and safely interpolated.', 
    severity: 'informational' 
  },
  'major_gaps_detected': { 
    message: 'Data gaps exceed safe limits. Please upload higher-quality data.', 
    severity: 'blocking' 
  },
}

// =============================================================================
// MODEL STATUS MESSAGES
// =============================================================================

export const MODEL_STATUS_MESSAGES: Record<ModelStatus, string> = {
  'idle': 'No model loaded',
  'loading': 'Loading regional intelligence...',
  'loaded': 'Model loaded and ready for forecasting',
  'not_found': 'New region detected. Initializing training pipeline.',
}

// =============================================================================
// STORE
// =============================================================================

const initialDataQuality: DataQualityReport = {
  status: 'unknown',
  completeness: 0,
  missingValues: {},
  irregularIntervals: 0,
  message: DATA_QUALITY_MESSAGES['unknown'].message,
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeRegion: null,
      modelStatus: 'idle',
      dataQuality: initialDataQuality,
      uploadFeedback: null,

      // Actions
      setActiveRegion: (region) => set({ 
        activeRegion: region,
        modelStatus: 'loaded'
      }),

      setModelStatus: (status) => set({ modelStatus: status }),

      setDataQuality: (report) => set({ 
        dataQuality: {
          ...report,
          message: DATA_QUALITY_MESSAGES[report.status].message
        }
      }),

      setUploadFeedback: (feedback) => set({ uploadFeedback: feedback }),

      detectRegionFromCode: (regionCode: string): RegionInfo => {
        const known = REGION_TIMEZONES[regionCode]
        
        if (known) {
          return {
            code: regionCode,
            name: known.name,
            timezone: known.timezone,
            lastTrained: null, // Will be populated from model metadata
            modelVersion: null,
          }
        }
        
        // New/unknown region - use defaults
        return {
          code: regionCode,
          name: regionCode.replace(/_/g, ' '),
          timezone: 'Asia/Kolkata', // Default for Indian grid
          lastTrained: null,
          modelVersion: null,
        }
      },

      clearModelState: () => set({
        activeRegion: null,
        modelStatus: 'idle',
        dataQuality: initialDataQuality,
        uploadFeedback: null,
      }),
    }),
    {
      name: 'powercast-model-store',
      partialize: (state) => ({
        activeRegion: state.activeRegion,
        modelStatus: state.modelStatus,
      }),
    }
  )
)

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a region code is known (has existing model configuration)
 */
export function isKnownRegion(regionCode: string): boolean {
  return regionCode in REGION_TIMEZONES
}

/**
 * Get timezone for a region code
 */
export function getTimezoneForRegion(regionCode: string): string {
  return REGION_TIMEZONES[regionCode]?.timezone ?? 'Asia/Kolkata'
}

/**
 * Format last trained date for display
 */
export function formatLastTrained(dateStr: string | null): string {
  if (!dateStr) return 'Not trained'
  
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  } catch {
    return 'Unknown'
  }
}
