"use client";

/**
 * Powercast AI - Forecast Hooks
 * React Query hooks for forecast data
 */
import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ForecastData } from "@/lib/supabase/database.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =========================================
// Types
// =========================================

interface ForecastPoint {
  timestamp: string;
  output_mw: number;
  q10?: number;
  q50?: number;
  q90?: number;
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  cloud_cover?: number;
  irradiance?: number;
}

interface PlantForecast {
  plant_id: string;
  forecasts: ForecastPoint[];
}

interface MLForecastRequest {
  plant_ids?: string[];
  horizon?: number;
}

interface MLForecastResponse {
  timestamp: string;
  forecasts: {
    plant_id: string;
    predictions: ForecastPoint[];
  }[];
}

// =========================================
// API Functions
// =========================================

async function fetchPlantForecast(
  plantId: string,
  hours: number = 24
): Promise<PlantForecast> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("forecast_data")
      .select("*")
      .eq("plant_id", plantId)
      .order("timestamp", { ascending: true })
      .limit(hours * 4); // 15-min intervals

    if (error) throw error;

    return {
      plant_id: plantId,
      forecasts: (data as ForecastData[]) || [],
    };
  }

  const response = await fetch(
    `${API_BASE}/api/v1/plants/${plantId}/forecast?hours=${hours}`
  );
  if (!response.ok) throw new Error("Failed to fetch forecast");

  return response.json();
}

async function fetchMLForecast(
  request?: MLForecastRequest
): Promise<MLForecastResponse> {
  const params = new URLSearchParams();
  if (request?.horizon) params.set("horizon", String(request.horizon));

  const response = await fetch(
    `${API_BASE}/api/v1/forecast?${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plant_ids: request?.plant_ids }),
    }
  );

  if (!response.ok) {
    // Fall back to mock data if ML endpoint fails
    return generateMockForecast(request?.plant_ids || [], request?.horizon || 96);
  }

  return response.json();
}

async function fetchWeatherForecast(
  lat: number = 47.3769,
  lon: number = 8.5417,
  hours: number = 48
) {
  const response = await fetch(
    `${API_BASE}/api/v1/weather/forecast?lat=${lat}&lon=${lon}&hours=${hours}`
  );

  if (!response.ok) throw new Error("Failed to fetch weather forecast");

  return response.json();
}

async function fetchGridPrices(area: string = "CH", hours: number = 24) {
  const response = await fetch(
    `${API_BASE}/api/v1/grid/prices?area=${area}&hours=${hours}`
  );

  if (!response.ok) throw new Error("Failed to fetch grid prices");

  return response.json();
}

// =========================================
// Mock Data Generator
// =========================================

function generateMockForecast(
  plantIds: string[],
  horizon: number
): MLForecastResponse {
  const now = new Date();
  const forecasts = plantIds.map((plantId) => {
    const predictions: ForecastPoint[] = [];
    let baseOutput = 100 + Math.random() * 400;

    for (let i = 0; i < horizon; i++) {
      const timestamp = new Date(now.getTime() + i * 15 * 60 * 1000);
      const hour = timestamp.getHours();

      // Simulate daily pattern
      const hourFactor = 1 + 0.3 * (1 - Math.abs(12 - hour) / 12);
      const output = baseOutput * hourFactor * (0.9 + Math.random() * 0.2);

      predictions.push({
        timestamp: timestamp.toISOString(),
        output_mw: Math.round(output * 10) / 10,
        q10: Math.round(output * 0.85 * 10) / 10,
        q50: Math.round(output * 10) / 10,
        q90: Math.round(output * 1.15 * 10) / 10,
        temperature: 15 + 10 * Math.sin((hour - 6) * Math.PI / 12),
      });
    }

    return { plant_id: plantId, predictions };
  });

  return {
    timestamp: now.toISOString(),
    forecasts,
  };
}

// =========================================
// Hooks
// =========================================

/**
 * Hook to fetch forecast for a specific plant
 */
export function usePlantForecast(plantId: string, hours: number = 24) {
  return useQuery({
    queryKey: ["forecast", plantId, hours],
    queryFn: () => fetchPlantForecast(plantId, hours),
    enabled: !!plantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch ML-powered forecasts for multiple plants
 */
export function useMLForecast(request?: MLForecastRequest) {
  return useQuery({
    queryKey: ["ml-forecast", request?.plant_ids, request?.horizon],
    queryFn: () => fetchMLForecast(request),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch weather forecast
 */
export function useWeatherForecast(
  lat?: number,
  lon?: number,
  hours: number = 48
) {
  return useQuery({
    queryKey: ["weather", lat, lon, hours],
    queryFn: () => fetchWeatherForecast(lat, lon, hours),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to fetch grid electricity prices
 */
export function useGridPrices(area: string = "CH", hours: number = 24) {
  return useQuery({
    queryKey: ["grid-prices", area, hours],
    queryFn: () => fetchGridPrices(area, hours),
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}
