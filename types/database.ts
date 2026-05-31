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
      care_logs: {
        Row: {
          created_at: string;
          id: string;
          logged_at: string;
          note: string | null;
          photo_url: string | null;
          task_type: "water" | "fertilize" | "repot" | "prune" | "rotate" | "mist" | "note" | "growth_photo";
          user_id: string;
          user_plant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logged_at?: string;
          note?: string | null;
          photo_url?: string | null;
          task_type: "water" | "fertilize" | "repot" | "prune" | "rotate" | "mist" | "note" | "growth_photo";
          user_id: string;
          user_plant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logged_at?: string;
          note?: string | null;
          photo_url?: string | null;
          task_type?: "water" | "fertilize" | "repot" | "prune" | "rotate" | "mist" | "note" | "growth_photo";
          user_id?: string;
          user_plant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "care_logs_user_plant_id_fkey";
            columns: ["user_plant_id"];
            isOneToOne: false;
            referencedRelation: "user_plants";
            referencedColumns: ["id"];
          }
        ];
      };
      care_tasks: {
        Row: {
          created_at: string;
          id: string;
          interval_days: number;
          is_active: boolean;
          next_due_date: string;
          type: "water" | "fertilize" | "repot" | "prune" | "rotate" | "mist" | "check_diagnosis";
          updated_at: string;
          user_id: string;
          user_plant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          interval_days: number;
          is_active?: boolean;
          next_due_date: string;
          type: "water" | "fertilize" | "repot" | "prune" | "rotate" | "mist" | "check_diagnosis";
          updated_at?: string;
          user_id: string;
          user_plant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          interval_days?: number;
          is_active?: boolean;
          next_due_date?: string;
          type?: "water" | "fertilize" | "repot" | "prune" | "rotate" | "mist" | "check_diagnosis";
          updated_at?: string;
          user_id?: string;
          user_plant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "care_tasks_user_plant_id_fkey";
            columns: ["user_plant_id"];
            isOneToOne: false;
            referencedRelation: "user_plants";
            referencedColumns: ["id"];
          }
        ];
      };
      diagnoses: {
        Row: {
          category: "disease" | "pest" | "nutrient_deficiency" | "environmental" | "unknown";
          cause: string | null;
          condition_name: string;
          confidence: number | null;
          created_at: string;
          follow_up_date: string | null;
          follow_up_days: number;
          id: string;
          is_healthy: boolean;
          photo_url: string | null;
          prevention: string | null;
          severity: "mild" | "moderate" | "severe";
          treatment: string | null;
          treatment_steps: Json;
          updated_at: string;
          user_id: string;
          user_plant_id: string | null;
        };
        Insert: {
          category?: "disease" | "pest" | "nutrient_deficiency" | "environmental" | "unknown";
          cause?: string | null;
          condition_name: string;
          confidence?: number | null;
          created_at?: string;
          follow_up_date?: string | null;
          follow_up_days?: number;
          id?: string;
          is_healthy?: boolean;
          photo_url?: string | null;
          prevention?: string | null;
          severity?: "mild" | "moderate" | "severe";
          treatment?: string | null;
          treatment_steps?: Json;
          updated_at?: string;
          user_id: string;
          user_plant_id?: string | null;
        };
        Update: {
          category?: "disease" | "pest" | "nutrient_deficiency" | "environmental" | "unknown";
          cause?: string | null;
          condition_name?: string;
          confidence?: number | null;
          created_at?: string;
          follow_up_date?: string | null;
          follow_up_days?: number;
          id?: string;
          is_healthy?: boolean;
          photo_url?: string | null;
          prevention?: string | null;
          severity?: "mild" | "moderate" | "severe";
          treatment?: string | null;
          treatment_steps?: Json;
          updated_at?: string;
          user_id?: string;
          user_plant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "diagnoses_user_plant_id_fkey";
            columns: ["user_plant_id"];
            isOneToOne: false;
            referencedRelation: "user_plants";
            referencedColumns: ["id"];
          }
        ];
      };
      scan_cache: {
        Row: {
          created_at: string;
          id: string;
          image_hash: string;
          result: Json;
          scan_type: "identify" | "diagnose";
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_hash: string;
          result: Json;
          scan_type: "identify" | "diagnose";
        };
        Update: {
          created_at?: string;
          id?: string;
          image_hash?: string;
          result?: Json;
          scan_type?: "identify" | "diagnose";
        };
        Relationships: [];
      };
      scan_events: {
        Row: {
          cache_hit: boolean;
          created_at: string;
          id: string;
          image_hash: string;
          scan_type: "identify" | "diagnose";
          user_id: string;
        };
        Insert: {
          cache_hit?: boolean;
          created_at?: string;
          id?: string;
          image_hash: string;
          scan_type: "identify" | "diagnose";
          user_id: string;
        };
        Update: {
          cache_hit?: boolean;
          created_at?: string;
          id?: string;
          image_hash?: string;
          scan_type?: "identify" | "diagnose";
          user_id?: string;
        };
        Relationships: [];
      };
      species: {
        Row: {
          care_profile: Json;
          common_name: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          scientific_name: string | null;
          updated_at: string;
        };
        Insert: {
          care_profile: Json;
          common_name: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          scientific_name?: string | null;
          updated_at?: string;
        };
        Update: {
          care_profile?: Json;
          common_name?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          scientific_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_plants: {
        Row: {
          created_at: string;
          date_added: string;
          id: string;
          location: string | null;
          nickname: string | null;
          photo_url: string | null;
          species_id: string | null;
          status: "healthy" | "needs_attention" | "sick";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date_added?: string;
          id?: string;
          location?: string | null;
          nickname?: string | null;
          photo_url?: string | null;
          species_id?: string | null;
          status?: "healthy" | "needs_attention" | "sick";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date_added?: string;
          id?: string;
          location?: string | null;
          nickname?: string | null;
          photo_url?: string | null;
          species_id?: string | null;
          status?: "healthy" | "needs_attention" | "sick";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_plants_species_id_fkey";
            columns: ["species_id"];
            isOneToOne: false;
            referencedRelation: "species";
            referencedColumns: ["id"];
          }
        ];
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
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;
