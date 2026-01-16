export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Mock data for when backend is unavailable
const mockGridStatus = {
    total_load_mw: 8342,
    renewable_generation_mw: 3891,
    solar_generation_mw: 2156,
    wind_generation_mw: 1735,
    net_load_mw: 4451,
    reserve_margin_mw: 1250,
    frequency: 50.01,
    status: "normal"
};

const generateMockForecast = () => {
    const forecasts = [];
    const baseLoad = 7500;
    const now = new Date();

    for (let i = 0; i < 48; i++) {
        const time = new Date(now.getTime() + i * 30 * 60 * 1000);
        const hour = time.getHours();

        // Simulate daily load pattern
        const hourFactor = Math.sin((hour - 6) * Math.PI / 12) * 0.3 + 1;
        const load = baseLoad * hourFactor + (Math.random() - 0.5) * 500;

        // Solar peaks at noon
        const solarFactor = hour >= 6 && hour <= 18 ? Math.sin((hour - 6) * Math.PI / 12) : 0;
        const solar = 2500 * solarFactor + (Math.random() - 0.5) * 200;

        // Wind is more random
        const wind = 1500 + Math.sin(i * 0.5) * 500 + (Math.random() - 0.5) * 300;

        forecasts.push({
            timestamp: time.toISOString(),
            point: load,
            q10: solar,
            q50: load,
            q90: wind
        });
    }

    return { forecasts };
};

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }

        return response.json();
    } catch (error) {
        console.warn('API unavailable, using mock data:', error);

        // Return mock data based on endpoint
        if (endpoint.includes('/grid/status')) {
            return mockGridStatus;
        }
        if (endpoint.includes('/forecast')) {
            return generateMockForecast();
        }
        if (endpoint.includes('/assets')) {
            return {
                assets: [
                    { id: 1, name: "Hydro Plant Alpha", type: "hydro", status: "online", capacity_mw: 500, current_output_mw: 423, health: 98 },
                    { id: 2, name: "Solar Farm Beta", type: "solar", status: "online", capacity_mw: 250, current_output_mw: 187, health: 95 },
                    { id: 3, name: "Wind Farm Gamma", type: "wind", status: "online", capacity_mw: 300, current_output_mw: 234, health: 92 },
                    { id: 4, name: "Gas Turbine Delta", type: "gas", status: "standby", capacity_mw: 400, current_output_mw: 0, health: 99 }
                ]
            };
        }
        if (endpoint.includes('/scenarios')) {
            return {
                scenarios: [
                    { id: 1, name: "High Solar Day", probability: 0.75, impact: "positive", load_delta_mw: -500 },
                    { id: 2, name: "Cold Front", probability: 0.35, impact: "negative", load_delta_mw: 800 },
                    { id: 3, name: "Industrial Surge", probability: 0.20, impact: "negative", load_delta_mw: 1200 }
                ]
            };
        }
        if (endpoint.includes('/patterns')) {
            return {
                patterns: [
                    { id: 1, name: "Morning Ramp", type: "daily", confidence: 0.92, description: "Load increase 06:00-09:00" },
                    { id: 2, name: "Solar Duck Curve", type: "daily", confidence: 0.88, description: "Net load dip during solar peak" },
                    { id: 3, name: "Weekend Baseline", type: "weekly", confidence: 0.85, description: "20% lower weekend demand" }
                ]
            };
        }

        // Default empty response
        return {};
    }
}
