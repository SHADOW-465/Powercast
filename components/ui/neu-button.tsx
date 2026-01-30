"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export type NeuButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type NeuButtonSize = "sm" | "md" | "lg" | "icon"

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeuButtonVariant
  size?: NeuButtonSize
  loading?: boolean
}

const sizeClasses: Record<NeuButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
  icon: "p-2.5 rounded-xl",
}

const variantClasses: Record<NeuButtonVariant, string> = {
  primary: `
    bg-[var(--accent-primary)] text-[var(--text-inverted)]
    hover:bg-[var(--accent-primary-hover)]
    shadow-[4px_4px_8px_var(--shadow-dark),-4px_-4px_8px_var(--shadow-light)]
    active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]
  `,
  secondary: `
    neu-flat text-[var(--text-primary)]
    hover:scale-[1.02]
    active:neu-pressed
  `,
  ghost: `
    bg-transparent text-[var(--text-secondary)]
    hover:bg-[var(--background-secondary)] hover:text-[var(--text-primary)]
    rounded-lg
  `,
  danger: `
    bg-[var(--accent-danger)] text-[var(--text-inverted)]
    hover:opacity-90
    shadow-[4px_4px_8px_var(--shadow-dark),-4px_-4px_8px_var(--shadow-light)]
    active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]
  `,
}

export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(
  ({ 
    className, 
    variant = "primary", 
    size = "md", 
    loading = false, 
    disabled,
    children, 
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

NeuButton.displayName = "NeuButton"

// Icon button variant for toolbar actions
export const NeuIconButton = forwardRef<
  HTMLButtonElement,
  Omit<NeuButtonProps, "size"> & { size?: "sm" | "md" | "lg" }
>(({ size = "md", className, ...props }, ref) => {
  const iconSizes = {
    sm: "p-1.5 rounded-lg",
    md: "p-2 rounded-xl",
    lg: "p-3 rounded-xl",
  }

  return (
    <NeuButton
      ref={ref}
      variant="secondary"
      className={cn(iconSizes[size], className)}
      {...props}
    />
  )
})

NeuIconButton.displayName = "NeuIconButton"
