"use client"

import { 
  Power, 
  Pencil, 
  Trash2,
  Sun,
  Droplets,
  Atom,
  Flame,
  Wind,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlantType, Generator } from "@/lib/types/plant"

interface GeneratorCardProps {
  generator: Generator
  onEdit: (generator: Generator) => void
  onDelete: (id: string) => void
  onToggleOnline: (id: string) => void
}

const TYPE_ICONS: Record<PlantType, typeof Sun> = {
  solar: Sun,
  hydro: Droplets,
  nuclear: Atom,
  thermal: Flame,
  wind: Wind,
}

const TYPE_COLORS: Record<PlantType, string> = {
  solar: "var(--plant-solar)",
  hydro: "var(--plant-hydro)",
  nuclear: "var(--plant-nuclear)",
  thermal: "var(--plant-thermal)",
  wind: "var(--plant-wind)",
}

export function GeneratorCard({ 
  generator, 
  onEdit, 
  onDelete, 
  onToggleOnline 
}: GeneratorCardProps) {
  const Icon = generator.unitType ? TYPE_ICONS[generator.unitType] : Zap
  const color = generator.unitType ? TYPE_COLORS[generator.unitType] : "var(--accent-primary)"
  
  return (
    <div 
      className={cn(
        "group relative p-4 rounded-xl shadow-sm transition-all duration-200",
        "bg-[var(--bg-card)] border border-[var(--border-default)]",
        "hover:shadow-md hover:scale-[1.01] hover:border-[var(--border-hover)]",
        !generator.isOnline && "opacity-60"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div 
          className="p-2.5 rounded-xl transition-colors"
          style={{ 
            backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
          }}
        >
          <Icon 
            className="w-5 h-5 transition-colors" 
            style={{ color }}
          />
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[var(--text-primary)] truncate">
              {generator.name}
            </h4>
            {!generator.isOnline && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--text-muted)]/20 text-[var(--text-muted)]">
                Offline
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-2">
            <span className="font-medium">{generator.capacity} MW</span>
            {generator.unitType && (
              <>
                <span className="text-[var(--border-default)]">•</span>
                <span className="capitalize">{generator.unitType}</span>
              </>
            )}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleOnline(generator.id)}
            className={cn(
              "p-2 rounded-lg transition-all",
              generator.isOnline 
                ? "text-[var(--accent-success)] bg-[var(--accent-success)]/10 hover:bg-[var(--accent-success)]/20" 
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            )}
            title={generator.isOnline ? "Turn Off" : "Turn On"}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(generator)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-all"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(generator.id)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 transition-all"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
