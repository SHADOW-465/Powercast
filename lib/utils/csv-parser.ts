import Papa from "papaparse"
import type { PlantType } from "@/lib/types/plant"

export interface CSVParseResult {
  success: boolean
  data: CSVRow[]
  errors: string[]
  rowCount: number
  columns: string[]
}

export interface CSVRow {
  timestamp: string
  output_mw: number
  temperature?: number
  weather?: string
  [key: string]: string | number | undefined
}

export interface CSVValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Required columns for different plant types
const REQUIRED_COLUMNS: Record<PlantType, string[]> = {
  solar: ["timestamp", "output_mw"],
  hydro: ["timestamp", "output_mw"],
  nuclear: ["timestamp", "output_mw"],
  thermal: ["timestamp", "output_mw"],
  wind: ["timestamp", "output_mw"],
}

const OPTIONAL_COLUMNS: Record<PlantType, string[]> = {
  solar: ["temperature", "irradiance", "cloud_cover"],
  hydro: ["water_level", "flow_rate"],
  nuclear: ["reactor_temp", "capacity_factor"],
  thermal: ["fuel_consumption", "efficiency"],
  wind: ["wind_speed", "wind_direction", "temperature"],
}

export async function parseCSV(file: File): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    const errors: string[] = []
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const data = results.data as CSVRow[]
        const columns = results.meta.fields || []
        
        // Collect parsing errors
        if (results.errors.length > 0) {
          results.errors.forEach((err) => {
            errors.push(`Row ${err.row}: ${err.message}`)
          })
        }
        
        resolve({
          success: errors.length === 0,
          data,
          errors,
          rowCount: data.length,
          columns,
        })
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [error.message],
          rowCount: 0,
          columns: [],
        })
      },
    })
  })
}

export function validateCSV(
  result: CSVParseResult,
  plantType: PlantType
): CSVValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  const required = REQUIRED_COLUMNS[plantType]
  const optional = OPTIONAL_COLUMNS[plantType]
  
  // Check required columns
  for (const col of required) {
    if (!result.columns.includes(col)) {
      errors.push(`Missing required column: "${col}"`)
    }
  }
  
  // Check for optional columns and warn if missing
  for (const col of optional) {
    if (!result.columns.includes(col)) {
      warnings.push(`Optional column "${col}" not found - some features may be limited`)
    }
  }
  
  // Validate data quality
  if (result.data.length === 0) {
    errors.push("CSV file contains no data rows")
  } else {
    // Check for timestamp validity
    const invalidTimestamps = result.data.filter(
      (row) => !row.timestamp || isNaN(Date.parse(String(row.timestamp)))
    )
    if (invalidTimestamps.length > 0) {
      errors.push(`${invalidTimestamps.length} rows have invalid timestamps`)
    }
    
    // Check for negative output values
    const negativeOutputs = result.data.filter(
      (row) => typeof row.output_mw === "number" && row.output_mw < 0
    )
    if (negativeOutputs.length > 0) {
      warnings.push(`${negativeOutputs.length} rows have negative output values`)
    }
    
    // Check for missing output values
    const missingOutputs = result.data.filter(
      (row) => row.output_mw === null || row.output_mw === undefined
    )
    if (missingOutputs.length > 0) {
      warnings.push(`${missingOutputs.length} rows have missing output values`)
    }
  }
  
  // Check for date range gaps
  if (result.data.length > 1) {
    const timestamps = result.data
      .map((row) => new Date(row.timestamp).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b)
    
    if (timestamps.length > 1) {
      const expectedInterval = timestamps[1] - timestamps[0]
      let gapCount = 0
      
      for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i] - timestamps[i - 1]
        if (Math.abs(interval - expectedInterval) > expectedInterval * 0.5) {
          gapCount++
        }
      }
      
      if (gapCount > 0) {
        warnings.push(`${gapCount} potential gaps detected in time series data`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export function getDataSummary(data: CSVRow[]): {
  startDate: string
  endDate: string
  rowCount: number
  avgOutput: number
  maxOutput: number
  minOutput: number
} {
  if (data.length === 0) {
    return {
      startDate: "",
      endDate: "",
      rowCount: 0,
      avgOutput: 0,
      maxOutput: 0,
      minOutput: 0,
    }
  }
  
  const timestamps = data
    .map((row) => new Date(row.timestamp))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  
  const outputs = data
    .map((row) => row.output_mw)
    .filter((v): v is number => typeof v === "number" && !isNaN(v))
  
  return {
    startDate: timestamps[0]?.toISOString() || "",
    endDate: timestamps[timestamps.length - 1]?.toISOString() || "",
    rowCount: data.length,
    avgOutput: outputs.reduce((a, b) => a + b, 0) / outputs.length || 0,
    maxOutput: Math.max(...outputs) || 0,
    minOutput: Math.min(...outputs) || 0,
  }
}
