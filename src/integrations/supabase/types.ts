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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          menu_id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          menu_id: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          menu_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          accepting_orders: boolean
          business_hours: Json
          closed_message: string | null
          created_at: string
          document: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          slug: string
          timezone: string
          type: string | null
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          business_hours?: Json
          closed_message?: string | null
          created_at?: string
          document?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          slug: string
          timezone?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          business_hours?: Json
          closed_message?: string | null
          created_at?: string
          document?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          slug?: string
          timezone?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_time: string | null
          establishment_id: string
          event_date: string | null
          id: string
          image_url: string | null
          location: string | null
          logo_url: string | null
          name: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          establishment_id: string
          event_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_time?: string | null
          establishment_id?: string
          event_date?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          created_at: string
          establishment_id: string | null
          id: string
          message: string | null
          metadata: Json
          order_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          establishment_id?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          order_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          establishment_id?: string | null
          id?: string
          message?: string | null
          metadata?: Json
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          active: boolean
          available_from: string | null
          available_to: string | null
          code: string
          created_at: string
          establishment_id: string
          event_id: string | null
          id: string
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_from?: string | null
          available_to?: string | null
          code?: string
          created_at?: string
          establishment_id: string
          event_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_from?: string | null
          available_to?: string | null
          code?: string
          created_at?: string
          establishment_id?: string
          event_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          establishment_id: string | null
          id: string
          order_id: string | null
          payload: Json
          read_at: string | null
          type: string
        }
        Insert: {
          channel?: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          read_at?: string | null
          type: string
        }
        Update: {
          channel?: string
          created_at?: string
          establishment_id?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          read_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          delivered_quantity: number
          emoji: string | null
          id: string
          order_id: string
          prep_minutes: number
          product_id: string | null
          product_name: string
          quantity: number
          requires_prep: boolean
          status: Database["public"]["Enums"]["order_status"]
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_quantity?: number
          emoji?: string | null
          id?: string
          order_id: string
          prep_minutes?: number
          product_id?: string | null
          product_name: string
          quantity: number
          requires_prep?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_quantity?: number
          emoji?: string | null
          id?: string
          order_id?: string
          prep_minutes?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          requires_prep?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_pings: {
        Row: {
          created_at: string
          id: string
          item_name: string | null
          order_code: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name?: string | null
          order_code: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string | null
          order_code?: string
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          establishment_id: string
          event_id: string | null
          first_pickup_at: string | null
          id: string
          menu_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          code?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          establishment_id: string
          event_id?: string | null
          first_pickup_at?: string | null
          id?: string
          menu_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          updated_at?: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          establishment_id?: string
          event_id?: string | null
          first_pickup_at?: string | null
          id?: string
          menu_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          coming_soon: boolean
          created_at: string
          enabled: boolean
          establishment_id: string
          id: string
          label: string
          method: string
          sort_order: number
        }
        Insert: {
          coming_soon?: boolean
          created_at?: string
          enabled?: boolean
          establishment_id: string
          id?: string
          label: string
          method: string
          sort_order?: number
        }
        Update: {
          coming_soon?: boolean
          created_at?: string
          enabled?: boolean
          establishment_id?: string
          id?: string
          label?: string
          method?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      pickups: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          menu_id: string | null
          order_id: string
          order_item_id: string
          quantity: number
          staff_id: string | null
          staff_name: string | null
          station: string | null
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          menu_id?: string | null
          order_id: string
          order_item_id: string
          quantity: number
          staff_id?: string | null
          staff_name?: string | null
          station?: string | null
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          menu_id?: string | null
          order_id?: string
          order_item_id?: string
          quantity?: number
          staff_id?: string | null
          staff_name?: string | null
          station?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickups_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickups_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickups_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickups_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickups_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          emoji: string | null
          establishment_id: string
          id: string
          image_url: string | null
          menu_id: string
          name: string
          prep_minutes: number
          price_cents: number
          requires_prep: boolean
          sort_order: number
          stock: number | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          establishment_id: string
          id?: string
          image_url?: string | null
          menu_id: string
          name: string
          prep_minutes?: number
          price_cents: number
          requires_prep?: boolean
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          establishment_id?: string
          id?: string
          image_url?: string | null
          menu_id?: string
          name?: string
          prep_minutes?: number
          price_cents?: number
          requires_prep?: boolean
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          establishment_id: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          establishment_id: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          establishment_id?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          event_id: string | null
          id: string
          name: string
          pin: string
          role: Database["public"]["Enums"]["staff_role"]
          station: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          event_id?: string | null
          id?: string
          name: string
          pin: string
          role?: Database["public"]["Enums"]["staff_role"]
          station?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          event_id?: string | null
          id?: string
          name?: string
          pin?: string
          role?: Database["public"]["Enums"]["staff_role"]
          station?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_payment: {
        Args: { p_order_code: string; p_reference?: string }
        Returns: Json
      }
      create_order: {
        Args: {
          p_customer_name?: string
          p_items: Json
          p_menu_code: string
          p_payment_method: string
        }
        Returns: Json
      }
      ensure_my_establishment: {
        Args: {
          p_document?: string
          p_name?: string
          p_phone?: string
          p_type?: string
        }
        Returns: Json
      }
      establishment_open_state: { Args: { p_id: string }; Returns: Json }
      gen_public_code: { Args: { p_len?: number }; Returns: string }
      gen_unique_staff_pin: { Args: never; Returns: string }
      get_menu_by_code: { Args: { p_code: string }; Returns: Json }
      get_order_pings: {
        Args: { p_code: string; p_since?: string }
        Returns: Json
      }
      get_voucher: { Args: { p_code: string }; Returns: Json }
      owner_set_order_status: {
        Args: { p_item_id?: string; p_order_id: string; p_status: string }
        Returns: Json
      }
      owns_establishment: { Args: { p_id: string }; Returns: boolean }
      regenerate_menu_code: { Args: { p_menu_id: string }; Returns: Json }
      register_pickup: {
        Args: { p_items: Json; p_order_code: string; p_pin: string }
        Returns: Json
      }
      staff_get_order: {
        Args: { p_order_code: string; p_pin: string }
        Returns: Json
      }
      staff_login: { Args: { p_pin: string }; Returns: Json }
      staff_open_orders: { Args: { p_pin: string }; Returns: Json }
      staff_set_status: {
        Args: {
          p_item_id?: string
          p_order_code: string
          p_pin: string
          p_status: string
        }
        Returns: Json
      }
    }
    Enums: {
      order_status:
        | "aguardando_pagamento"
        | "recebido"
        | "preparando"
        | "pronto"
        | "entregue"
        | "cancelado"
      payment_status: "pendente" | "pago" | "falhou" | "estornado"
      staff_role:
        | "administrador"
        | "atendente"
        | "cozinha"
        | "bartender"
        | "scanner"
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
    Enums: {
      order_status: [
        "aguardando_pagamento",
        "recebido",
        "preparando",
        "pronto",
        "entregue",
        "cancelado",
      ],
      payment_status: ["pendente", "pago", "falhou", "estornado"],
      staff_role: [
        "administrador",
        "atendente",
        "cozinha",
        "bartender",
        "scanner",
      ],
    },
  },
} as const
