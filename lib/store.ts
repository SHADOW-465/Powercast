import { create } from "zustand"
import type { AppState, PortfolioData, Forecast } from "./types"
import { createPortfolioData } from "./data"

interface Store extends AppState {
  updatePortfolio: (portfolio: PortfolioData) => void
  updateForecast: (forecast: Forecast) => void
  setCarbonWeight: (weight: number) => void
  setPortfolioFilter: (filter: "full" | "hydro-only" | "pv-only") => void
  setTimeRange: (range: number) => void
}

export const useStore = create<Store>((set) => ({
  portfolio: createPortfolioData(),
  forecast: null,
  setpoints: [],
  carbonWeight: 50,
  portfolioFilter: "full",
  timeRange: 24,
  updatePortfolio: (portfolio) => set({ portfolio }),
  updateForecast: (forecast) => set({ forecast }),
  setCarbonWeight: (carbonWeight) => set({ carbonWeight }),
  setPortfolioFilter: (portfolioFilter) => set({ portfolioFilter }),
  setTimeRange: (timeRange) => set({ timeRange }),
}))
