"use client";

/**
 * Powercast AI - Plants Hooks
 * React Query hooks for plants data
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Plant, PlantInsert, PlantUpdate } from "@/lib/supabase/database.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =========================================
// Types
// =========================================

interface PlantListResponse {
  plants: Plant[];
  total: number;
}

interface PlantFilters {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// =========================================
// API Functions
// =========================================

async function fetchPlants(filters?: PlantFilters): Promise<PlantListResponse> {
  const supabase = getSupabaseClient();

  // Try Supabase first if configured
  if (supabase) {
    let query = supabase.from("plants").select("*", { count: "exact" });

    if (filters?.type) {
      query = query.eq("type", filters.type);
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
      plants: (data as Plant[]) || [],
      total: count || 0,
    };
  }

  // Fall back to REST API
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const response = await fetch(`${API_BASE}/api/v1/plants?${params}`);
  if (!response.ok) throw new Error("Failed to fetch plants");

  return response.json();
}

async function fetchPlant(id: string): Promise<Plant> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("plants")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Plant;
  }

  const response = await fetch(`${API_BASE}/api/v1/plants/${id}`);
  if (!response.ok) throw new Error("Failed to fetch plant");

  return response.json();
}

async function createPlant(plant: PlantInsert): Promise<Plant> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("plants")
      .insert(plant)
      .select()
      .single();

    if (error) throw error;
    return data as Plant;
  }

  const response = await fetch(`${API_BASE}/api/v1/plants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plant),
  });
  if (!response.ok) throw new Error("Failed to create plant");

  return response.json();
}

async function updatePlant({
  id,
  ...updates
}: PlantUpdate & { id: string }): Promise<Plant> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("plants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Plant;
  }

  const response = await fetch(`${API_BASE}/api/v1/plants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update plant");

  return response.json();
}

async function deletePlant(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { error } = await supabase.from("plants").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const response = await fetch(`${API_BASE}/api/v1/plants/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete plant");
}

// =========================================
// Hooks
// =========================================

/**
 * Hook to fetch all plants with optional filters
 */
export function usePlants(filters?: PlantFilters) {
  return useQuery({
    queryKey: ["plants", filters],
    queryFn: () => fetchPlants(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single plant
 */
export function usePlant(id: string) {
  return useQuery({
    queryKey: ["plants", id],
    queryFn: () => fetchPlant(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a new plant
 */
export function useCreatePlant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });
}

/**
 * Hook to update a plant
 */
export function useUpdatePlant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePlant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      queryClient.setQueryData(["plants", data.id], data);
    },
  });
}

/**
 * Hook to delete a plant
 */
export function useDeletePlant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });
}
