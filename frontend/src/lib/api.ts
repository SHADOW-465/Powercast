export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ============================================================================
// MOCK DATA FOR DEVELOPMENT / BUILD
// ============================================================================

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

const generateSparkline = () => {
    return Array(24).fill(0).map((_, i) =>
        Math.round(300 + Math.sin(i * 0.5) * 100 + Math.random() * 50)
    );
};

const mockAssets = [
    {
        id: "HYD-001",
        name: "Grande Dixence",
        type: "hydro",
        status: "online",
        capacity: 2000,
        output: 1847,
        health: 98,
        reservoirLevel: 78,
        sparkline: generateSparkline()
    },
    {
        id: "SOL-002",
        name: "Mont Soleil",
        type: "solar",
        status: "online",
        capacity: 500,
        output: 312,
        health: 95,
        sparkline: generateSparkline()
    },
    {
        id: "WND-003",
        name: "Jura Wind Farm",
        type: "wind",
        status: "online",
        capacity: 350,
        output: 234,
        health: 92,
        sparkline: generateSparkline()
    },
    {
        id: "NUC-004",
        name: "Leibstadt NPP",
        type: "nuclear",
        status: "online",
        capacity: 1220,
        output: 1156,
        health: 99,
        sparkline: generateSparkline()
    },
    {
        id: "HYD-005",
        name: "Linth-Limmern",
        type: "hydro",
        status: "online",
        capacity: 1000,
        output: 756,
        health: 96,
        reservoirLevel: 65,
        sparkline: generateSparkline()
    },
    {
        id: "SOL-006",
        name: "Romande Energie Solar",
        type: "solar",
        status: "offline",
        capacity: 200,
        output: 0,
        health: 45,
        sparkline: generateSparkline()
    }
];

const mockScenarios = {
    scenarios: Array(100).fill(0).map((_, i) => ({
        id: i,
        name: `Scenario ${i + 1}`,
        path: Array(96).fill(0).map((_, t) => {
            const baseLoad = 6500;
            const hour = (t * 15 / 60) % 24;
            const loadFactor = 0.8 + Math.sin((hour - 6) * Math.PI / 12) * 0.35;
            return Math.round(baseLoad * loadFactor + (Math.random() - 0.5) * 2000);
        })
    }))
};

const mockPatterns = [
    {
        id: 1,
        name: "Morning Ramp Detection",
        description: "Detected consistent load surge between 06:00-09:00 on weekdays. Pattern suggests industrial startup sequence.",
        icon: "TrendingUp",
        iconColor: "red",
        confidence: 0.92,
        confidenceLabel: "High"
    },
    {
        id: 2,
        name: "Solar Duck Curve",
        description: "Net load dip during solar peak hours (11:00-15:00) creating steep evening ramp requirements.",
        icon: "Sun",
        iconColor: "yellow",
        confidence: 0.88,
        confidenceLabel: "High"
    },
    {
        id: 3,
        name: "Holiday Load Pattern",
        description: "Detected upcoming public holiday on Dec 25. Historical data suggests 18-22% load reduction.",
        icon: "Calendar",
        iconColor: "blue",
        confidence: 0.85,
        confidenceLabel: "Medium"
    },
    {
        id: 4,
        name: "Wind Correlation Alert",
        description: "North Atlantic pressure system approaching. Wind generation expected to increase 40% in next 12h.",
        icon: "Wind",
        iconColor: "blue",
        confidence: 0.78,
        confidenceLabel: "Medium"
    }
];

// ============================================================================
// API FETCH FUNCTION
// ============================================================================

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
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
            return mockAssets;
        }

        if (endpoint.includes('/scenarios')) {
            return mockScenarios;
        }

        if (endpoint.includes('/patterns')) {
            return mockPatterns;
        }

        // Default empty response
        return {};
    }
}
