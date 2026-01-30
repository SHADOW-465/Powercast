# Fix Forecast Chart Brush Interaction

## TL;DR
> **Summary**: Fix the "snap back" bug in the forecast chart scroll bar (Brush) by adding local state management.
> **Deliverables**: Updated `forecast-chart.tsx` with stateful Brush handling.
> **Estimated Effort**: Quick (1 file)

---

## Context
User reported that the drag handle on the forecast chart reverts to its original position when dragged, preventing them from scrolling through the full forecast duration.

### Root Cause
The `Brush` component in `components/charts/forecast-chart.tsx` is being used as a controlled component (passing `startIndex`/`endIndex`) but lacks an `onChange` handler to update those values. This forces the component to reset to the initial calculated values on every render/update.

---

## Work Objectives

### Core Objective
Make the forecast chart scrollable brush interactive and persistent.

### Definition of Done
- [ ] User can drag the brush handle to scroll through the forecast
- [ ] Brush position stays where the user left it
- [ ] Brush resets correctly when a NEW forecast is loaded (data length changes)

---

## TODOs

- [ ] 1. Update `components/charts/forecast-chart.tsx` to add state management for Brush

  **What to do**:
  - Add `const [brushRange, setBrushRange] = useState(...)` to `ForecastChart`
  - Replace `initialBrushRange` `useMemo` with a `useEffect` that updates `brushRange` when `chartData.length` changes
  - Update `Brush` component props:
    - Pass `startIndex={brushRange?.startIndex}`
    - Pass `endIndex={brushRange?.endIndex}`
    - Add `onChange={(e) => setBrushRange({ startIndex: e.startIndex, endIndex: e.endIndex })}`

  **References**:
  - `components/charts/forecast-chart.tsx` lines 107-113 (current memo logic)
  - `components/charts/forecast-chart.tsx` lines 207-217 (Brush component)

  **Code Pattern**:
  ```typescript
  // New State
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | undefined>(undefined)

  // Effect to reset when data changes (e.g. new horizon)
  useEffect(() => {
    if (!shouldShowBrush || chartData.length === 0) {
      setBrushRange(undefined)
      return
    }
    // Default: Show first 96 points (24 hours)
    const endIndex = Math.min(96, chartData.length - 1)
    setBrushRange({ startIndex: 0, endIndex })
  }, [shouldShowBrush, chartData.length])

  // ... inside JSX ...
  <Brush
    // ... other props
    startIndex={brushRange?.startIndex}
    endIndex={brushRange?.endIndex}
    onChange={(e) => setBrushRange({ startIndex: e.startIndex, endIndex: e.endIndex })}
  />
  ```

  **Verification**:
  - Load a long forecast (e.g., 12 weeks)
  - Drag the scroll bar
  - Confirm it stays in the new position
  - Switch to a different horizon (e.g. 6h) and back to 12w
  - Confirm it resets to the start

---

## Success Criteria
- [ ] Brush scroll works smoothly without reverting
- [ ] Initial view still shows the first 24h (96 points) as intended
