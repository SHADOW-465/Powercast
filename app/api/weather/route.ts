import { NextRequest, NextResponse } from "next/server"

// OpenWeatherMap API integration
// For production, set OPENWEATHERMAP_API_KEY in environment variables

interface WeatherResponse {
  temperature: number
  humidity: number
  windSpeed: number
  cloudCover: number
  condition: string
  icon: string
  fetchedAt: string
}

// Mock weather data for demo (when no API key is configured)
function generateMockWeather(lat: number, lon: number): WeatherResponse {
  // Generate realistic weather based on latitude (rough climate zones)
  const isNorthern = lat > 30
  const baseTemp = isNorthern ? 15 : 25
  const tempVariation = Math.random() * 15 - 7.5
  
  const conditions = [
    { condition: "Clear", icon: "01d", cloudCover: 5 },
    { condition: "Few clouds", icon: "02d", cloudCover: 20 },
    { condition: "Scattered clouds", icon: "03d", cloudCover: 45 },
    { condition: "Broken clouds", icon: "04d", cloudCover: 70 },
    { condition: "Overcast", icon: "04d", cloudCover: 90 },
  ]
  
  const selected = conditions[Math.floor(Math.random() * conditions.length)]
  
  return {
    temperature: Math.round((baseTemp + tempVariation) * 10) / 10,
    humidity: Math.round(40 + Math.random() * 40),
    windSpeed: Math.round((2 + Math.random() * 8) * 10) / 10,
    cloudCover: selected.cloudCover,
    condition: selected.condition,
    icon: selected.icon,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchRealWeather(lat: number, lon: number, apiKey: string): Promise<WeatherResponse> {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`)
  }
  
  const data = await response.json()
  
  return {
    temperature: Math.round(data.main.temp * 10) / 10,
    humidity: data.main.humidity,
    windSpeed: Math.round(data.wind.speed * 10) / 10,
    cloudCover: data.clouds.all,
    condition: data.weather[0]?.description || "Unknown",
    icon: data.weather[0]?.icon || "01d",
    fetchedAt: new Date().toISOString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get("lat") || "0")
    const lon = parseFloat(searchParams.get("lon") || "0")
    
    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      )
    }
    
    const apiKey = process.env.OPENWEATHERMAP_API_KEY
    
    let weather: WeatherResponse
    
    if (apiKey) {
      // Use real OpenWeatherMap API
      weather = await fetchRealWeather(lat, lon, apiKey)
    } else {
      // Use mock data for demo
      weather = generateMockWeather(lat, lon)
    }
    
    return NextResponse.json(weather)
  } catch (error) {
    console.error("Weather API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    )
  }
}
