import type { Plant, PortfolioData } from "./types"

// Swiss synthetic portfolio data
export const createSwissPortfolio = (): Plant[] => {
  return [
    {
      id: "hydro-1",
      name: "Laufenburg",
      type: "hydro",
      capacity: 200,
      output: 150,
      minOutput: 50,
      maxOutput: 200,
      rampRate: 20,
      reservoirLevel: 75,
      reservoirCapacity: 100,
      location: "Rhine, Basel-Landschaft",
    },
    {
      id: "hydro-2",
      name: "Nant de Drance",
      type: "hydro",
      capacity: 900,
      output: 600,
      minOutput: 200,
      maxOutput: 900,
      rampRate: 50,
      reservoirLevel: 65,
      reservoirCapacity: 100,
      location: "Valais",
    },
    {
      id: "hydro-3",
      name: "Grimsel",
      type: "hydro",
      capacity: 400,
      output: 280,
      minOutput: 100,
      maxOutput: 400,
      rampRate: 30,
      reservoirLevel: 82,
      reservoirCapacity: 100,
      location: "Bern",
    },
    {
      id: "hydro-4",
      name: "Göscheneralp",
      type: "hydro",
      capacity: 350,
      output: 240,
      minOutput: 80,
      maxOutput: 350,
      rampRate: 25,
      reservoirLevel: 70,
      reservoirCapacity: 100,
      location: "Uri",
    },
    {
      id: "nuclear-1",
      name: "Beznau I",
      type: "nuclear",
      capacity: 365,
      output: 365,
      minOutput: 100,
      maxOutput: 365,
      rampRate: 5,
      location: "Aargau",
    },
    {
      id: "nuclear-2",
      name: "Beznau II",
      type: "nuclear",
      capacity: 365,
      output: 365,
      minOutput: 100,
      maxOutput: 365,
      rampRate: 5,
      location: "Aargau",
    },
    {
      id: "pv-1",
      name: "Alpine PV Portfolio",
      type: "pv",
      capacity: 500,
      output: 320,
      minOutput: 0,
      maxOutput: 500,
      rampRate: 100,
      location: "Distributed",
    },
    {
      id: "thermal-1",
      name: "Gas Peaker",
      type: "thermal",
      capacity: 300,
      output: 0,
      minOutput: 0,
      maxOutput: 300,
      rampRate: 80,
      location: "Basel",
    },
  ]
}

export const createPortfolioData = (): PortfolioData => {
  const plants = createSwissPortfolio()
  const totalOutput = plants.reduce((sum, p) => sum + p.output, 0)
  const totalLoad = 4200 + Math.random() * 800 // Swiss typical load: 3500-5500 MW

  return {
    plants,
    totalOutput,
    totalLoad,
    timestamp: new Date(),
    balancingPrice: 150 + Math.random() * 100, // CHF/MWh
  }
}

// Simulated real-time data refresh
export const simulatePortfolioUpdate = (current: PortfolioData): PortfolioData => {
  const updated = { ...current }
  updated.plants = current.plants.map((p) => ({
    ...p,
    output: Math.max(p.minOutput, Math.min(p.maxOutput, p.output + (Math.random() - 0.5) * p.rampRate)),
    reservoirLevel: p.reservoirLevel
      ? Math.max(20, Math.min(100, p.reservoirLevel + (Math.random() - 0.5) * 2))
      : undefined,
  }))
  updated.totalOutput = updated.plants.reduce((sum, p) => sum + p.output, 0)
  updated.totalLoad = Math.max(3500, Math.min(5500, current.totalLoad + (Math.random() - 0.5) * 300))
  updated.balancingPrice = Math.max(50, Math.min(300, current.balancingPrice + (Math.random() - 0.5) * 20))
  updated.timestamp = new Date()

  return updated
}
