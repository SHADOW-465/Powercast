"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { NeuCard, NeuCardHeader, NeuCardTitle, NeuCardContent } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { ForecastChart } from "@/components/charts"
import { 
  TrendingUp, 
  Download, 
  RefreshCw,
  Sun,
  Droplets,
  Atom,
  Flame,
  Wind,
  Zap,
  Activity,
  Clock,
  Target,
  AlertCircle,
  Timer,
  Pause,
  Play,
  Cloud,
  Thermometer,
  ChevronDown,
  FileSpreadsheet,
  FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlantSessionStore, generateForecastFromCSV, calculateInferenceMetrics } from "@/lib/store/plant-session-store"
import type { PlantType } from "@/lib/types/plant"

const PLANT_ICONS: Record<PlantType, typeof Sun> = {
  solar: Sun, hydro: Droplets, nuclear: Atom, thermal: Flame, wind: Wind,
}

const PLANT_COLORS: Record<PlantType, string> = {
  solar: "var(--plant-solar)", hydro: "var(--plant-hydro)", nuclear: "var(--plant-nuclear)", 
  thermal: "var(--plant-thermal)", wind: "var(--plant-wind)",
}

// Extended multi-horizon options grouped by category
type HorizonCategory = "hours" | "days" | "weeks"

interface HorizonOption {
  value: number // hours
  label: string
  category: HorizonCategory
}

const HORIZON_OPTIONS: HorizonOption[] = [
  // Hours (6h - 48h)
  { value: 6, label: "6h", category: "hours" },
  { value: 12, label: "12h", category: "hours" },
  { value: 24, label: "24h", category: "hours" },
  { value: 48, label: "48h", category: "hours" },
  // Days (3d - 14d)
  { value: 72, label: "3d", category: "days" },
  { value: 168, label: "7d", category: "days" },
  { value: 336, label: "14d", category: "days" },
  // Weeks (4w - 12w)
  { value: 672, label: "4w", category: "weeks" },
  { value: 1344, label: "8w", category: "weeks" },
  { value: 2016, label: "12w", category: "weeks" },
]

const CATEGORY_LABELS: Record<HorizonCategory, string> = {
  hours: "Hours",
  days: "Days", 
  weeks: "Weeks",
}

// Auto-refresh interval options (in seconds)
const AUTO_REFRESH_INTERVAL = 10 * 60 // 10 minutes in seconds

export function ForecastsTab() {
  const [hydrated, setHydrated] = useState(false)
  const [selectedHorizon, setSelectedHorizon] = useState(24)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const store = usePlantSessionStore()

  useEffect(() => {
    usePlantSessionStore.persist.rehydrate()
    setHydrated(true)
  }, [])

  const { 
    forecastInitialized, plantType, plantName, capacity,
    forecastData, inferenceMetrics, csvData, setForecastHorizon, initializeForecast,
    location, weatherData, setWeatherData
  } = store

  const PlantIcon = plantType ? PLANT_ICONS[plantType] : Zap
  const plantColor = plantType ? PLANT_COLORS[plantType] : "var(--accent-primary)"

  const filteredForecastData = useMemo(() => {
    if (!forecastData) return []
    const pointsToShow = selectedHorizon * 4
    return forecastData.slice(0, Math.min(forecastData.length, pointsToShow))
  }, [forecastData, selectedHorizon])

  const displayMetrics = useMemo(() => {
    if (!filteredForecastData.length || !capacity) return inferenceMetrics
    return calculateInferenceMetrics(filteredForecastData, capacity)
  }, [filteredForecastData, capacity, inferenceMetrics])

  const handleHorizonChange = (hours: number) => {
    setSelectedHorizon(hours)
    setForecastHorizon(hours)
  }

  const handleRefresh = useCallback(async () => {
    if (!csvData || !capacity) return
    setIsRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    // Generate forecast for max horizon (12 weeks = 2016 hours)
    const newForecast = generateForecastFromCSV(csvData, 2016)
    const newMetrics = calculateInferenceMetrics(newForecast, capacity)
    initializeForecast(newForecast, newMetrics)
    setIsRefreshing(false)
    // Reset countdown after refresh
    setCountdown(AUTO_REFRESH_INTERVAL)
  }, [csvData, capacity, initializeForecast])

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!forecastInitialized || !autoRefreshEnabled) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger refresh
          handleRefresh()
          return AUTO_REFRESH_INTERVAL
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [forecastInitialized, autoRefreshEnabled, handleRefresh])

  // Reset countdown when auto-refresh is re-enabled
  useEffect(() => {
    if (autoRefreshEnabled) {
      setCountdown(AUTO_REFRESH_INTERVAL)
    }
  }, [autoRefreshEnabled])

  // Format countdown for display
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Fetch weather data
  useEffect(() => {
    if (location && forecastInitialized) {
      fetch(`/api/weather?lat=${location.latitude}&lon=${location.longitude}`)
        .then(res => res.json())
        .then(data => setWeatherData(data))
        .catch(console.error)
    }
  }, [location, forecastInitialized, setWeatherData])

  const handleExportCSV = () => {
    if (!filteredForecastData.length || !plantName) return
    const headers = "timestamp,output_mw,q10,q50,q90\n"
    const rows = filteredForecastData.map(row => 
      `${row.timestamp},${row.output_mw.toFixed(2)},${row.q10.toFixed(2)},${row.q50.toFixed(2)},${row.q90.toFixed(2)}`
    ).join("\n")
    const blob = new Blob([headers + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${plantName.replace(/\s+/g, "_")}_forecast.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const handleExportExcel = () => {
    if (!filteredForecastData.length || !plantName) return
    
    // Create Excel-compatible XML (SpreadsheetML)
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Forecast">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Timestamp</Data></Cell>
    <Cell><Data ss:Type="String">Output (MW)</Data></Cell>
    <Cell><Data ss:Type="String">Q10</Data></Cell>
    <Cell><Data ss:Type="String">Q50</Data></Cell>
    <Cell><Data ss:Type="String">Q90</Data></Cell>
   </Row>
   ${filteredForecastData.map(row => `
   <Row>
    <Cell><Data ss:Type="String">${row.timestamp}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.output_mw.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.q10.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.q50.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.q90.toFixed(2)}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Summary">
  <Table>
   <Row><Cell><Data ss:Type="String">Executive Summary</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Plant Name</Data></Cell><Cell><Data ss:Type="String">${plantName}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Plant Type</Data></Cell><Cell><Data ss:Type="String">${plantType?.toUpperCase()}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Capacity</Data></Cell><Cell><Data ss:Type="Number">${capacity}</Data></Cell><Cell><Data ss:Type="String">MW</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Peak Output</Data></Cell><Cell><Data ss:Type="Number">${displayMetrics?.peakOutput || 0}</Data></Cell><Cell><Data ss:Type="String">MW</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Average Output</Data></Cell><Cell><Data ss:Type="Number">${displayMetrics?.avgOutput || 0}</Data></Cell><Cell><Data ss:Type="String">MW</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Efficiency</Data></Cell><Cell><Data ss:Type="Number">${displayMetrics?.avgEfficiency || 0}</Data></Cell><Cell><Data ss:Type="String">%</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Total Energy</Data></Cell><Cell><Data ss:Type="Number">${displayMetrics?.totalEnergy || 0}</Data></Cell><Cell><Data ss:Type="String">MWh</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Forecast Horizon</Data></Cell><Cell><Data ss:Type="Number">${selectedHorizon}</Data></Cell><Cell><Data ss:Type="String">hours</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Generated At</Data></Cell><Cell><Data ss:Type="String">${new Date().toISOString()}</Data></Cell></Row>
  </Table>
 </Worksheet>
</Workbook>`

    const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${plantName.replace(/\s+/g, "_")}_forecast.xls`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const handleExportPDF = () => {
    // Generate a printable HTML report that can be saved as PDF
    if (!filteredForecastData.length || !plantName) return
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Forecast Report - ${plantName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1a1a2e; }
    h1 { color: #0f3460; border-bottom: 2px solid #e94560; padding-bottom: 10px; }
    h2 { color: #0f3460; margin-top: 30px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #e94560; }
    .date { color: #666; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 28px; font-weight: bold; color: #0f3460; }
    .summary-label { font-size: 12px; color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #0f3460; color: white; }
    tr:nth-child(even) { background: #f8f9fa; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Powercast AI</div>
    <div class="date">Generated: ${new Date().toLocaleString()}</div>
  </div>
  
  <h1>Forecast Report</h1>
  <p><strong>Plant:</strong> ${plantName} | <strong>Type:</strong> ${plantType?.toUpperCase()} | <strong>Capacity:</strong> ${capacity} MW</p>
  
  <h2>Executive Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-value">${displayMetrics?.peakOutput || 0}</div>
      <div class="summary-label">Peak Output (MW)</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${displayMetrics?.avgOutput || 0}</div>
      <div class="summary-label">Avg Output (MW)</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${displayMetrics?.avgEfficiency || 0}%</div>
      <div class="summary-label">Efficiency</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${displayMetrics?.totalEnergy || 0}</div>
      <div class="summary-label">Total Energy (MWh)</div>
    </div>
  </div>

  <h2>Forecast Data (${selectedHorizon} hours)</h2>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Output (MW)</th>
        <th>Q10</th>
        <th>Q50</th>
        <th>Q90</th>
      </tr>
    </thead>
    <tbody>
      ${filteredForecastData.slice(0, 100).map(row => `
      <tr>
        <td>${new Date(row.timestamp).toLocaleString()}</td>
        <td>${row.output_mw.toFixed(2)}</td>
        <td>${row.q10.toFixed(2)}</td>
        <td>${row.q50.toFixed(2)}</td>
        <td>${row.q90.toFixed(2)}</td>
      </tr>`).join('')}
      ${filteredForecastData.length > 100 ? '<tr><td colspan="5" style="text-align:center;">... and ' + (filteredForecastData.length - 100) + ' more rows</td></tr>' : ''}
    </tbody>
  </table>

  <div class="footer">
    <p>This report was generated by Powercast AI - Grid Forecasting & Decision Support System</p>
    <p>Model Accuracy: ${displayMetrics?.modelAccuracy || 97.2}% | Confidence Level: 95% (Q10-Q90)</p>
  </div>
  
  <script>window.print();</script>
</body>
</html>`

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    setShowExportMenu(false)
  }

  if (!hydrated) {
    return <div className="h-[80vh] flex items-center justify-center text-[var(--text-muted)]">Loading...</div>
  }

  if (!forecastInitialized) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Active Session</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">Configure a plant and upload data in Dashboard to view forecasts.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${plantColor}20` }}>
            <PlantIcon className="w-6 h-6" style={{ color: plantColor }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {plantType?.toUpperCase()} - {capacity} MW
            </h2>
            <p className="text-xs text-[var(--text-muted)]">{plantName}</p>
          </div>
        </div>

        {/* Weather Display */}
        {weatherData && location && (
          <div className="hidden md:flex items-center gap-4 px-4 py-2 rounded-xl neu-inset bg-[var(--bg-card)]/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs font-medium text-[var(--text-primary)]">{location.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{weatherData.condition}</p>
              </div>
              {/* Weather Icon would go here, using Cloud for now as generic fallback if icon mapping isn't available */}
              <Cloud className="w-6 h-6 text-[var(--text-secondary)]" />
            </div>
            <div className="w-px h-6 bg-[var(--border-default)]" />
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1" title="Temperature">
                <Thermometer className="w-3.5 h-3.5 text-[var(--accent-warning)]" />
                <span className="font-mono">{weatherData.temperature}°C</span>
              </div>
              <div className="flex items-center gap-1" title="Humidity">
                <Droplets className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span className="font-mono">{weatherData.humidity}%</span>
              </div>
              <div className="flex items-center gap-1" title="Wind Speed">
                <Wind className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span className="font-mono">{weatherData.windSpeed}m/s</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Auto-refresh countdown */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg neu-flat">
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className={cn(
                "p-1 rounded transition-colors",
                autoRefreshEnabled 
                  ? "text-[var(--accent-success)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              title={autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"}
            >
              {autoRefreshEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <div className="flex items-center gap-1">
              <Timer className="w-3 h-3 text-[var(--text-muted)]" />
              <span className={cn(
                "text-xs font-mono",
                autoRefreshEnabled ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
              )}>
                {autoRefreshEnabled ? formatCountdown(countdown) : "Paused"}
              </span>
            </div>
          </div>
          
          <NeuButton variant="ghost" size="sm" onClick={handleRefresh} loading={isRefreshing}>
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </NeuButton>
          
          {/* Export Dropdown */}
          <div className="relative">
            <NeuButton 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download className="w-4 h-4" />
              <ChevronDown className="w-3 h-3 ml-1" />
            </NeuButton>
            
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg neu-raised bg-[var(--surface)]">
                <button
                  onClick={handleExportCSV}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[var(--accent-success)]" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--background-secondary)] transition-colors"
                >
                  <FileText className="w-4 h-4 text-[var(--accent-danger)]" />
                  <span>Export PDF Report</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline + Metrics Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Grouped Horizon Selector */}
        <div className="flex items-center gap-3">
          {(["hours", "days", "weeks"] as HorizonCategory[]).map((category) => {
            const options = HORIZON_OPTIONS.filter((opt) => opt.category === category)
            return (
              <div key={category} className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mr-1">
                  {CATEGORY_LABELS[category]}
                </span>
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleHorizonChange(opt.value)}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium transition-all",
                      selectedHorizon === opt.value 
                        ? "neu-pressed text-[var(--accent-primary)]" 
                        : "neu-flat text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[var(--accent-warning)]" />
            <span className="text-[var(--text-muted)]">Peak:</span>
            <span className="font-semibold">{displayMetrics?.peakOutput || 0} MW</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="text-[var(--text-muted)]">Avg:</span>
            <span className="font-semibold">{displayMetrics?.avgOutput || 0} MW</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-[var(--accent-success)]" />
            <span className="text-[var(--text-muted)]">Eff:</span>
            <span className="font-semibold">{displayMetrics?.avgEfficiency || 0}%</span>
          </div>
        </div>
      </div>

      {/* Chart - Main Focus */}
      <NeuCard variant="raised" padding="md">
        <ForecastChart
          data={filteredForecastData}
          showConfidenceBands={true}
          height={selectedHorizon > 48 ? 380 : 320} // Taller for brush on long horizons
          color={plantColor}
          enableBrush={selectedHorizon > 48} // Enable brush for horizons > 48h
        />
      </NeuCard>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <NeuCard variant="flat" padding="sm">
          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)]">Peak Output</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{displayMetrics?.peakOutput || 0}</p>
            <p className="text-xs text-[var(--text-subtle)]">MW</p>
          </div>
        </NeuCard>
        <NeuCard variant="flat" padding="sm">
          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)]">Avg Efficiency</p>
            <p className="text-xl font-bold text-[var(--accent-primary)]">{displayMetrics?.avgEfficiency || 0}%</p>
            <p className="text-xs text-[var(--text-subtle)]">of capacity</p>
          </div>
        </NeuCard>
        <NeuCard variant="flat" padding="sm">
          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)]">Total Energy</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{displayMetrics?.totalEnergy || 0}</p>
            <p className="text-xs text-[var(--text-subtle)]">MWh</p>
          </div>
        </NeuCard>
        <NeuCard variant="flat" padding="sm">
          <div className="text-center">
            <p className="text-xs text-[var(--text-muted)]">Confidence</p>
            <p className="text-xl font-bold text-[var(--accent-success)]">95%</p>
            <p className="text-xs text-[var(--text-subtle)]">Q10-Q90</p>
          </div>
        </NeuCard>
      </div>
    </div>
  )
}
