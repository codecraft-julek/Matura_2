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
      ai_ratings: {
        Row: {
          comment: string
          created_at: string
          id: number
          rating: number
          target_id: string
          target_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: never
          rating: number
          target_id: string
          target_kind: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: never
          rating?: number
          target_id?: string
          target_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          count: number
          day: string
          feature: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          feature: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          feature?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_accounts: {
        Row: {
          cancel_at_period_end: boolean
          pass_until: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          pass_until?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          pass_until?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          topic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name?: string
          status?: string
          topic: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      essays: {
        Row: {
          attempt_id: string | null
          completed_at: string | null
          content: string
          created_at: string
          duration_ms: number | null
          error: string | null
          feedback: Json | null
          id: string
          kind: string
          level: string
          model: string | null
          status: string
          task_number: string | null
          topic: string
          usage: Json | null
          user_id: string
          word_count: number
        }
        Insert: {
          attempt_id?: string | null
          completed_at?: string | null
          content: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feedback?: Json | null
          id?: string
          kind: string
          level: string
          model?: string | null
          status?: string
          task_number?: string | null
          topic?: string
          usage?: Json | null
          user_id: string
          word_count: number
        }
        Update: {
          attempt_id?: string | null
          completed_at?: string | null
          content?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feedback?: Json | null
          id?: string
          kind?: string
          level?: string
          model?: string | null
          status?: string
          task_number?: string | null
          topic?: string
          usage?: Json | null
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "essays_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          ai_graded_at: string | null
          answers: Json
          checkable_points: number
          exam_id: string
          id: string
          mode: string
          results: Json
          score: number
          started_at: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          ai_graded_at?: string | null
          answers: Json
          checkable_points: number
          exam_id: string
          id?: string
          mode: string
          results: Json
          score: number
          started_at: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          ai_graded_at?: string | null
          answers?: Json
          checkable_points?: number
          exam_id?: string
          id?: string
          mode?: string
          results?: Json
          score?: number
          started_at?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_task_keys: {
        Row: {
          accepted: string[]
          correct: string | null
          display: string
          note: string | null
          task_id: string
        }
        Insert: {
          accepted?: string[]
          correct?: string | null
          display: string
          note?: string | null
          task_id: string
        }
        Update: {
          accepted?: string[]
          correct?: string | null
          display?: string
          note?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_task_keys_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "exam_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_tasks: {
        Row: {
          exam_id: string
          group_label: string
          group_no: number
          id: string
          kind: string
          meta: Json
          number: string
          options: string[]
          points: number
          section: string
          sort: number
        }
        Insert: {
          exam_id: string
          group_label: string
          group_no: number
          id: string
          kind: string
          meta?: Json
          number: string
          options?: string[]
          points: number
          section: string
          sort: number
        }
        Update: {
          exam_id?: string
          group_label?: string
          group_no?: number
          id?: string
          kind?: string
          meta?: Json
          number?: string
          options?: string[]
          points?: number
          section?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_tasks_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_minutes: number
          id: string
          key_url: string | null
          level: string
          max_points: number
          published: boolean
          session: string
          sheet_url: string
          sheet2_url: string | null
          sort: number
          subject: string
          title: string
          transcript_url: string | null
          year: number
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_minutes: number
          id: string
          key_url?: string | null
          level: string
          max_points: number
          published?: boolean
          session: string
          sheet_url: string
          sheet2_url?: string | null
          sort?: number
          subject: string
          title: string
          transcript_url?: string | null
          year: number
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          key_url?: string | null
          level?: string
          max_points?: number
          published?: boolean
          session?: string
          sheet_url?: string
          sheet2_url?: string | null
          sort?: number
          subject?: string
          title?: string
          transcript_url?: string | null
          year?: number
        }
        Relationships: []
      }
      flashcard_decks: {
        Row: {
          created_at: string
          id: string
          source_kind: string
          source_label: string
          subject: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_kind?: string
          source_label?: string
          subject?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_kind?: string
          source_label?: string
          subject?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          due_at: string
          ease: number
          front: string
          id: string
          interval_days: number
          lapses: number
          last_reviewed_at: string | null
          position: number
          reps: number
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          due_at?: string
          ease?: number
          front: string
          id?: string
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          position?: number
          reps?: number
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          due_at?: string
          ease?: number
          front?: string
          id?: string
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          position?: number
          reps?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          model: string | null
          note: Json | null
          source_kind: string
          source_text: string
          status: string
          subject: string
          title: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          model?: string | null
          note?: Json | null
          source_kind: string
          source_text?: string
          status?: string
          subject: string
          title?: string
          usage?: Json | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          model?: string | null
          note?: Json | null
          source_kind?: string
          source_text?: string
          status?: string
          subject?: string
          title?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          feature: string
          max_uses: number
          period: string
          plan: string
        }
        Insert: {
          feature: string
          max_uses: number
          period: string
          plan: string
        }
        Update: {
          feature?: string
          max_uses?: number
          period?: string
          plan?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_confirmed: boolean
          created_at: string
          display_name: string | null
          id: string
          matura_year: string | null
          onboarded_at: string | null
          subjects: string[]
          terms_version: string
          updated_at: string
        }
        Insert: {
          age_confirmed: boolean
          created_at?: string
          display_name?: string | null
          id: string
          matura_year?: string | null
          onboarded_at?: string | null
          subjects?: string[]
          terms_version: string
          updated_at?: string
        }
        Update: {
          age_confirmed?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          matura_year?: string | null
          onboarded_at?: string | null
          subjects?: string[]
          terms_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      tutor_chats: {
        Row: {
          created_at: string
          exam_id: string | null
          group_no: number | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_id?: string | null
          group_no?: number | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string | null
          group_no?: number | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_chats_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: number
          role: string
          usage: Json | null
          user_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: never
          role: string
          usage?: Json | null
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: never
          role?: string
          usage?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "tutor_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          age_confirmed: boolean
          consent_privacy: boolean
          consent_version: string
          created_at: string
          email: string
          id: string
          matura_year: string
          ref: string | null
          subjects: string[]
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          age_confirmed: boolean
          consent_privacy: boolean
          consent_version: string
          created_at?: string
          email: string
          id?: string
          matura_year: string
          ref?: string | null
          subjects: string[]
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          age_confirmed?: boolean
          consent_privacy?: boolean
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          matura_year?: string
          ref?: string | null
          subjects?: string[]
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_rate_ai: { Args: { p_id: string; p_kind: string }; Returns: boolean }
      consume_ai_quota: {
        Args: {
          p_feature: string
          p_global_limit: number
          p_user: string
          p_user_limit: number
        }
        Returns: boolean
      }
      consume_plan_quota: {
        Args: { p_feature: string; p_global_limit: number; p_user: string }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
      fail_stuck_ai_jobs: { Args: { p_older_than?: string }; Returns: number }
      grade_exam_answers: {
        Args: { p_answers: Json; p_exam_id: string; p_group?: number }
        Returns: Json
      }
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      my_ai_allowance: {
        Args: never
        Returns: {
          feature: string
          max_uses: number
          period: string
          plan: string
          used: number
        }[]
      }
      normalize_answer: { Args: { t: string }; Returns: string }
      quota_since: { Args: { p_period: string }; Returns: string }
      refund_ai_quota: {
        Args: { p_feature: string; p_user: string }
        Returns: undefined
      }
      save_ai_grades: {
        Args: { p_attempt_id: string; p_grades: Json; p_user: string }
        Returns: number
      }
      self_check_answer: {
        Args: { p_accept: boolean; p_attempt_id: string; p_number: string }
        Returns: undefined
      }
      self_grade_answer: {
        Args: { p_attempt_id: string; p_number: string; p_points: number }
        Returns: undefined
      }
      submit_exam_attempt: {
        Args: {
          p_answers: Json
          p_exam_id: string
          p_mode: string
          p_started_at: string
        }
        Returns: string
      }
      user_plan: { Args: { p_user: string }; Returns: string }
      warsaw_today: { Args: never; Returns: string }
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
