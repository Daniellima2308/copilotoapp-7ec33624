export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      expenses: {
        Row: {
          category: string
          created_at: string
          date: string
          description: string
          id: string
          trip_id: string
          user_id: string
          value: number
        }
        Insert: {
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          trip_id: string
          user_id: string
          value?: number
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          trip_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      freights: {
        Row: {
          commission_percent: number
          commission_value: number
          created_at: string
          destination: string
          gross_value: number
          id: string
          km_final: number
          km_initial: number
          origin: string
          trip_id: string
          user_id: string
        }
        Insert: {
          commission_percent?: number
          commission_value?: number
          created_at?: string
          destination: string
          gross_value?: number
          id?: string
          km_final?: number
          km_initial?: number
          origin: string
          trip_id: string
          user_id: string
        }
        Update: {
          commission_percent?: number
          commission_value?: number
          created_at?: string
          destination?: string
          gross_value?: number
          id?: string
          km_final?: number
          km_initial?: number
          origin?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freights_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      fuelings: {
        Row: {
          average: number
          created_at: string
          date: string
          full_tank: boolean
          id: string
          km_current: number
          liters: number
          price_per_liter: number
          station: string
          total_value: number
          trip_id: string
          user_id: string
        }
        Insert: {
          average?: number
          created_at?: string
          date?: string
          full_tank?: boolean
          id?: string
          km_current?: number
          liters?: number
          price_per_liter?: number
          station?: string
          total_value?: number
          trip_id: string
          user_id: string
        }
        Update: {
          average?: number
          created_at?: string
          date?: string
          full_tank?: boolean
          id?: string
          km_current?: number
          liters?: number
          price_per_liter?: number
          station?: string
          total_value?: number
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuelings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_services: {
        Row: {
          created_at: string
          id: string
          interval_km: number
          last_change_km: number
          service_name: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interval_km?: number
          last_change_km?: number
          service_name: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval_km?: number
          last_change_km?: number
          service_name?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_services_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          has_seen_tutorial: boolean
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          has_seen_tutorial?: boolean
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          has_seen_tutorial?: boolean
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          created_at: string
          id: string
          suggestion: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          status: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          status?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          status?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          created_at: string
          current_km: number
          driver_name: string | null
          id: string
          is_fleet_owner: boolean
          model: string
          plate: string
          user_id: string
          year: number
        }
        Insert: {
          brand: string
          created_at?: string
          current_km?: number
          driver_name?: string | null
          id?: string
          is_fleet_owner?: boolean
          model: string
          plate: string
          user_id: string
          year: number
        }
        Update: {
          brand?: string
          created_at?: string
          current_km?: number
          driver_name?: string | null
          id?: string
          is_fleet_owner?: boolean
          model?: string
          plate?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
