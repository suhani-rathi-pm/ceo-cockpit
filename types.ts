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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          note: string
          resolved_at: string | null
          routed_to_unit: string
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          note?: string
          resolved_at?: string | null
          routed_to_unit: string
          status?: string
          subject?: string | null
          type?: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          note?: string
          resolved_at?: string | null
          routed_to_unit?: string
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      ceo_messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          crm_name: string
          id: string
          read: boolean
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          crm_name: string
          id?: string
          read?: boolean
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          crm_name?: string
          id?: string
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ceo_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      collateral: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          kind: string
          owner_unit: string
          summary: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          kind: string
          owner_unit: string
          summary?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          kind?: string
          owner_unit?: string
          summary?: string | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          headcount_band: string
          icp_fit: string
          icp_subscores: Json | null
          id: string
          inactive_marked_by: string | null
          industry: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          headcount_band: string
          icp_fit?: string
          icp_subscores?: Json | null
          id?: string
          inactive_marked_by?: string | null
          industry: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          headcount_band?: string
          icp_fit?: string
          icp_subscores?: Json | null
          id?: string
          inactive_marked_by?: string | null
          industry?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          full_name: string
          id: string
          seniority_tier: number
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          full_name: string
          id?: string
          seniority_tier: number
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          full_name?: string
          id?: string
          seniority_tier?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crms: {
        Row: {
          credibility_multiplier: number
          experience_level: string
          id: string
          name: string
        }
        Insert: {
          credibility_multiplier?: number
          experience_level: string
          id?: string
          name: string
        }
        Update: {
          credibility_multiplier?: number
          experience_level?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      demo_seed_companies: {
        Row: {
          created_at: string | null
          headcount_band: string | null
          icp_fit: string | null
          icp_subscores: Json | null
          id: string | null
          inactive_marked_by: string | null
          industry: string | null
          is_active: boolean | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          headcount_band?: string | null
          icp_fit?: string | null
          icp_subscores?: Json | null
          id?: string | null
          inactive_marked_by?: string | null
          industry?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          headcount_band?: string | null
          icp_fit?: string | null
          icp_subscores?: Json | null
          id?: string | null
          inactive_marked_by?: string | null
          industry?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
      demo_seed_contacts: {
        Row: {
          company_id: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          seniority_tier: number | null
          title: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          seniority_tier?: number | null
          title?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          seniority_tier?: number | null
          title?: string | null
        }
        Relationships: []
      }
      demo_seed_crms: {
        Row: {
          credibility_multiplier: number | null
          experience_level: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          credibility_multiplier?: number | null
          experience_level?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          credibility_multiplier?: number | null
          experience_level?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      demo_seed_news_items: {
        Row: {
          category: string | null
          dismissed: boolean | null
          headline: string | null
          id: string | null
          matched_company_id: string | null
          published_at: string | null
          relevance_score: number | null
          source_name: string | null
          source_url: string | null
          why_it_matters: string | null
        }
        Insert: {
          category?: string | null
          dismissed?: boolean | null
          headline?: string | null
          id?: string | null
          matched_company_id?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source_name?: string | null
          source_url?: string | null
          why_it_matters?: string | null
        }
        Update: {
          category?: string | null
          dismissed?: boolean | null
          headline?: string | null
          id?: string | null
          matched_company_id?: string | null
          published_at?: string | null
          relevance_score?: number | null
          source_name?: string | null
          source_url?: string | null
          why_it_matters?: string | null
        }
        Relationships: []
      }
      demo_seed_touchpoints: {
        Row: {
          company_id: string | null
          contact_id: string | null
          crm_id: string | null
          est_opportunity_size: string | null
          id: string | null
          misc_comments: string | null
          notes: string | null
          occurred_at: string | null
          star_rating: number | null
          type: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          crm_id?: string | null
          est_opportunity_size?: string | null
          id?: string | null
          misc_comments?: string | null
          notes?: string | null
          occurred_at?: string | null
          star_rating?: number | null
          type?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          crm_id?: string | null
          est_opportunity_size?: string | null
          id?: string | null
          misc_comments?: string | null
          notes?: string | null
          occurred_at?: string | null
          star_rating?: number | null
          type?: string | null
        }
        Relationships: []
      }
      entity_aliases: {
        Row: {
          alias: string
          confidence: number | null
          created_at: string
          id: string
          occurrences: number
          resolved_at: string | null
          resolved_by: string | null
          resolved_company_id: string | null
          source_system: string
          status: string
          suggested_company_id: string | null
        }
        Insert: {
          alias: string
          confidence?: number | null
          created_at?: string
          id?: string
          occurrences?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_company_id?: string | null
          source_system: string
          status?: string
          suggested_company_id?: string | null
        }
        Update: {
          alias?: string
          confidence?: number | null
          created_at?: string
          id?: string
          occurrences?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_company_id?: string | null
          source_system?: string
          status?: string
          suggested_company_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_aliases_resolved_company_id_fkey"
            columns: ["resolved_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_aliases_suggested_company_id_fkey"
            columns: ["suggested_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_cache: {
        Row: {
          cache_key: string
          content: Json
          created_at: string
          hits: number
          id: string
          kind: string
          last_used_at: string
          model: string | null
        }
        Insert: {
          cache_key: string
          content: Json
          created_at?: string
          hits?: number
          id?: string
          kind: string
          last_used_at?: string
          model?: string | null
        }
        Update: {
          cache_key?: string
          content?: Json
          created_at?: string
          hits?: number
          id?: string
          kind?: string
          last_used_at?: string
          model?: string | null
        }
        Relationships: []
      }
      message_replies: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          message_id: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          message_id: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ceo_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      model_calls: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          latency_ms: number
          model: string
          outcome: string
          provider: string
          purpose: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number
          model: string
          outcome?: string
          provider: string
          purpose: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number
          model?: string
          outcome?: string
          provider?: string
          purpose?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: []
      }
      news_dismissals: {
        Row: {
          actor: string
          created_at: string
          headline: string
          id: string
          news_item_id: string | null
          reason: string
          relevance_score: number | null
        }
        Insert: {
          actor?: string
          created_at?: string
          headline?: string
          id?: string
          news_item_id?: string | null
          reason: string
          relevance_score?: number | null
        }
        Update: {
          actor?: string
          created_at?: string
          headline?: string
          id?: string
          news_item_id?: string | null
          reason?: string
          relevance_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "news_dismissals_news_item_id_fkey"
            columns: ["news_item_id"]
            isOneToOne: false
            referencedRelation: "news_items"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          category: string
          dismissed: boolean
          headline: string
          id: string
          matched_company_id: string | null
          published_at: string
          relevance_score: number
          source_name: string
          source_url: string
          why_it_matters: string
        }
        Insert: {
          category: string
          dismissed?: boolean
          headline: string
          id?: string
          matched_company_id?: string | null
          published_at: string
          relevance_score?: number
          source_name: string
          source_url: string
          why_it_matters?: string
        }
        Update: {
          category?: string
          dismissed?: boolean
          headline?: string
          id?: string
          matched_company_id?: string | null
          published_at?: string
          relevance_score?: number
          source_name?: string
          source_url?: string
          why_it_matters?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_items_matched_company_id_fkey"
            columns: ["matched_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_drafts: {
        Row: {
          approved_at: string | null
          body: string
          channel: string
          collateral_id: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          created_by: string
          id: string
          status: string
          subject: string
        }
        Insert: {
          approved_at?: string | null
          body: string
          channel?: string
          collateral_id?: string | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          subject: string
        }
        Update: {
          approved_at?: string | null
          body?: string
          channel?: string
          collateral_id?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_drafts_collateral_id_fkey"
            columns: ["collateral_id"]
            isOneToOne: false
            referencedRelation: "collateral"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_activity: {
        Row: {
          company_id: string | null
          company_name: string
          contact_name: string
          contact_title: string
          created_at: string
          est_opportunity_size: string
          id: string
          misc_comments: string | null
          notes: string
          occurred_on: string
          star_rating: number | null
          status: string
          submitted_by: string
          type: string
        }
        Insert: {
          company_id?: string | null
          company_name: string
          contact_name?: string
          contact_title?: string
          created_at?: string
          est_opportunity_size?: string
          id?: string
          misc_comments?: string | null
          notes?: string
          occurred_on?: string
          star_rating?: number | null
          status?: string
          submitted_by: string
          type: string
        }
        Update: {
          company_id?: string | null
          company_name?: string
          contact_name?: string
          contact_title?: string
          created_at?: string
          est_opportunity_size?: string
          id?: string
          misc_comments?: string | null
          notes?: string
          occurred_on?: string
          star_rating?: number | null
          status?: string
          submitted_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          email: string
          id: string
          last_active: string
          name: string
          role: string
          unit: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_active?: string
          name: string
          role: string
          unit: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_active?: string
          name?: string
          role?: string
          unit?: string
        }
        Relationships: []
      }
      run_log: {
        Row: {
          confidence: number | null
          created_at: string
          detail: string | null
          duration_ms: number
          id: string
          pipeline: string
          records: number
          run_date: string
          sequence: number
          stage: string
          status: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          detail?: string | null
          duration_ms?: number
          id?: string
          pipeline?: string
          records?: number
          run_date: string
          sequence?: number
          stage: string
          status?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          detail?: string | null
          duration_ms?: number
          id?: string
          pipeline?: string
          records?: number
          run_date?: string
          sequence?: number
          stage?: string
          status?: string
        }
        Relationships: []
      }
      score_runs: {
        Row: {
          classified_state: string | null
          company_id: string
          created_at: string
          final_score: number
          id: string
          rank: number | null
          raw_score: number
          run_date: string
          score_breakdown: Json | null
        }
        Insert: {
          classified_state?: string | null
          company_id: string
          created_at?: string
          final_score: number
          id?: string
          rank?: number | null
          raw_score: number
          run_date?: string
          score_breakdown?: Json | null
        }
        Update: {
          classified_state?: string | null
          company_id?: string
          created_at?: string
          final_score?: number
          id?: string
          rank?: number | null
          raw_score?: number
          run_date?: string
          score_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "score_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      state_history: {
        Row: {
          actor: string
          company_id: string
          corrected_state: string | null
          created_at: string
          from_state: string | null
          id: string
          predicted_state: string | null
          reason: string | null
          to_state: string
        }
        Insert: {
          actor: string
          company_id: string
          corrected_state?: string | null
          created_at?: string
          from_state?: string | null
          id?: string
          predicted_state?: string | null
          reason?: string | null
          to_state: string
        }
        Update: {
          actor?: string
          company_id?: string
          corrected_state?: string | null
          created_at?: string
          from_state?: string | null
          id?: string
          predicted_state?: string | null
          reason?: string | null
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      touchpoints: {
        Row: {
          company_id: string
          contact_id: string | null
          crm_id: string | null
          est_opportunity_size: string
          extraction_confidence: number | null
          id: string
          misc_comments: string | null
          notes: string
          occurred_at: string
          source_captured_at: string | null
          source_excerpt: string | null
          source_ref: string | null
          source_system: string
          star_rating: number | null
          type: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          crm_id?: string | null
          est_opportunity_size?: string
          extraction_confidence?: number | null
          id?: string
          misc_comments?: string | null
          notes?: string
          occurred_at: string
          source_captured_at?: string | null
          source_excerpt?: string | null
          source_ref?: string | null
          source_system?: string
          star_rating?: number | null
          type: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          crm_id?: string | null
          est_opportunity_size?: string
          extraction_confidence?: number | null
          id?: string
          misc_comments?: string | null
          notes?: string
          occurred_at?: string
          source_captured_at?: string | null
          source_excerpt?: string | null
          source_ref?: string | null
          source_system?: string
          star_rating?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "touchpoints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touchpoints_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touchpoints_crm_id_fkey"
            columns: ["crm_id"]
            isOneToOne: false
            referencedRelation: "crms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_demo_data: { Args: never; Returns: Json }
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
