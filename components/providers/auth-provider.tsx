"use client";

/**
 * Powercast AI - Auth Provider
 * Context provider for authentication state
 */
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import type { User, Session, AuthError } from "@supabase/supabase-js";

// =========================================
// Types
// =========================================

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
  isConfigured: boolean;
  signUp: (credentials: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<{ data: any; error: AuthError | Error | null }>;
  signIn: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ data: any; error: AuthError | Error | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (
    provider: "google" | "github" | "azure"
  ) => Promise<{ data: any; error: any }>;
  resetPassword: (email: string) => Promise<{ data: any; error: any }>;
}

// =========================================
// Context
// =========================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =========================================
// Provider
// =========================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// =========================================
// Hook
// =========================================

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}
