"use client"

import { useTheme } from "@/components/providers/theme-provider"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark" | "system"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ]

  return (
    <div className="flex items-center gap-1 p-1 neu-inset rounded-xl">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={`Switch to ${label} theme`}
          className={cn(
            "p-2 rounded-lg transition-all duration-200",
            theme === value
              ? "neu-raised-sm text-[var(--accent-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}

// Simple toggle between light and dark (no system option)
export function ThemeToggleSimple() {
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
      className="p-2.5 neu-flat rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:scale-[1.05] transition-all duration-200"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}
