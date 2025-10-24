export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          created_at: string;
          title: string;
          description: string;
          date: string;
          location: string;
          category: string;
          is_public: boolean;
          user_id: string;
          max_participants: number | null;
          price: number | null;
          image_url: string | null;
          status: string;
          role: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          description: string;
          date: string;
          location: string;
          category: string;
          is_public: boolean;
          user_id: string;
          max_participants?: number | null;
          price?: number | null;
          image_url?: string | null;
          status?: string;
          role?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          description?: string;
          date?: string;
          location?: string;
          category?: string;
          is_public?: boolean;
          user_id?: string;
          max_participants?: number | null;
          price?: number | null;
          image_url?: string | null;
          status?: string;
          role?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          created_at: string;
          event_id: string;
          user_id: string;
          status: string;
          qr_code: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          event_id: string;
          user_id: string;
          status?: string;
          qr_code?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          event_id?: string;
          user_id?: string;
          status?: string;
          qr_code?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          username: string;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          username?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
        };
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          price_cents: number;
          currency: string;
          billing_period: string;
          features: Json;
          limits: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price_cents: number;
          currency?: string;
          billing_period: string;
          features?: Json;
          limits?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price_cents?: number;
          currency?: string;
          billing_period?: string;
          features?: Json;
          limits?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          trial_start: string | null;
          trial_end: string | null;
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          trial_start?: string | null;
          trial_end?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          trial_start?: string | null;
          trial_end?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_usage: {
        Row: {
          id: string;
          user_id: string;
          usage_type: string;
          event_id: string | null;
          count: number;
          period_start: string;
          period_end: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          usage_type: string;
          event_id?: string | null;
          count?: number;
          period_start: string;
          period_end: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          usage_type?: string;
          event_id?: string | null;
          count?: number;
          period_start?: string;
          period_end?: string;
          created_at?: string;
        };
      };
      billing_history: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string;
          payment_intent_id: string;
          amount: number;
          currency: string;
          status: string;
          card_info: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id: string;
          payment_intent_id: string;
          amount: number;
          currency: string;
          status: string;
          card_info?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string;
          payment_intent_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          card_info?: Json | null;
          created_at?: string;
        };
      };
      account_status: {
        Row: {
          id: string;
          user_id: string;
          new_account: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          new_account?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          new_account?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
