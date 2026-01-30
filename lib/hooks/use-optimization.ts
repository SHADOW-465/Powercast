"use client";

/**
 * Powercast AI - Optimization Hooks
 * React Query hooks for optimization suggestions
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { OptimizationSuggestion } from "@/lib/supabase/database.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =========================================
// Types
// =========================================

interface SuggestionListResponse {
  suggestions: OptimizationSuggestion[];
  total: number;
}

interface SuggestionFilters {
  type?: string;
  priority?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

interface OptimizationSummary {
  total_suggestions: number;
  pending_count: number;
  applied_count: number;
  dismissed_count: number;
  high_priority_count: number;
  estimated_savings: string;
  efficiency_gain: string;
}

// =========================================
// API Functions
// =========================================

async function fetchSuggestions(
  filters?: SuggestionFilters
): Promise<SuggestionListResponse> {
  const supabase = getSupabaseClient();

  if (supabase) {
    let query = supabase
      .from("optimization_suggestions")
      .select("*", { count: "exact" });

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }
    if (filters?.priority) {
      query = query.eq("priority", filters.priority);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(
        filters?.offset || 0,
        (filters?.offset || 0) + (filters?.limit || 50) - 1
      );

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      suggestions: (data as OptimizationSuggestion[]) || [],
      total: count || 0,
    };
  }

  // Fall back to REST API
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const response = await fetch(`${API_BASE}/api/v1/optimization?${params}`);
  if (!response.ok) throw new Error("Failed to fetch suggestions");

  return response.json();
}

async function fetchSummary(): Promise<OptimizationSummary> {
  const response = await fetch(`${API_BASE}/api/v1/optimization/summary`);
  if (!response.ok) throw new Error("Failed to fetch summary");

  return response.json();
}

async function applySuggestion(id: string): Promise<OptimizationSuggestion> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("optimization_suggestions")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as OptimizationSuggestion;
  }

  const response = await fetch(`${API_BASE}/api/v1/optimization/${id}/apply`, {
    method: "PATCH",
  });
  if (!response.ok) throw new Error("Failed to apply suggestion");

  return response.json();
}

async function dismissSuggestion(id: string): Promise<OptimizationSuggestion> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("optimization_suggestions")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as OptimizationSuggestion;
  }

  const response = await fetch(
    `${API_BASE}/api/v1/optimization/${id}/dismiss`,
    {
      method: "PATCH",
    }
  );
  if (!response.ok) throw new Error("Failed to dismiss suggestion");

  return response.json();
}

async function generateSuggestions(
  count: number = 6
): Promise<{ message: string; suggestions: OptimizationSuggestion[] }> {
  const response = await fetch(
    `${API_BASE}/api/v1/optimization/generate?count=${count}`,
    {
      method: "POST",
    }
  );
  if (!response.ok) throw new Error("Failed to generate suggestions");

  return response.json();
}

// =========================================
// Hooks
// =========================================

/**
 * Hook to fetch all optimization suggestions
 */
export function useOptimizationSuggestions(filters?: SuggestionFilters) {
  return useQuery({
    queryKey: ["optimization-suggestions", filters],
    queryFn: () => fetchSuggestions(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch optimization summary
 */
export function useOptimizationSummary() {
  return useQuery({
    queryKey: ["optimization-summary"],
    queryFn: fetchSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to apply a suggestion
 */
export function useApplySuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: applySuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["optimization-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["optimization-summary"] });
    },
  });
}

/**
 * Hook to dismiss a suggestion
 */
export function useDismissSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["optimization-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["optimization-summary"] });
    },
  });
}

/**
 * Hook to generate new AI suggestions
 */
export function useGenerateSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateSuggestions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["optimization-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["optimization-summary"] });
    },
  });
}
