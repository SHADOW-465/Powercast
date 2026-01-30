"use client";

/**
 * Powercast AI - Auth Hook
 * React hook for Supabase authentication
 */
import { useEffect, useState, useCallback } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";

// =========================================
// Types
// =========================================

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
}

interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
}

interface SignInCredentials {
  email: string;
  password: string;
}

// =========================================
// Demo User (for development without Supabase)
// =========================================

const DEMO_USER: User = {
  id: "demo-user",
  email: "demo@powercast.ai",
  app_metadata: {},
  user_metadata: { name: "Demo User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const DEMO_SESSION: Session = {
  access_token: "demo-token",
  refresh_token: "demo-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: DEMO_USER,
};

// =========================================
// Hook
// =========================================

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const supabase = getSupabaseClient();

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Use demo user in development
      setState({
        user: DEMO_USER,
        session: DEMO_SESSION,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      return;
    }

    if (!supabase) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session?.user,
        error: error,
      });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session?.user,
        error: null,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Sign up with email/password
  const signUp = useCallback(
    async ({ email, password, name }: SignUpCredentials) => {
      if (!isSupabaseConfigured || !supabase) {
        // Demo mode - just set user
        setState({
          user: { ...DEMO_USER, email, user_metadata: { name } },
          session: DEMO_SESSION,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null };
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false, error }));
      }

      return { data, error };
    },
    [supabase]
  );

  // Sign in with email/password
  const signIn = useCallback(
    async ({ email, password }: SignInCredentials) => {
      if (!isSupabaseConfigured || !supabase) {
        // Demo mode - just set user
        setState({
          user: { ...DEMO_USER, email },
          session: DEMO_SESSION,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null };
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false, error }));
      }

      return { data, error };
    },
    [supabase]
  );

  // Sign out
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode - clear user
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      return { error: null };
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }

    return { error };
  }, [supabase]);

  // Sign in with OAuth (Google, GitHub, etc.)
  const signInWithOAuth = useCallback(
    async (provider: "google" | "github" | "azure") => {
      if (!isSupabaseConfigured || !supabase) {
        // Demo mode - not supported
        return { data: null, error: new Error("OAuth not available in demo mode") };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      return { data, error };
    },
    [supabase]
  );

  // Reset password
  const resetPassword = useCallback(
    async (email: string) => {
      if (!isSupabaseConfigured || !supabase) {
        return { data: null, error: new Error("Password reset not available in demo mode") };
      }

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      return { data, error };
    },
    [supabase]
  );

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    resetPassword,
    isConfigured: isSupabaseConfigured,
  };
}

/**
 * Helper hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo: string = "/login") {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login
      window.location.href = redirectTo;
    }
  }, [auth.isLoading, auth.isAuthenticated, redirectTo]);

  return auth;
}
