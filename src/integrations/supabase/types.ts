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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          metadata: Json
          teacher_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          metadata?: Json
          teacher_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          metadata?: Json
          teacher_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          competence: string
          created_at: string
          due_date: string
          id: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          competence: string
          created_at?: string
          due_date: string
          id?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          competence?: string
          created_at?: string
          due_date?: string
          id?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_teacher_id_fkey"
            columns: ["student_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          note: string | null
          paid_at: string
          reversal_reason: string | null
          reversed_at: string | null
          teacher_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          invoice_id: string
          method: string
          note?: string | null
          paid_at: string
          reversal_reason?: string | null
          reversed_at?: string | null
          teacher_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          note?: string | null
          paid_at?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_teacher_id_fkey"
            columns: ["invoice_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "invoice_summaries"
            referencedColumns: ["id", "teacher_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_teacher_id_fkey"
            columns: ["invoice_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          due_day: number
          id: string
          instrument: string | null
          is_active: boolean
          monthly_amount_cents: number
          name: string
          phone: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_day: number
          id?: string
          instrument?: string | null
          is_active?: boolean
          monthly_amount_cents: number
          name: string
          phone?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_day?: number
          id?: string
          instrument?: string | null
          is_active?: boolean
          monthly_amount_cents?: number
          name?: string
          phone?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      invoice_summaries: {
        Row: {
          amount_cents: number | null
          balance_cents: number | null
          competence: string | null
          created_at: string | null
          due_date: string | null
          id: string | null
          is_overdue: boolean | null
          paid_cents: number | null
          payment_status: string | null
          student_id: string | null
          student_name: string | null
          student_phone: string | null
          teacher_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_teacher_id_fkey"
            columns: ["student_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "teacher_id"]
          },
        ]
      }
    }
    Functions: {
      generate_invoices: { Args: { _competence: string }; Returns: number }
      invoice_paid_cents: { Args: { _invoice_id: string }; Returns: number }
      register_payment: {
        Args: {
          _amount_cents: number
          _invoice_id: string
          _method: string
          _note: string
          _paid_at: string
        }
        Returns: string
      }
      reverse_payment: {
        Args: { _payment_id: string; _reason: string }
        Returns: undefined
      }
      update_invoice: {
        Args: { _amount_cents: number; _due_date: string; _invoice_id: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
