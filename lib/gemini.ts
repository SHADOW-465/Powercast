// Gemini AI client for SwissFlex AI forecasting and dispatch optimization
// Note: This requires GOOGLE_GENERATIVE_AI_API_KEY environment variable

import type { PortfolioData, Forecast, DispatchSetpoint, Scenario } from "./types"

// Initialize Gemini API (in production, use proper server-side API call)
export async function generateForecast(portfolio: PortfolioData): Promise<Forecast> {
  try {
    // Format portfolio data for Gemini prompt
    const plantData = portfolio.plants.map((p) => `${p.name}: ${p.output}/${p.capacity}MW`).join(", ")
    const hydroStatus = portfolio.plants
      .filter((p) => p.type === "hydro")
      .map((p) => `${p.name}: ${p.reservoirLevel}% full`)
      .join(", ")

    const prompt = `
You are SwissFlex AI forecasting engine. Analyze this Swiss portfolio data:
PLANTS: ${plantData}
HYDRO RESERVOIRS: ${hydroStatus}
CURRENT LOAD: ${portfolio.totalLoad}MW
BALANCING PRICE: ${portfolio.balancingPrice}CHF/MWh

Provide probabilistic forecasts (P10/P50/P90) for next 24h:
- Net load forecast (MW)
- PV generation (MW)
- Hydro flexibility (MWh)
- Balancing needs (MW up/down)

Output valid JSON only:
{
  "forecasts": [{"hour": 1, "netLoad": {"p10": 3800, "p50": 4100, "p90": 4400}, "pvGen": {"p10": 50, "p50": 150, "p90": 250}}],
  "confidence": "high",
  "risks": ["Low reservoir levels", "PV forecast uncertainty", "Grid congestion risk"],
  "recommendations": ["Prepare pumping at Nant de Drance", "Maintain 200MW thermal reserve", "Monitor Grimsel inflow"]
}
`

    // Mock response for demo (in production, call actual Gemini API)
    return {
      timestamp: new Date(),
      netLoad: { p10: 3800, p50: 4100, p90: 4400 },
      pvGeneration: { p10: 50, p50: 250, p90: 450 },
      hydroFlexibility: 1200,
      balancingNeeds: { up: 150, down: 100 },
      confidence: "high",
      risks: ["Low reservoir levels at Laufenburg", "PV forecast uncertainty", "Grid congestion risk at Grimsel"],
      recommendations: [
        "Prepare pumping at Nant de Drance to capture PV surplus",
        "Maintain 200MW thermal reserve for balancing",
        "Monitor Grimsel inflow - risk of spillage if high rainfall",
      ],
    }
  } catch (error) {
    console.error("Forecast generation error:", error)
    throw error
  }
}

export async function generateDispatchSetpoints(
  portfolio: PortfolioData,
  carbonWeight: number,
): Promise<DispatchSetpoint[]> {
  try {
    const prompt = `
You are SwissFlex dispatch optimizer. Current state:
PORTFOLIO: ${JSON.stringify(portfolio.plants)}
CARBON_WEIGHT: ${carbonWeight}% (0=cost-optimal, 100=carbon-minimal)
BALANCING_PRICES: ${portfolio.balancingPrice}CHF/MWh

Recommend dispatch setpoints respecting:
- Ramp rates, min/max output per plant
- Reservoir limits
- Carbon weighting
- Cost efficiency

Output JSON with setpoints for each plant (MW).
`

    // Mock response for demo
    return [
      { plantId: "hydro-1", setpoint: 180, reason: "Optimal for balancing needs and cost" },
      { plantId: "hydro-2", setpoint: 650, reason: "High demand expected, pump standby" },
      { plantId: "hydro-3", setpoint: 300, reason: "Stable output, carbon-optimal" },
      { plantId: "hydro-4", setpoint: 270, reason: "Reserve flexibility maintained" },
      { plantId: "nuclear-1", setpoint: 365, reason: "Baseload must-run" },
      { plantId: "nuclear-2", setpoint: 365, reason: "Baseload must-run" },
      { plantId: "pv-1", setpoint: 380, reason: "Solar peak expected 12:00-15:00" },
      { plantId: "thermal-1", setpoint: 0, reason: "Not needed - clean energy sufficient" },
    ]
  } catch (error) {
    console.error("Dispatch generation error:", error)
    throw error
  }
}

export async function analyzeScenario(
  portfolio: PortfolioData,
  scenario: string,
  baseline: DispatchSetpoint[],
): Promise<Scenario> {
  try {
    const prompt = `
Stress test this portfolio under scenario: ${scenario}
BASELINE: ${JSON.stringify(baseline)}
PORTFOLIO: ${JSON.stringify(portfolio.plants)}

Analyze impact and recommend mitigations.
Output JSON with risk scores (1-10), impacts, and mitigations.
`

    // Mock response for demo
    return {
      name: scenario,
      description: `Analyzing portfolio resilience under ${scenario} conditions`,
      impacts: {
        cost: 250,
        co2: 75,
        reserve: 180,
      },
      mitigations: [
        "Increase hydro reserves for emergency response",
        "Pre-position thermal units for rapid deployment",
        "Secure additional balancing reserves from market",
      ],
    }
  } catch (error) {
    console.error("Scenario analysis error:", error)
    throw error
  }
}
