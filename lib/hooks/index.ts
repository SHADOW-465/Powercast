// Export all hooks
export { usePlants, usePlant, useCreatePlant, useUpdatePlant, useDeletePlant } from "./use-plants";
export { usePlantForecast, useMLForecast, useWeatherForecast, useGridPrices } from "./use-forecasts";
export {
  useOptimizationSuggestions,
  useOptimizationSummary,
  useApplySuggestion,
  useDismissSuggestion,
  useGenerateSuggestions,
} from "./use-optimization";
export { useAuth, useRequireAuth } from "./use-auth";
