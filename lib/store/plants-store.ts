import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Plant, PlantType } from "@/lib/types/plant"

interface PlantsState {
  plants: Plant[]
  selectedPlantIds: string[]
  filterType: PlantType | "all"
  
  // Actions
  addPlant: (plant: Plant) => void
  updatePlant: (id: string, updates: Partial<Plant>) => void
  removePlant: (id: string) => void
  setSelectedPlants: (ids: string[]) => void
  setFilterType: (type: PlantType | "all") => void
  
  // Computed helpers
  getPlantsByType: (type: PlantType) => Plant[]
  getTotalOutput: () => number
  getTotalCapacity: () => number
  getFilteredPlants: () => Plant[]
}

export const usePlantsStore = create<PlantsState>()(
  persist(
    (set, get) => ({
      plants: [],
      selectedPlantIds: [],
      filterType: "all",

      addPlant: (plant) =>
        set((state) => ({ plants: [...state.plants, plant] })),

      updatePlant: (id, updates) =>
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
          ),
        })),

      removePlant: (id) =>
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== id),
          selectedPlantIds: state.selectedPlantIds.filter((pid) => pid !== id),
        })),

      setSelectedPlants: (ids) => set({ selectedPlantIds: ids }),

      setFilterType: (type) => set({ filterType: type }),

      getPlantsByType: (type) => get().plants.filter((p) => p.type === type),

      getTotalOutput: () =>
        get().plants.reduce((sum, p) => sum + p.current_output_mw, 0),

      getTotalCapacity: () =>
        get().plants.reduce((sum, p) => sum + p.capacity_mw, 0),
        
      getFilteredPlants: () => {
        const { plants, filterType } = get()
        if (filterType === "all") return plants
        return plants.filter((p) => p.type === filterType)
      },
    }),
    {
      name: "powercast-plants",
    }
  )
)
