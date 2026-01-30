"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export type NeuCardVariant = "raised" | "flat" | "inset" | "pressed"

interface NeuCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: NeuCardVariant
  hover?: boolean
  padding?: "none" | "sm" | "md" | "lg"
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
}

const variantClasses: Record<NeuCardVariant, string> = {
  raised: "neu-raised",
  flat: "neu-flat",
  inset: "neu-inset",
  pressed: "neu-pressed",
}

export const NeuCard = forwardRef<HTMLDivElement, NeuCardProps>(
  ({ className, variant = "raised", hover = true, padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          paddingClasses[padding],
          hover && variant === "raised" && "hover:scale-[1.01] active:scale-[0.99]",
          "transition-transform duration-200",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

NeuCard.displayName = "NeuCard"

// Specialized variants for common use cases
export const NeuCardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
))
NeuCardHeader.displayName = "NeuCardHeader"

export const NeuCardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-[var(--text-primary)]",
      className
    )}
    {...props}
  />
))
NeuCardTitle.displayName = "NeuCardTitle"

export const NeuCardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--text-muted)]", className)}
    {...props}
  />
))
NeuCardDescription.displayName = "NeuCardDescription"

export const NeuCardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
))
NeuCardContent.displayName = "NeuCardContent"

export const NeuCardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
))
NeuCardFooter.displayName = "NeuCardFooter"
