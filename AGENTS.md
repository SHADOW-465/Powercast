# AGENTS.md

## Build/Lint/Test Commands

```bash
# Development
pnpm dev              # Start development server (Next.js)
pnpm build            # Build for production
pnpm start            # Start production server (after build)

# Quality
pnpm lint             # Run ESLint on all files
```

**Testing**: No test framework is currently configured. Add Jest/Vitest before implementing tests.

---

## Code Style Guidelines

### Imports & Path Aliases
- Use `@/*` alias for all internal imports (configured in tsconfig.json)
- Order: External packages → internal modules → types → styles
```typescript
import { useState, useEffect } from "react"
import { usePlantsStore } from "@/lib/store/plants-store"
import type { Plant } from "@/lib/types/plant"
import "./styles.css"
```

### TypeScript Configuration
- Strict mode enabled in tsconfig.json
- **NEVER** suppress type errors with `as any`, `@ts-ignore`, or `@ts-expect-error`
- Define interfaces explicitly, avoid implicit `any`

### Component Patterns
```typescript
"use client"  // Add for client components (default: server components)

import type React from "react"

interface ComponentProps {
  title: string
  isActive?: boolean  // Use ? for optional props
}

export function ComponentName({ title, isActive = false }: ComponentProps) {
  // Component logic
  return <div>{title}</div>
}
```

### State Management (Zustand)
```typescript
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface State {
  data: string[]
  addData: (item: string) => void
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      data: [],
      addData: (item) => set((state) => ({ data: [...state.data, item] })),
    }),
    { name: "storage-key" }
  )
)
```

### Styling (Tailwind CSS)
- Use custom utility `cn()` for className merging (combines clsx + tailwind-merge)
- **ALWAYS use CSS variables for colors**, never raw values like `#fff`, `text-white`, `text-black`
```typescript
import { cn } from "@/lib/utils"

// GOOD - uses CSS variables
<div className={cn("bg-[var(--background)] text-[var(--text-primary)]", isActive && "ring-2")}>

// BAD - raw colors
<div className="bg-white text-white">
```

### API Routes (Next.js App Router)
```typescript
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Process request
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
```

### Error Handling
- Always wrap async operations in try/catch
- Use `console.error()` for error logging in development
- In API routes, return NextResponse with appropriate status codes
- Never leave empty catch blocks

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `DashboardTab`, `NeuCard` |
| Hooks | camelCase + "use" prefix | `useAuth`, `usePlants` |
| Stores | camelCase + "Store" suffix | `plantsStore`, `navigationStore` |
| Types/Interfaces | PascalCase | `PlantType`, `GeneratorProps` |
| Constants | UPPER_SNAKE_CASE | `GENERATOR_DEFAULTS`, `API_URL` |
| Functions | camelCase | `calculateTotal`, `fetchData` |

### File Structure
```
app/                    # Next.js App Router pages and API routes
├── api/               # API endpoints
├── (auth)/           # Route groups
├── layout.tsx        # Root layout with providers
└── page.tsx          # Home page

components/            # React components
├── ui/               # shadcn/ui components
├── dashboard/        # Feature-specific components
├── providers/        # Context providers
└── auth/            # Auth components

lib/                   # Utility libraries
├── store/           # Zustand state management
├── types/           # TypeScript type definitions
├── hooks/           # Custom React hooks
├── services/        # External API services
└── utils/           # Utility functions
```

### Key Libraries & Patterns
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4 with neumorphic design system
- **Icons**: lucide-react
- **Forms**: react-hook-form + zod validation
- **Data Fetching**: @tanstack/react-query
- **Charts**: recharts
- **Auth**: Supabase (with demo mode fallback)
- **AI**: Google Gemini API

### Environment Variables
Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
```

### Before Committing
1. Run `pnpm lint` - fix all errors
2. Build with `pnpm build` - ensure no build errors
3. Check for console warnings/errors in browser

---

## Important Notes
- TypeScript build errors are ignored in next.config.mjs (temporary - fix actual errors)
- Project uses pnpm, not npm or yarn
- Next.js 16 with App Router
- This is a v0.app generated project with ongoing sync to deployed version
