"use client"

import { useState, useEffect } from "react"
import { NeuCard } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sun,
  Droplets,
  Atom,
  Flame,
  Wind,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlantType, Generator } from "@/lib/types/plant"
import { GENERATOR_DEFAULTS } from "@/lib/types/plant"

interface AddUnitModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (generator: Generator) => void
  existingGenerators: Generator[]
  plantCapacity: number
  editGenerator?: Generator | null
}

const UNIT_TYPES: { value: PlantType; label: string; icon: typeof Sun }[] = [
  { value: "thermal", label: "Thermal", icon: Flame },
  { value: "hydro", label: "Hydro", icon: Droplets },
  { value: "solar", label: "Solar", icon: Sun },
  { value: "wind", label: "Wind", icon: Wind },
  { value: "nuclear", label: "Nuclear", icon: Atom },
]

export function AddUnitModal({ 
  isOpen, 
  onClose, 
  onAdd, 
  existingGenerators, 
  plantCapacity,
  editGenerator 
}: AddUnitModalProps) {
  const [step, setStep] = useState(1)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Form state
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState<number>(0)
  const [unitType, setUnitType] = useState<PlantType | null>(null)
  const [minTurndown, setMinTurndown] = useState(30)
  const [rampRate, setRampRate] = useState(10)

  // Calculate suggested values
  useEffect(() => {
    if (isOpen && !editGenerator) {
      const index = existingGenerators.length + 1
      setName(`Unit ${String.fromCharCode(64 + index)}`)
      
      const usedCapacity = existingGenerators.reduce((sum, g) => sum + g.capacity, 0)
      const remaining = Math.max(0, plantCapacity - usedCapacity)
      setCapacity(remaining > 0 ? remaining : Math.round(plantCapacity / index))
      
      setUnitType(null)
      setMinTurndown(30)
      setRampRate(10)
      setStep(1)
      setShowAdvanced(false)
    } else if (editGenerator) {
      setName(editGenerator.name)
      setCapacity(editGenerator.capacity)
      setUnitType(editGenerator.unitType || null)
      setMinTurndown(editGenerator.minTurndown)
      setRampRate(editGenerator.rampRate)
      setStep(1)
    }
  }, [isOpen, editGenerator, existingGenerators, plantCapacity])

  // Update defaults when unit type changes
  useEffect(() => {
    if (unitType && !editGenerator) {
      const defaults = GENERATOR_DEFAULTS[unitType]
      setMinTurndown(defaults.minTurndown ?? 30)
      setRampRate(defaults.rampRate ?? 10)
    }
  }, [unitType, editGenerator])

  const handleSubmit = () => {
    const generator: Generator = {
      id: editGenerator?.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim() || `Unit ${String.fromCharCode(65 + existingGenerators.length)}`,
      capacity,
      minTurndown,
      rampRate,
      isOnline: editGenerator?.isOnline ?? true,
      unitType: unitType || undefined,
    }
    onAdd(generator)
    onClose()
  }

  const canProceedStep1 = name.trim() && capacity > 0
  const canProceedStep2 = unitType !== null
  const isEditMode = !!editGenerator

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <NeuCard 
        variant="raised" 
        padding="lg"
        className="relative z-10 w-full max-w-md mx-4 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10">
              <Zap className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-[var(--text-primary)]">
                {isEditMode ? "Edit Unit" : "Add Unit"}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Step {step} of 3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-all duration-300",
                s <= step 
                  ? "bg-[var(--accent-primary)]" 
                  : "bg-[var(--border-default)]"
              )}
            />
          ))}
        </div>

        {/* Step 1: Unit Basics */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Unit Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Unit A"
                className="w-full px-4 py-3 neu-inset rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Capacity (MW)
              </label>
              <input
                type="number"
                value={capacity || ""}
                onChange={(e) => setCapacity(Number(e.target.value))}
                placeholder="Enter capacity in MW"
                min={1}
                className="w-full px-4 py-3 neu-inset rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-all"
              />
            </div>
          </div>
        )}

        {/* Step 2: Unit Type */}
        {step === 2 && (
          <div className="space-y-3 animate-fade-in">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
              Select Unit Type
            </label>
            <div className="grid grid-cols-1 gap-2">
              {UNIT_TYPES.map((type) => {
                const Icon = type.icon
                const isSelected = unitType === type.value
                return (
                  <button
                    key={type.value}
                    onClick={() => setUnitType(type.value)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                      isSelected 
                        ? "neu-pressed bg-[var(--accent-primary)]/10 border-2 border-[var(--accent-primary)]" 
                        : "neu-flat hover:scale-[1.01]"
                    )}
                  >
                    <Icon className={cn(
                      "w-5 h-5",
                      isSelected ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
                    )} />
                    <span className={cn(
                      "font-medium",
                      isSelected ? "text-[var(--accent-primary)]" : "text-[var(--text-primary)]"
                    )}>
                      {type.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-[var(--text-muted)] text-center mt-2">
              Type determines default operational parameters
            </p>
          </div>
        )}

        {/* Step 3: Advanced Settings */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            {/* Summary */}
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Name</span>
                <span className="font-medium text-[var(--text-primary)]">{name}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-[var(--text-muted)]">Capacity</span>
                <span className="font-medium text-[var(--text-primary)]">{capacity} MW</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-[var(--text-muted)]">Type</span>
                <span className="font-medium text-[var(--text-primary)] capitalize">{unitType || "—"}</span>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl neu-flat hover:scale-[1.005] transition-all"
            >
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Advanced Settings (Optional)
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </button>

            {/* Advanced Settings Content */}
            <div className={cn(
              "grid transition-all duration-300 ease-in-out overflow-hidden",
              showAdvanced ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
              <div className="min-h-0 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Min Turndown (%)
                  </label>
                  <input
                    type="number"
                    value={minTurndown}
                    onChange={(e) => setMinTurndown(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full px-4 py-3 neu-inset rounded-xl text-[var(--text-primary)] bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Minimum operating level as percentage of capacity
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Ramp Rate (MW/min)
                  </label>
                  <input
                    type="number"
                    value={rampRate}
                    onChange={(e) => setRampRate(Number(e.target.value))}
                    min={0}
                    className="w-full px-4 py-3 neu-inset rounded-xl text-[var(--text-primary)] bg-transparent focus:outline-none"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Maximum rate of output change
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3 mt-6">
          {step > 1 && (
            <NeuButton
              variant="ghost"
              size="md"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </NeuButton>
          )}
          
          {step < 3 ? (
            <NeuButton
              variant="primary"
              size="md"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="flex-1"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </NeuButton>
          ) : (
            <NeuButton
              variant="primary"
              size="md"
              onClick={handleSubmit}
              className="flex-1"
            >
              {isEditMode ? "Save Changes" : "Add Unit"}
            </NeuButton>
          )}
        </div>
      </NeuCard>
    </div>
  )
}
