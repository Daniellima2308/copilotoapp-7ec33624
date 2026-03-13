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
          receipt_url: string | null
          source_fueling_id: string | null
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
          receipt_url?: string | null
          source_fueling_id?: string | null
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
          receipt_url?: string | null
          source_fueling_id?: string | null
          trip_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_source_fueling_id_fkey"
            columns: ["source_fueling_id"]
            isOneToOne: false
            referencedRelation: "fuelings"
            referencedColumns: ["id"]
          },
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
          allocated_value: number | null
          average: number
          created_at: string
          date: string
          full_tank: boolean
          id: string
          km_current: number
          liters: number
          original_total_value: number | null
          price_per_liter: number
          receipt_url: string | null
          station: string
          total_value: number
          trip_id: string
          user_id: string
        }
        Insert: {
          allocated_value?: number | null
          average?: number
          created_at?: string
          date?: string
          full_tank?: boolean
          id?: string
          km_current?: number
          liters?: number
          original_total_value?: number | null
          price_per_liter?: number
          receipt_url?: string | null
          station?: string
          total_value?: number
          trip_id: string
          user_id: string
        }
        Update: {
          allocated_value?: number | null
          average?: number
          created_at?: string
          date?: string
          full_tank?: boolean
          id?: string
          km_current?: number
          liters?: number
          original_total_value?: number | null
          price_per_liter?: number
          receipt_url?: string | null
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
      mural_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mural_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "mural_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      mural_posts: {
        Row: {
          caption: string
          created_at: string
          display_name: string
          id: string
          image_url: string
          likes: number
          user_id: string
        }
        Insert: {
          caption?: string
          created_at?: string
          display_name?: string
          id?: string
          image_url: string
          likes?: number
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          display_name?: string
          id?: string
          image_url?: string
          likes?: number
          user_id?: string
        }
        Relationships: []
      }
      personal_expenses: {
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
            foreignKeyName: "personal_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          personal_expenses_enabled: boolean
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
          personal_expenses_enabled?: boolean
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
          personal_expenses_enabled?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      px_channels: {
        Row: {
          category: string
          created_at: string
          creator_id: string | null
          expires_at: string | null
          id: string
          name: string
          region: string | null
          type: string
        }
        Insert: {
          category?: string
          created_at?: string
          creator_id?: string | null
          expires_at?: string | null
          id?: string
          name: string
          region?: string | null
          type?: string
        }
        Update: {
          category?: string
          created_at?: string
          creator_id?: string | null
          expires_at?: string | null
          id?: string
          name?: string
          region?: string | null
          type?: string
        }
        Relationships: []
      }
      px_messages: {
        Row: {
          audio_url: string | null
          channel_id: string
          created_at: string
          display_name: string
          id: string
          text: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          channel_id: string
          created_at?: string
          display_name?: string
          id?: string
          text?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          channel_id?: string
          created_at?: string
          display_name?: string
          id?: string
          text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "px_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "px_channels"
            referencedColumns: ["id"]
          },
        ]
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
          estimated_distance: number
          finished_at: string | null
          id: string
          status: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          estimated_distance?: number
          finished_at?: string | null
          id?: string
          status?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          estimated_distance?: number
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
          default_commission_percent: number | null
          driver_bond: "autonomo" | "clt" | "agregado" | "outro" | null
          driver_name: string | null
          id: string
          is_fleet_owner: boolean
          model: string
          operation_profile: "driver_owner" | "commissioned_driver" | "owner_with_driver" | "custom"
          plate: string
          user_id: string
          year: number
        }
        Insert: {
          brand: string
          created_at?: string
          current_km?: number
          default_commission_percent?: number | null
          driver_bond?: "autonomo" | "clt" | "agregado" | "outro" | null
          driver_name?: string | null
          id?: string
          is_fleet_owner?: boolean
          model: string
          operation_profile?: "driver_owner" | "commissioned_driver" | "owner_with_driver" | "custom"
          plate: string
          user_id: string
          year: number
        }
        Update: {
          brand?: string
          created_at?: string
          current_km?: number
          default_commission_percent?: number | null
          driver_bond?: "autonomo" | "clt" | "agregado" | "outro" | null
          driver_name?: string | null
          id?: string
          is_fleet_owner?: boolean
          model?: string
          operation_profile?: "driver_owner" | "commissioned_driver" | "owner_with_driver" | "custom"
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
      increment_post_likes: {
        Args: { amount: number; post_id: string }
        Returns: undefined
      }
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
