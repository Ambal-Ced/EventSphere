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
