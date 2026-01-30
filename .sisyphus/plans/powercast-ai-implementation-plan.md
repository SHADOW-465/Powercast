# Powercast AI Implementation Plan

## 1. Project Overview
Powercast AI is a multi-plant power forecasting command center dashboard designed for grid operators and energy managers. It provides a comprehensive view of energy generation, AI-driven optimization suggestions, and advanced forecasting capabilities with a premium Neumorphic (Soft UI) aesthetic.

## 2. Core Requirements
- **Name**: Powercast AI
- **UI Style**: Neumorphic / Soft UI (Light & Dark)
- **Navigation**: Top Tabs (Dashboard, Forecasts, Plants, Optimize, Data)
- **Tech Stack**: Next.js 15+, React 19, Tailwind v4 (OKLCH), Recharts, Zustand, Radix UI
- **Timeline Range**: 15m → 12 Months
- **Data Support**: Multi-plant (Solar, Hydro, Thermal, Nuclear, Wind) with CSV uploads

## 3. Design System & Theme Foundation

### 3.1 Neumorphic Color Tokens (OKLCH)
We will define semantic tokens that work across both themes to prevent "invisible text" issues.

| Token | Light Mode (OKLCH) | Dark Mode (OKLCH) | Description |
|-------|--------------------|-------------------|-------------|
| `--background` | `0.94 0.01 240` (#e4ebf5) | `0.18 0.02 240` (#1a1d24) | Main page background |
| `--surface` | `0.94 0.01 240` | `0.21 0.02 240` | Card surface |
| `--shadow-light` | `1.0 0 0` (#ffffff) | `0.25 0.02 240` (#252a33) | Top-left shadow |
| `--shadow-dark` | `0.85 0.02 240` (#c8d0dc) | `0.12 0.02 240` (#12141a) | Bottom-right shadow |
| `--text-primary`| `0.25 0.02 240` (#1e293b) | `0.96 0.01 240` (#f1f5f9) | Main headings |
| `--text-secondary`| `0.45 0.02 240` (#475569) | `0.85 0.02 240` (#cbd5e1) | Regular text |
| `--text-muted` | `0.60 0.02 240` (#64748b) | `0.70 0.02 240` (#94a3b8) | Subtle labels |

### 3.2 Plant Specific Colors
- **Solar**: `oklch(0.85 0.20 85)` (Amber)
- **Hydro**: `oklch(0.75 0.15 200)` (Cyan)
- **Thermal**: `oklch(0.65 0.25 25)` (Red)
- **Nuclear**: `oklch(0.60 0.20 300)` (Purple)
- **Wind**: `oklch(0.75 0.20 150)` (Green)

### 3.3 Theme Transition Fix
To ensure no invisible text and smooth transitions:
1. **Semantic Enforcement**: Use only `text-primary`, `text-secondary`, etc. Never use raw hex or Tailwind defaults like `text-slate-900`.
2. **Transition Blocking**: Apply `transition-none` to the root briefly during theme toggle to prevent color flashing.
3. **Contrast Verification**: Ensure all foreground/background pairs meet WCAG AA (4.5:1) in both modes.

## 4. Implementation Phases

### Phase 1: Foundation (The "Neumorphic" Core)
- [ ] **Styles**: Update `globals.css` with OKLCH tokens and neumorphic utilities (`.neu-flat`, `.neu-inset`, `.neu-convex`).
- [ ] **Theme Provider**: Implement a robust `ThemeProvider` using `next-themes` that handles system preferences and manual overrides without FOUC (Flash of Unstyled Content).
- [ ] **UI Components**: Build `NeuCard`, `NeuButton`, `NeuInput`, and `NeuTabs` using Radix primitives.

### Phase 2: Navigation & Shell
- [ ] **Header**: Implement a fixed top bar with the Powercast AI logo, global timeline selector, and theme toggle.
- [ ] **Tab Bar**: Create the primary navigation below the header using a sticky Neumorphic tab system.
- [ ] **Layout**: Set up the main content area with smooth page transitions between tabs.

### Phase 3: Dashboard (Command Center)
- [ ] **KPI Grid**: 6 responsive neumorphic cards showing real-time metrics.
- [ ] **Multi-Plant Overview**: Summary grid showing status and current output for each plant type.
- [ ] **Quick Forecast**: A 24h mini area chart using Recharts with a custom neumorphic tooltip.
- [ ] **Alerts Panel**: A list of active system notifications with priority colors.

### Phase 4: Data & CSV Layer
- [ ] **Zustand Store**: Define `usePlantStore` to manage plant metadata and uploaded data.
- [ ] **CSV Uploader**: Implement a drag-and-drop zone with validation for the 5 plant types.
- [ ] **Data Validator**: Check for date overlaps, missing values, and scale issues before committing to store.
- [ ] **Plant Manager**: A UI for adding/removing/editing plant configurations (Capacity, Type, Location).

### Phase 5: Forecasts & Visualization
- [ ] **Timeline Engine**: Build a utility to handle 15m to 12-month aggregations.
- [ ] **Main Forecast Chart**: Advanced Recharts implementation with Confidence Bands (Q10/Q50/Q90) and interactive legend.
- [ ] **Plant Selector**: A filter panel to toggle individual plants or categories on the chart.
- [ ] **Forecast Table**: A sortable, exportable grid for raw forecast data.

### Phase 6: Optimization (AI Engine)
- [ ] **Optimization Dashboard**: Cards showing potential efficiency gains and CO2 reductions.
- [ ] **Suggestion Cards**: A prioritized list of AI recommendations with "Apply" functionality.
- [ ] **What-If Slider**: A neumorphic slider to simulate grid conditions (e.g., "What if solar drops by 30%?").

### Phase 7: Polish & Deployment
- [ ] **Skeleton States**: Add neumorphic loading placeholders for all tabs.
- [ ] **Micro-animations**: Add subtle `hover:scale-[1.02]` and `active:scale-[0.98]` effects to buttons and cards.
- [ ] **Mobile Responsiveness**: Ensure the top tabs collapse into a menu or scroll horizontally on mobile.
- [ ] **Production Build**: Final audit of types and linting.

## 5. File Structure (Target)

```text
app/
├── layout.tsx              # Root shell with Header
├── page.tsx                # Tab manager (Dashboard by default)
├── globals.css             # OKLCH Neumorphic Design System
components/
├── ui/                     # Neumorphic Primitives
│   ├── neu-card.tsx
│   ├── neu-button.tsx
│   ├── neu-tabs.tsx
│   └── theme-toggle.tsx
├── dashboard/              # Dashboard Components
├── forecasts/              # Forecast Components
├── plants/                 # Plant Management
├── optimization/           # AI Recommendations
└── shared/                 # Charts, Tables, Alerts
lib/
├── store/                  # Zustand (Plants, Forecasts, UI)
├── hooks/                  # useTimeline, useCSVParser
├── utils/                  # formatting, date-handling
└── types/                  # Plant, Forecast, Optimization
```

## 6. Success Metrics
- **Zero "Invisible Text"**: 100% visibility during theme transitions.
- **CSV Robustness**: Handles 100k+ rows without UI lag.
- **Design Consistency**: Neumorphic shadows are consistent across all components.
- **Performance**: Lighthouse score > 90 for Performance and Accessibility.

---
*Created on: 2026-01-19*
*Version: 1.0.0*


---

## 7. Detailed Component Specifications

### 7.1 Complete globals.css (Neumorphic Design System)

```css
/* ============================================
   POWERCAST AI - NEUMORPHIC DESIGN SYSTEM
   ============================================ */

@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ============================================
   THEME TOKENS - CRITICAL FOR TRANSITIONS
   ============================================ 
   RULE: NEVER use raw colors like #fff, #000, text-white, text-black
   ALWAYS use semantic tokens: text-[var(--text-primary)], bg-[var(--background)]
*/

/* LIGHT THEME */
:root,
.light {
  /* Surface Colors */
  --background: oklch(0.94 0.01 240);      /* #e4ebf5 */
  --background-secondary: oklch(0.91 0.01 240);
  --surface: oklch(0.94 0.01 240);
  --surface-elevated: oklch(0.96 0.01 240);
  
  /* Neumorphic Shadows - CRITICAL for soft UI */
  --shadow-light: oklch(1.0 0 0);           /* #ffffff */
  --shadow-dark: oklch(0.85 0.02 240);      /* #c8d0dc */
  
  /* Text Colors - EXHAUSTIVE LIST */
  --text-primary: oklch(0.25 0.02 240);     /* #1e293b */
  --text-secondary: oklch(0.45 0.02 240);   /* #475569 */
  --text-muted: oklch(0.55 0.02 240);       /* #64748b */
  --text-subtle: oklch(0.65 0.02 240);      /* #94a3b8 */
  --text-inverted: oklch(0.98 0.01 240);    /* #f8fafc - for buttons */
  
  /* Accent Colors */
  --accent-primary: oklch(0.60 0.20 250);   /* Blue */
  --accent-primary-hover: oklch(0.55 0.22 250);
  --accent-success: oklch(0.70 0.18 160);   /* Green */
  --accent-warning: oklch(0.80 0.18 85);    /* Amber */
  --accent-danger: oklch(0.60 0.22 25);     /* Red */
  
  /* Plant-Specific Colors */
  --plant-solar: oklch(0.80 0.18 85);
  --plant-solar-bg: oklch(0.95 0.05 85);
  --plant-hydro: oklch(0.75 0.15 200);
  --plant-hydro-bg: oklch(0.95 0.04 200);
  --plant-nuclear: oklch(0.60 0.18 300);
  --plant-nuclear-bg: oklch(0.95 0.04 300);
  --plant-thermal: oklch(0.65 0.22 25);
  --plant-thermal-bg: oklch(0.95 0.05 25);
  --plant-wind: oklch(0.70 0.18 150);
  --plant-wind-bg: oklch(0.95 0.04 150);
  
  /* Borders */
  --border-subtle: oklch(0.90 0.01 240);
  --border-default: oklch(0.85 0.02 240);
  
  /* Chart Colors */
  --chart-grid: oklch(0.90 0.01 240);
  --chart-axis: oklch(0.55 0.02 240);
  --chart-tooltip-bg: oklch(1.0 0 0);
  --chart-tooltip-border: oklch(0.90 0.01 240);
}

/* DARK THEME */
.dark {
  /* Surface Colors */
  --background: oklch(0.18 0.02 250);       /* #1a1d24 */
  --background-secondary: oklch(0.22 0.02 250);
  --surface: oklch(0.20 0.02 250);          /* #1e2229 */
  --surface-elevated: oklch(0.25 0.02 250);
  
  /* Neumorphic Shadows - Adjusted for dark */
  --shadow-light: oklch(0.25 0.02 250);     /* #252a33 */
  --shadow-dark: oklch(0.10 0.02 250);      /* #12141a */
  
  /* Text Colors - MUST MATCH ALL LIGHT THEME TOKENS */
  --text-primary: oklch(0.96 0.01 240);     /* #f1f5f9 */
  --text-secondary: oklch(0.85 0.02 240);   /* #cbd5e1 */
  --text-muted: oklch(0.70 0.02 240);       /* #94a3b8 */
  --text-subtle: oklch(0.55 0.02 240);      /* #64748b */
  --text-inverted: oklch(0.20 0.02 240);    /* #1e293b */
  
  /* Accent Colors (brighter for dark bg) */
  --accent-primary: oklch(0.70 0.18 250);
  --accent-primary-hover: oklch(0.75 0.16 250);
  --accent-success: oklch(0.75 0.16 160);
  --accent-warning: oklch(0.85 0.16 85);
  --accent-danger: oklch(0.70 0.20 25);
  
  /* Plant-Specific Colors (brighter) */
  --plant-solar: oklch(0.85 0.16 85);
  --plant-solar-bg: oklch(0.25 0.06 85);
  --plant-hydro: oklch(0.80 0.14 200);
  --plant-hydro-bg: oklch(0.25 0.05 200);
  --plant-nuclear: oklch(0.70 0.16 300);
  --plant-nuclear-bg: oklch(0.25 0.05 300);
  --plant-thermal: oklch(0.75 0.18 25);
  --plant-thermal-bg: oklch(0.25 0.06 25);
  --plant-wind: oklch(0.80 0.16 150);
  --plant-wind-bg: oklch(0.25 0.05 150);
  
  /* Borders */
  --border-subtle: oklch(0.28 0.02 250);
  --border-default: oklch(0.32 0.02 250);
  
  /* Chart Colors */
  --chart-grid: oklch(0.25 0.02 250);
  --chart-axis: oklch(0.65 0.02 240);
  --chart-tooltip-bg: oklch(0.22 0.02 250);
  --chart-tooltip-border: oklch(0.30 0.02 250);
}

/* ============================================
   NEUMORPHIC UTILITY CLASSES
   ============================================ */

/* Raised Card (default neumorphic) */
.neu-raised {
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 
    8px 8px 16px var(--shadow-dark),
    -8px -8px 16px var(--shadow-light);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.neu-raised:hover {
  box-shadow: 
    10px 10px 20px var(--shadow-dark),
    -10px -10px 20px var(--shadow-light);
}

/* Flat with subtle shadow */
.neu-flat {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 
    4px 4px 8px var(--shadow-dark),
    -4px -4px 8px var(--shadow-light);
}

/* Pressed/Inset (for inputs, active states) */
.neu-inset {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 
    inset 4px 4px 8px var(--shadow-dark),
    inset -4px -4px 8px var(--shadow-light);
}

/* Pressed state for buttons */
.neu-pressed {
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 
    inset 2px 2px 4px var(--shadow-dark),
    inset -2px -2px 4px var(--shadow-light);
}

/* Convex (for circular buttons, toggles) */
.neu-convex {
  background: linear-gradient(
    145deg,
    var(--shadow-light),
    var(--shadow-dark)
  );
  border-radius: 50%;
}

/* Concave (for circular indicators) */
.neu-concave {
  background: linear-gradient(
    145deg,
    var(--shadow-dark),
    var(--shadow-light)
  );
  border-radius: 50%;
}

/* ============================================
   THEME TRANSITION HANDLING
   ============================================ */

/* Default smooth transitions */
* {
  transition-property: background-color, border-color, color, fill, stroke, box-shadow;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

/* Block transitions during theme switch to prevent flash */
.theme-transitioning,
.theme-transitioning * {
  transition: none !important;
}

/* ============================================
   BASE STYLES
   ============================================ */

body {
  background-color: var(--background);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Ensure all text elements use semantic tokens */
h1, h2, h3, h4, h5, h6 {
  color: var(--text-primary);
}

p, span, label {
  color: var(--text-secondary);
}

/* Override any Tailwind defaults that might break theme */
.text-foreground { color: var(--text-primary) !important; }
.text-muted-foreground { color: var(--text-muted) !important; }
.bg-background { background-color: var(--background) !important; }
.bg-card { background-color: var(--surface) !important; }
```

### 7.2 Theme Provider with Transition Fix

```tsx
// components/providers/theme-provider.tsx
"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = "powercast-theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light")
  const [mounted, setMounted] = useState(false)

  // Get system preference
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }, [])

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement
    
    // Block transitions during theme switch
    root.classList.add("theme-transitioning")
    
    // Remove existing theme classes
    root.classList.remove("light", "dark")
    
    // Determine resolved theme
    const resolved: ResolvedTheme = newTheme === "system" ? getSystemTheme() : newTheme
    
    // Apply new theme class
    root.classList.add(resolved)
    setResolvedTheme(resolved)
    
    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute("content", resolved === "dark" ? "#1a1d24" : "#e4ebf5")
    }
    
    // Re-enable transitions after 2 frames
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-transitioning")
      })
    })
  }, [getSystemTheme])

  // Set theme and persist
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme)
  }, [applyTheme])

  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial = stored || "system"
    setThemeState(initial)
    applyTheme(initial)
    setMounted(true)
  }, [applyTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyTheme("system")

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, applyTheme])

  // Prevent hydration mismatch by hiding content until mounted
  if (!mounted) {
    return (
      <div style={{ visibility: "hidden", height: "100vh" }}>
        {children}
      </div>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
```

### 7.3 Top Tab Navigation Component

```tsx
// components/layout/tab-navigation.tsx
"use client"

import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  TrendingUp, 
  Factory, 
  Sparkles, 
  Database 
} from "lucide-react"

type TabId = "dashboard" | "forecasts" | "plants" | "optimize" | "data"

interface TabNavigationProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "forecasts", label: "Forecasts", icon: TrendingUp },
  { id: "plants", label: "Plants", icon: Factory },
  { id: "optimize", label: "Optimize", icon: Sparkles },
  { id: "data", label: "Data", icon: Database },
]

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="sticky top-16 z-40 bg-[var(--background)] border-b border-[var(--border-default)] px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "neu-pressed text-[var(--accent-primary)]"
                    : "neu-flat text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:scale-[1.02]"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
```

### 7.4 Main Page with Tab Content

```tsx
// app/page.tsx
"use client"

import { useState } from "react"
import { TabNavigation } from "@/components/layout/tab-navigation"
import { DashboardTab } from "@/components/dashboard/dashboard-tab"
import { ForecastsTab } from "@/components/forecasts/forecasts-tab"
import { PlantsTab } from "@/components/plants/plants-tab"
import { OptimizeTab } from "@/components/optimization/optimize-tab"
import { DataTab } from "@/components/data/data-tab"

type TabId = "dashboard" | "forecasts" | "plants" | "optimize" | "data"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard")

  return (
    <>
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "forecasts" && <ForecastsTab />}
        {activeTab === "plants" && <PlantsTab />}
        {activeTab === "optimize" && <OptimizeTab />}
        {activeTab === "data" && <DataTab />}
      </main>
    </>
  )
}
```

### 7.5 Header Component

```tsx
// components/layout/header.tsx
"use client"

import { Zap } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TimelineSelector } from "@/components/shared/timeline-selector"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[var(--surface)] border-b border-[var(--border-default)] neu-flat">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl neu-convex flex items-center justify-center bg-[var(--accent-primary)]">
            <Zap className="w-5 h-5 text-[var(--text-inverted)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Powercast AI</h1>
            <p className="text-xs text-[var(--text-muted)]">Command Center</p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4">
          <TimelineSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
```

### 7.6 Timeline Controls (Full Range: 15min to 12 months)

```tsx
// components/forecasts/timeline-controls.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { NeuButton } from "@/components/ui/neu-button"

export type TimeUnit = "min" | "hour" | "day" | "week" | "month"

export interface TimelineValue {
  unit: TimeUnit
  count: number
}

interface TimelineControlsProps {
  value: TimelineValue
  onChange: (value: TimelineValue) => void
  maxMonths?: number
}

const PRESETS: { label: string; unit: TimeUnit; count: number }[] = [
  { label: "15m", unit: "min", count: 15 },
  { label: "1h", unit: "hour", count: 1 },
  { label: "6h", unit: "hour", count: 6 },
  { label: "24h", unit: "hour", count: 24 },
  { label: "7d", unit: "day", count: 7 },
  { label: "30d", unit: "day", count: 30 },
  { label: "3mo", unit: "month", count: 3 },
  { label: "6mo", unit: "month", count: 6 },
  { label: "12mo", unit: "month", count: 12 },
]

const UNIT_OPTIONS: { value: TimeUnit; label: string }[] = [
  { value: "min", label: "Minutes" },
  { value: "hour", label: "Hours" },
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" },
]

export function TimelineControls({ value, onChange, maxMonths = 12 }: TimelineControlsProps) {
  const [isCustom, setIsCustom] = useState(false)
  const [customCount, setCustomCount] = useState(1)
  const [customUnit, setCustomUnit] = useState<TimeUnit>("day")

  const currentPreset = PRESETS.find(
    (p) => p.unit === value.unit && p.count === value.count
  )

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setIsCustom(false)
    onChange({ unit: preset.unit, count: preset.count })
  }

  const handleCustomApply = () => {
    let finalCount = customCount
    if (customUnit === "month" && customCount > maxMonths) {
      finalCount = maxMonths
    }
    onChange({ unit: customUnit, count: finalCount })
  }

  const formatDisplay = (val: TimelineValue): string => {
    const unitLabels: Record<TimeUnit, [string, string]> = {
      min: ["minute", "minutes"],
      hour: ["hour", "hours"],
      day: ["day", "days"],
      week: ["week", "weeks"],
      month: ["month", "months"],
    }
    const [singular, plural] = unitLabels[val.unit]
    return `${val.count} ${val.count === 1 ? singular : plural}`
  }

  return (
    <div className="neu-raised p-4 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Forecast Horizon
        </h3>
        <span className="text-sm font-medium text-[var(--accent-primary)]">
          {formatDisplay(value)}
        </span>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              currentPreset?.label === preset.label && !isCustom
                ? "neu-pressed text-[var(--accent-primary)]"
                : "neu-flat text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            isCustom
              ? "neu-pressed text-[var(--accent-primary)]"
              : "neu-flat text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          Custom
        </button>
      </div>

      {/* Custom Input */}
      {isCustom && (
        <div className="flex items-center gap-3 p-3 neu-inset rounded-xl">
          <input
            type="number"
            min={1}
            max={customUnit === "month" ? maxMonths : 999}
            value={customCount}
            onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 px-3 py-2 neu-raised rounded-lg text-center 
                       text-[var(--text-primary)] bg-[var(--surface)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <select
            value={customUnit}
            onChange={(e) => setCustomUnit(e.target.value as TimeUnit)}
            className="px-3 py-2 neu-raised rounded-lg text-[var(--text-primary)]
                       bg-[var(--surface)] focus:outline-none 
                       focus:ring-2 focus:ring-[var(--accent-primary)]"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <NeuButton size="sm" onClick={handleCustomApply}>
            Apply
          </NeuButton>
        </div>
      )}
    </div>
  )
}
```

### 7.7 CSV Uploader with Plant Type Selection

```tsx
// components/data/csv-uploader.tsx
"use client"

import { useState, useCallback } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from "lucide-react"
import { NeuCard } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { cn } from "@/lib/utils"
import { PlantType } from "@/lib/types/plant"

interface CSVUploaderProps {
  onUpload: (file: File, plantType: PlantType, plantName: string) => Promise<void>
}

const PLANT_TYPES: { value: PlantType; label: string; color: string }[] = [
  { value: "solar", label: "Solar", color: "var(--plant-solar)" },
  { value: "hydro", label: "Hydro", color: "var(--plant-hydro)" },
  { value: "nuclear", label: "Nuclear", color: "var(--plant-nuclear)" },
  { value: "thermal", label: "Thermal", color: "var(--plant-thermal)" },
  { value: "wind", label: "Wind", color: "var(--plant-wind)" },
]

export function CSVUploader({ onUpload }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [plantType, setPlantType] = useState<PlantType>("solar")
  const [plantName, setPlantName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setError(null)
    setSuccess(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      setFile(droppedFile)
      if (!plantName) {
        setPlantName(droppedFile.name.replace(".csv", ""))
      }
    } else {
      setError("Please upload a CSV file")
    }
  }, [plantName])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(false)
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".csv")) {
      setFile(selectedFile)
      if (!plantName) {
        setPlantName(selectedFile.name.replace(".csv", ""))
      }
    } else {
      setError("Please upload a CSV file")
    }
  }

  const handleUpload = async () => {
    if (!file) return
    
    setUploading(true)
    setError(null)
    
    try {
      await onUpload(file, plantType, plantName || file.name.replace(".csv", ""))
      setSuccess(true)
      setFile(null)
      setPlantName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setError(null)
    setSuccess(false)
  }

  return (
    <NeuCard className="p-6">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-[var(--accent-primary)]" />
        Upload Forecast Data
      </h3>

      {/* Plant Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
          Plant Type
        </label>
        <div className="flex flex-wrap gap-2">
          {PLANT_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPlantType(pt.value)}
              className={cn(
                "px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                plantType === pt.value
                  ? "neu-pressed"
                  : "neu-flat hover:scale-[1.02]"
              )}
              style={{
                color: plantType === pt.value ? pt.color : "var(--text-secondary)",
              }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: pt.color }}
              />
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plant Name Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
          Plant Name
        </label>
        <input
          type="text"
          value={plantName}
          onChange={(e) => setPlantName(e.target.value)}
          placeholder="e.g., Solar Farm Alpha"
          className="w-full px-4 py-3 neu-inset rounded-xl text-[var(--text-primary)]
                     placeholder:text-[var(--text-subtle)] bg-transparent
                     focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all",
          isDragging
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
            : "border-[var(--border-default)] hover:border-[var(--accent-primary)]/50"
        )}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-[var(--accent-primary)]" />
            <div className="text-left">
              <p className="font-medium text-[var(--text-primary)]">{file.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearFile()
              }}
              className="p-1 neu-flat rounded-lg hover:scale-110 transition-transform"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-primary)] font-medium mb-1">
              Drag & drop your CSV file here
            </p>
            <p className="text-sm text-[var(--text-muted)]">or click to browse</p>
          </>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-[var(--accent-danger)]/10 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[var(--accent-danger)]" />
          <p className="text-sm text-[var(--text-primary)]">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 rounded-xl bg-[var(--accent-success)]/10 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-[var(--accent-success)]" />
          <p className="text-sm text-[var(--text-primary)]">Upload successful!</p>
        </div>
      )}

      {/* Upload Button */}
      {file && (
        <NeuButton
          className="w-full mt-4"
          onClick={handleUpload}
          loading={uploading}
          disabled={uploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload {plantType.charAt(0).toUpperCase() + plantType.slice(1)} Data
        </NeuButton>
      )}
    </NeuCard>
  )
}
```

## 8. TypeScript Type Definitions

```tsx
// lib/types/plant.ts
export type PlantType = "solar" | "hydro" | "nuclear" | "thermal" | "wind"

export interface Plant {
  id: string
  name: string
  type: PlantType
  capacity_mw: number
  current_output_mw: number
  status: "online" | "offline" | "maintenance"
  location?: string
  efficiency_pct?: number
  created_at: string
  updated_at: string
}

// lib/types/forecast.ts
export interface Forecast {
  plant_id: string
  plant_type: PlantType
  timestamps: string[]
  point_forecast: number[]
  q10: number[]
  q50: number[]
  q90: number[]
  metadata: ForecastMetadata
}

export interface ForecastMetadata {
  model_type: string
  horizon_steps: number
  coverage: number
  generated_at: string
  mape?: number
  inference_time_ms?: number
}

// lib/types/optimization.ts
export interface OptimizationSuggestion {
  id: string
  type: "dispatch" | "maintenance" | "cost" | "efficiency"
  priority: "high" | "medium" | "low"
  title: string
  description: string
  impact: {
    metric: string
    value: string
    direction: "up" | "down"
  }
  affected_plants: string[]
  confidence: number
  created_at: string
}

// lib/types/api.ts
export interface APIResponse<T> {
  data: T
  status: number
  message?: string
}

export interface APIError {
  status: number
  message: string
  details?: unknown
}
```

## 9. Zustand Store Structure

```tsx
// lib/store/plants-store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { Plant, PlantType } from "@/lib/types/plant"

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
  
  // Computed
  getPlantsByType: (type: PlantType) => Plant[]
  getTotalOutput: () => number
  getTotalCapacity: () => number
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
            p.id === id ? { ...p, ...updates } : p
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
    }),
    {
      name: "powercast-plants",
    }
  )
)

// lib/store/timeline-store.ts
import { create } from "zustand"
import { TimeUnit } from "@/lib/types/timeline"

interface TimelineState {
  unit: TimeUnit
  count: number
  
  setTimeline: (unit: TimeUnit, count: number) => void
  
  // Convert to milliseconds for calculations
  getMilliseconds: () => number
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  unit: "hour",
  count: 24,

  setTimeline: (unit, count) => set({ unit, count }),

  getMilliseconds: () => {
    const { unit, count } = get()
    const multipliers: Record<TimeUnit, number> = {
      min: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }
    return count * multipliers[unit]
  },
}))
```

## 10. API Client Structure

```tsx
// lib/api/client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

class APIClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" })
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async uploadFile<T>(endpoint: string, file: File, metadata: Record<string, string>): Promise<T> {
    const formData = new FormData()
    formData.append("file", file)
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value)
    })

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload Error: ${response.status}`)
    }

    return response.json()
  }
}

export const apiClient = new APIClient(API_BASE)

// Typed API endpoints
export const api = {
  health: () => apiClient.get("/api/v1/health"),
  
  plants: {
    list: () => apiClient.get("/api/v1/plants"),
    get: (id: string) => apiClient.get(`/api/v1/plants/${id}`),
    create: (data: unknown) => apiClient.post("/api/v1/plants", data),
  },
  
  forecasts: {
    generate: (plantId: string, horizon: number) =>
      apiClient.get(`/api/v1/forecast?plant_id=${plantId}&horizon=${horizon}`),
    getByPlant: (plantId: string) =>
      apiClient.get(`/api/v1/forecast/${plantId}`),
  },
  
  data: {
    upload: (file: File, plantType: string, plantName: string) =>
      apiClient.uploadFile("/api/v1/data/upload", file, {
        plant_type: plantType,
        plant_name: plantName,
      }),
  },
  
  optimization: {
    generate: (plantIds: string[]) =>
      apiClient.post("/api/v1/optimization/generate", { plant_ids: plantIds }),
  },
}
```

## 11. Implementation Checklist

### Phase 1: Foundation (Day 1-2)
- [ ] Update `globals.css` with complete neumorphic design system
- [ ] Implement `ThemeProvider` with transition fix
- [ ] Create `NeuCard` component with variants (raised, flat, inset)
- [ ] Create `NeuButton` component with variants
- [ ] Create `NeuInput` component (inset style)
- [ ] Create `ThemeToggle` component
- [ ] Test theme switching - verify NO invisible text

### Phase 2: Layout & Navigation (Day 2-3)
- [ ] Implement `Header` component with branding
- [ ] Implement `TabNavigation` component
- [ ] Update `layout.tsx` with providers
- [ ] Update `page.tsx` with tab structure
- [ ] Implement mobile-responsive menu
- [ ] Test on mobile, tablet, desktop

### Phase 3: Dashboard Tab (Day 3-4)
- [ ] Create `DashboardTab` layout
- [ ] Implement `KPIGrid` with 6 metrics
- [ ] Create `MetricCard` with trend indicator
- [ ] Implement `PlantOverview` grid
- [ ] Create `QuickForecast` mini chart
- [ ] Add `AlertsPanel` component

### Phase 4: Data Tab (Day 4-5)
- [ ] Create `DataTab` layout
- [ ] Implement `CSVUploader` with drag-drop
- [ ] Create CSV parsing utility
- [ ] Add data validation feedback
- [ ] Implement `UploadHistory` list
- [ ] Create `PlantManager` for CRUD

### Phase 5: Forecasts Tab (Day 5-6)
- [ ] Create `ForecastsTab` layout
- [ ] Implement `TimelineControls` (15min to 12 months)
- [ ] Create main `ForecastChart` with confidence bands
- [ ] Add `PlantSelector` multi-select
- [ ] Implement `ForecastTable` with export

### Phase 6: Plants Tab (Day 6-7)
- [ ] Create `PlantsTab` layout
- [ ] Implement `PlantTypeFilter`
- [ ] Create `PlantGrid` responsive grid
- [ ] Implement `PlantCard` with sparkline
- [ ] Add `PlantDetail` expandable view

### Phase 7: Optimize Tab (Day 7-8)
- [ ] Create `OptimizeTab` layout
- [ ] Implement `ImpactSummary` cards
- [ ] Create `SuggestionCard` component
- [ ] Add "Generate Suggestions" flow
- [ ] Implement scenario slider

### Phase 8: Polish (Day 8-9)
- [ ] Add skeleton loading states
- [ ] Implement micro-animations
- [ ] Test all components in both themes
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Final responsive testing

## 12. Success Criteria Checklist

- [ ] **Theme Switching**: Zero invisible text issues when toggling light/dark
- [ ] **CSV Upload**: Successfully processes files for all 5 plant types
- [ ] **Timeline Range**: Correctly handles 15 minutes to 12 months
- [ ] **Multi-Plant**: UI performs well with 10+ plants loaded
- [ ] **Responsive**: Works on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] **Performance**: Initial load under 3 seconds
- [ ] **API Ready**: All endpoints typed and ready for backend integration
- [ ] **Neumorphic Design**: Consistent soft UI across all components

---

*Last Updated: 2026-01-19*
*Version: 1.0.0*
*Status: Ready for Implementation*
