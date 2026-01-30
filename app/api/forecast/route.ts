import { NextRequest, NextResponse } from "next/server"

/**
 * Forecast API Route
 * 
 * This route proxies forecast requests to the Python FastAPI backend.
 * For development, it also provides mock data when the backend isn't running.
 */

const BACKEND_URL = process.env.FASTAPI_BACKEND_URL || "http://localhost:8000"

interface ForecastRequest {
  plantType: string
  capacity: number
  horizon: number // hours
  historicalData?: Array<{ timestamp: string; output_mw: number }>
}

interface ForecastPoint {
  timestamp: string
  output_mw: number
  q10: number
  q50: number
  q90: number
}

// Generate mock forecast when backend is unavailable
function generateMockForecast(
  capacity: number, 
  horizon: number, 
  plantType: string
): ForecastPoint[] {
  const points: ForecastPoint[] = []
  const now = new Date()
  const pointsNeeded = horizon * 4 // 15-minute intervals

  for (let i = 0; i < pointsNeeded; i++) {
    const timestamp = new Date(now.getTime() + i * 15 * 60 * 1000)
    const hour = timestamp.getHours() + timestamp.getMinutes() / 60

    // Generate plant-type specific patterns
    let baseLoad: number
    let dailyPattern: number

    switch (plantType) {
      case "solar":
        // Solar peaks at noon
        baseLoad = capacity * 0.1
        dailyPattern = hour >= 6 && hour <= 18 
          ? Math.sin((hour - 6) / 12 * Math.PI) * capacity * 0.8
          : 0
        break
      case "wind":
        // Wind is more random, typically higher at night
        baseLoad = capacity * 0.3
        dailyPattern = Math.sin(hour / 6) * capacity * 0.3 + Math.random() * capacity * 0.2
        break
      case "hydro":
        // Hydro follows demand pattern
        baseLoad = capacity * 0.4
        dailyPattern = (hour >= 7 && hour <= 22) ? capacity * 0.4 : 0
        break
      case "nuclear":
        // Nuclear is mostly constant
        baseLoad = capacity * 0.85
        dailyPattern = Math.random() * capacity * 0.05
        break
      case "thermal":
        // Thermal follows demand
        baseLoad = capacity * 0.3
        dailyPattern = (hour >= 6 && hour <= 21) ? capacity * 0.5 : capacity * 0.2
        break
      default:
        baseLoad = capacity * 0.5
        dailyPattern = 0
    }

    const output = Math.max(0, baseLoad + dailyPattern + (Math.random() - 0.5) * capacity * 0.1)
    const variance = capacity * 0.15 * (1 + i / pointsNeeded * 0.5) // Increasing uncertainty

    points.push({
      timestamp: timestamp.toISOString(),
      output_mw: Math.round(output * 100) / 100,
      q10: Math.max(0, Math.round((output - variance) * 100) / 100),
      q50: Math.round(output * 100) / 100,
      q90: Math.round((output + variance) * 100) / 100,
    })
  }

  return points
}

export async function POST(request: NextRequest) {
  try {
    const body: ForecastRequest = await request.json()
    const { plantType, capacity, horizon, historicalData } = body

    // Validate inputs
    if (!plantType || !capacity || capacity <= 0) {
      return NextResponse.json(
        { error: "Invalid request: plantType and capacity are required" },
        { status: 400 }
      )
    }

    // Try to call the FastAPI backend
    try {
      const backendResponse = await fetch(`${BACKEND_URL}/api/forecast/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plant_type: plantType,
          capacity: capacity,
          horizon_hours: horizon || 24,
          historical_data: historicalData,
        }),
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      })

      if (backendResponse.ok) {
        const data = await backendResponse.json()
        return NextResponse.json({
          forecast: data.predictions,
          metadata: {
            ...data.metadata,
            source: "xgboost",
          }
        })
      }
    } catch (backendError) {
      console.log("FastAPI backend unavailable, using mock data")
    }

    // Fallback to mock forecast
    const forecast = generateMockForecast(capacity, horizon || 24, plantType)

    return NextResponse.json({
      forecast,
      metadata: {
        model_type: "mock",
        horizon_hours: horizon || 24,
        interval_minutes: 15,
        plant_type: plantType,
        generated_at: new Date().toISOString(),
        confidence: 0.90,
        source: "mock",
        warning: "Using mock data - connect FastAPI backend for real XGBoost predictions",
      }
    })

  } catch (error) {
    console.error("Forecast API error:", error)
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Health check / info endpoint
  let backendStatus = "unavailable"
  
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    if (response.ok) {
      backendStatus = "healthy"
    }
  } catch {
    backendStatus = "unavailable"
  }

  return NextResponse.json({
    status: "ok",
    backend: backendStatus,
    backend_url: BACKEND_URL,
    capabilities: ["xgboost", "mock"],
    endpoints: {
      POST: "Generate forecast with plantType, capacity, horizon",
    }
  })
}
