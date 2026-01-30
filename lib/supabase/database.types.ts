/**
 * Powercast AI - Database Types
 * TypeScript types for Supabase tables
 *
 * These types match the schema defined in supabase/migrations/001_initial_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      plants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "solar" | "hydro" | "nuclear" | "thermal" | "wind";
          capacity_mw: number;
          current_output_mw: number;
          status: "online" | "offline" | "maintenance";
          location: string | null;
          efficiency_pct: number | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "solar" | "hydro" | "nuclear" | "thermal" | "wind";
          capacity_mw: number;
          current_output_mw?: number;
          status?: "online" | "offline" | "maintenance";
          location?: string | null;
          efficiency_pct?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "solar" | "hydro" | "nuclear" | "thermal" | "wind";
          capacity_mw?: number;
          current_output_mw?: number;
          status?: "online" | "offline" | "maintenance";
          location?: string | null;
          efficiency_pct?: number | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      forecast_data: {
        Row: {
          id: string;
          plant_id: string;
          timestamp: string;
          output_mw: number;
          temperature: number | null;
          humidity: number | null;
          wind_speed: number | null;
          cloud_cover: number | null;
          irradiance: number | null;
          metadata: Json;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          plant_id: string;
          timestamp: string;
          output_mw: number;
          temperature?: number | null;
          humidity?: number | null;
          wind_speed?: number | null;
          cloud_cover?: number | null;
          irradiance?: number | null;
          metadata?: Json;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          plant_id?: string;
          timestamp?: string;
          output_mw?: number;
          temperature?: number | null;
          humidity?: number | null;
          wind_speed?: number | null;
          cloud_cover?: number | null;
          irradiance?: number | null;
          metadata?: Json;
          uploaded_at?: string;
        };
      };
      uploads: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string | null;
          filename: string;
          file_size: number;
          rows_count: number;
          status: "processing" | "completed" | "failed";
          error_message: string | null;
          metadata: Json;
          uploaded_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_id?: string | null;
          filename: string;
          file_size: number;
          rows_count: number;
          status?: "processing" | "completed" | "failed";
          error_message?: string | null;
          metadata?: Json;
          uploaded_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          plant_id?: string | null;
          filename?: string;
          file_size?: number;
          rows_count?: number;
          status?: "processing" | "completed" | "failed";
          error_message?: string | null;
          metadata?: Json;
          uploaded_at?: string;
          processed_at?: string | null;
        };
      };
      optimization_suggestions: {
        Row: {
          id: string;
          user_id: string;
          type: "dispatch" | "maintenance" | "cost" | "efficiency";
          priority: "high" | "medium" | "low";
          title: string;
          description: string;
          impact_metric: string | null;
          impact_value: string | null;
          confidence: number;
          affected_plant_ids: string[];
          status: "pending" | "applied" | "dismissed";
          metadata: Json;
          created_at: string;
          applied_at: string | null;
          dismissed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "dispatch" | "maintenance" | "cost" | "efficiency";
          priority: "high" | "medium" | "low";
          title: string;
          description: string;
          impact_metric?: string | null;
          impact_value?: string | null;
          confidence: number;
          affected_plant_ids?: string[];
          status?: "pending" | "applied" | "dismissed";
          metadata?: Json;
          created_at?: string;
          applied_at?: string | null;
          dismissed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "dispatch" | "maintenance" | "cost" | "efficiency";
          priority?: "high" | "medium" | "low";
          title?: string;
          description?: string;
          impact_metric?: string | null;
          impact_value?: string | null;
          confidence?: number;
          affected_plant_ids?: string[];
          status?: "pending" | "applied" | "dismissed";
          metadata?: Json;
          created_at?: string;
          applied_at?: string | null;
          dismissed_at?: string | null;
        };
      };
      plant_metrics: {
        Row: {
          id: string;
          plant_id: string;
          timestamp: string;
          output_mw: number;
          efficiency_pct: number | null;
          status: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          plant_id: string;
          timestamp?: string;
          output_mw: number;
          efficiency_pct?: number | null;
          status?: string | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          plant_id?: string;
          timestamp?: string;
          output_mw?: number;
          efficiency_pct?: number | null;
          status?: string | null;
          metadata?: Json;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

// Helper types for easier usage
export type Plant = Database["public"]["Tables"]["plants"]["Row"];
export type PlantInsert = Database["public"]["Tables"]["plants"]["Insert"];
export type PlantUpdate = Database["public"]["Tables"]["plants"]["Update"];

export type ForecastData = Database["public"]["Tables"]["forecast_data"]["Row"];
export type ForecastDataInsert =
  Database["public"]["Tables"]["forecast_data"]["Insert"];

export type Upload = Database["public"]["Tables"]["uploads"]["Row"];
export type UploadInsert = Database["public"]["Tables"]["uploads"]["Insert"];

export type OptimizationSuggestion =
  Database["public"]["Tables"]["optimization_suggestions"]["Row"];
export type OptimizationSuggestionInsert =
  Database["public"]["Tables"]["optimization_suggestions"]["Insert"];

export type PlantMetric = Database["public"]["Tables"]["plant_metrics"]["Row"];
export type PlantMetricInsert =
  Database["public"]["Tables"]["plant_metrics"]["Insert"];
