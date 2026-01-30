"use client"

import { useState, useCallback } from "react"
import { NeuCard, NeuCardHeader, NeuCardTitle, NeuCardContent } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  Clock,
  Trash2,
  Sun,
  Droplets,
  Atom,
  Flame,
  Wind,
  AlertCircle,
  X,
  FileCheck,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlantType } from "@/lib/types/plant"
import { parseCSV, validateCSV, getDataSummary, type CSVParseResult } from "@/lib/utils/csv-parser"

const PLANT_TYPES: { value: PlantType; label: string; icon: typeof Sun; color: string }[] = [
  { value: "solar", label: "Solar", icon: Sun, color: "var(--plant-solar)" },
  { value: "hydro", label: "Hydro", icon: Droplets, color: "var(--plant-hydro)" },
  { value: "nuclear", label: "Nuclear", icon: Atom, color: "var(--plant-nuclear)" },
  { value: "thermal", label: "Thermal", icon: Flame, color: "var(--plant-thermal)" },
  { value: "wind", label: "Wind", icon: Wind, color: "var(--plant-wind)" },
]

interface UploadedFile {
  id: string
  filename: string
  plantType: PlantType
  plantName: string
  rows: number
  uploadedAt: string
  status: "processed" | "error"
}

export function DataTab() {
  const [selectedType, setSelectedType] = useState<PlantType>("solar")
  const [plantName, setPlantName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadHistory, setUploadHistory] = useState<UploadedFile[]>([
    { id: "1", filename: "solar_farm_alpha_2024.csv", plantType: "solar", plantName: "Solar Farm Alpha", rows: 8760, uploadedAt: "2 hours ago", status: "processed" },
    { id: "2", filename: "hydro_station_beta.csv", plantType: "hydro", plantName: "Hydro Station Beta", rows: 4380, uploadedAt: "1 day ago", status: "processed" },
    { id: "3", filename: "wind_farm_epsilon_jan.csv", plantType: "wind", plantName: "Wind Farm Epsilon", rows: 2920, uploadedAt: "3 days ago", status: "processed" },
  ])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }, [])

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile)
    setUploadSuccess(false)
    setValidationErrors([])
    setValidationWarnings([])

    if (!plantName) {
      setPlantName(selectedFile.name.replace(".csv", "").replace(/_/g, " "))
    }

    // Parse CSV
    const result = await parseCSV(selectedFile)
    setParseResult(result)

    // Validate
    const validation = validateCSV(result, selectedType)
    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      await processFile(droppedFile)
    } else {
      setValidationErrors(["Please upload a CSV file"])
    }
  }, [selectedType, plantName])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      await processFile(selectedFile)
    } else if (selectedFile) {
      setValidationErrors(["Please upload a CSV file"])
    }
  }

  const handleUpload = async () => {
    if (!file || !parseResult || validationErrors.length > 0) return
    
    setIsUploading(true)
    
    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 2000))
    
    // Add to history
    const newUpload: UploadedFile = {
      id: Date.now().toString(),
      filename: file.name,
      plantType: selectedType,
      plantName: plantName || file.name.replace(".csv", ""),
      rows: parseResult.rowCount,
      uploadedAt: "Just now",
      status: "processed",
    }
    
    setUploadHistory((prev) => [newUpload, ...prev])
    setUploadSuccess(true)
    setFile(null)
    setParseResult(null)
    setPlantName("")
    setIsUploading(false)
  }

  const clearFile = () => {
    setFile(null)
    setParseResult(null)
    setValidationErrors([])
    setValidationWarnings([])
    setUploadSuccess(false)
  }

  const deleteUpload = (id: string) => {
    setUploadHistory((prev) => prev.filter((u) => u.id !== id))
  }

  const summary = parseResult ? getDataSummary(parseResult.data) : null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Data Management
        </h2>
        <p className="text-[var(--text-muted)]">
          Upload and manage forecast data for your power plants
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Uploader */}
        <NeuCard variant="raised" padding="lg">
          <NeuCardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[var(--accent-primary)]" />
              <NeuCardTitle>Upload Forecast Data</NeuCardTitle>
            </div>
          </NeuCardHeader>
          <NeuCardContent>
            {/* Plant Type Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Plant Type
              </label>
              <div className="flex flex-wrap gap-2">
                {PLANT_TYPES.map((pt) => {
                  const Icon = pt.icon
                  return (
                    <button
                      key={pt.value}
                      onClick={() => setSelectedType(pt.value)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                        selectedType === pt.value
                          ? "neu-pressed"
                          : "neu-flat hover:scale-[1.02]"
                      )}
                      style={{
                        color: selectedType === pt.value ? pt.color : "var(--text-secondary)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {pt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Plant Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Plant Name
              </label>
              <input
                type="text"
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
                placeholder="e.g., Solar Farm Alpha"
                className="w-full px-4 py-3 neu-inset rounded-xl text-[var(--text-primary)]
                           placeholder:text-[var(--text-subtle)] bg-transparent
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>

            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
                isDragging
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                  : "border-[var(--border-default)] hover:border-[var(--accent-primary)]/50"
              )}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileCheck className="w-8 h-8 text-[var(--accent-primary)]" />
                  <div className="text-left">
                    <p className="font-medium text-[var(--text-primary)]">{file.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {(file.size / 1024).toFixed(1)} KB
                      {parseResult && ` • ${parseResult.rowCount.toLocaleString()} rows`}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearFile()
                    }}
                    className="p-1 neu-flat rounded-lg hover:scale-110 transition-transform"
                  >
                    <X className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
                  <p className="text-[var(--text-primary)] font-medium mb-1">
                    Drag & drop your CSV file here
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">or click to browse</p>
                  <p className="text-xs text-[var(--text-subtle)] mt-4">
                    Expected format: timestamp, output_mw, temperature, etc.
                  </p>
                </>
              )}
            </div>

            {/* Validation Messages */}
            {validationErrors.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--accent-danger)]/10 space-y-2">
                {validationErrors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[var(--accent-danger)] mt-0.5" />
                    <p className="text-sm text-[var(--text-primary)]">{error}</p>
                  </div>
                ))}
              </div>
            )}

            {validationWarnings.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--accent-warning)]/10 space-y-2">
                {validationWarnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--accent-warning)] mt-0.5" />
                    <p className="text-sm text-[var(--text-secondary)]">{warning}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Data Summary */}
            {summary && summary.rowCount > 0 && validationErrors.length === 0 && (
              <div className="mt-4 p-4 neu-flat rounded-xl">
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Data Summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Records: </span>
                    <span className="text-[var(--text-primary)]">{summary.rowCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Avg Output: </span>
                    <span className="text-[var(--text-primary)]">{summary.avgOutput.toFixed(0)} MW</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Min: </span>
                    <span className="text-[var(--text-primary)]">{summary.minOutput.toFixed(0)} MW</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Max: </span>
                    <span className="text-[var(--text-primary)]">{summary.maxOutput.toFixed(0)} MW</span>
                  </div>
                </div>
              </div>
            )}

            {uploadSuccess && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--accent-success)]/10 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-[var(--accent-success)]" />
                <p className="text-sm text-[var(--text-primary)]">Upload successful!</p>
              </div>
            )}

            {/* Upload Button */}
            {file && validationErrors.length === 0 && (
              <NeuButton
                className="w-full mt-4"
                onClick={handleUpload}
                loading={isUploading}
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Data
              </NeuButton>
            )}
          </NeuCardContent>
        </NeuCard>

        {/* Upload History */}
        <NeuCard variant="raised" padding="lg">
          <NeuCardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--accent-primary)]" />
              <NeuCardTitle>Recent Uploads</NeuCardTitle>
            </div>
          </NeuCardHeader>
          <NeuCardContent>
            <div className="space-y-3">
              {uploadHistory.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  No uploads yet
                </div>
              ) : (
                uploadHistory.map((upload) => {
                  const plantConfig = PLANT_TYPES.find(p => p.value === upload.plantType)
                  const Icon = plantConfig?.icon || FileSpreadsheet
                  
                  return (
                    <div 
                      key={upload.id}
                      className="p-4 neu-flat rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${plantConfig?.color}20` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: plantConfig?.color }} />
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)] text-sm">
                            {upload.plantName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span>{upload.rows.toLocaleString()} rows</span>
                            <span>•</span>
                            <span>{upload.uploadedAt}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-[var(--accent-success)]" />
                        <button 
                          onClick={() => deleteUpload(upload.id)}
                          className="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-[var(--text-muted)] hover:text-[var(--accent-danger)]" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </NeuCardContent>
        </NeuCard>
      </div>

      {/* Data Quality Summary */}
      <NeuCard variant="flat" padding="lg">
        <NeuCardHeader>
          <NeuCardTitle>Data Quality Summary</NeuCardTitle>
        </NeuCardHeader>
        <NeuCardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 neu-inset rounded-xl">
              <p className="text-2xl font-bold text-[var(--accent-success)]">98.5%</p>
              <p className="text-sm text-[var(--text-muted)]">Data Completeness</p>
            </div>
            <div className="text-center p-4 neu-inset rounded-xl">
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {uploadHistory.reduce((sum, u) => sum + u.rows, 0).toLocaleString()}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Total Records</p>
            </div>
            <div className="text-center p-4 neu-inset rounded-xl">
              <p className="text-2xl font-bold text-[var(--accent-primary)]">{uploadHistory.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Active Datasets</p>
            </div>
            <div className="text-center p-4 neu-inset rounded-xl">
              <p className="text-2xl font-bold text-[var(--accent-warning)]">12mo</p>
              <p className="text-sm text-[var(--text-muted)]">Data Span</p>
            </div>
          </div>
        </NeuCardContent>
      </NeuCard>
    </div>
  )
}
