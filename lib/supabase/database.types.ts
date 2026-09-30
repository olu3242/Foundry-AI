
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"business_id": string,"changed_at": string,"id": number,"new_row": Json | null,"old_row": Json | null,"row_id": string | null,"table_name": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"business_id": string,"changed_at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"business_id"?: string,"changed_at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"businesses": {
                  Row: {
                    "archived_at": string | null,"country_code": string,"created_at": string,"created_by": string,"currency": string,"id": string,"name": string,"sector": string | null,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"country_code"?: string,"created_at"?: string,"created_by": string,"currency"?: string,"id"?: string,"name": string,"sector"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"id"?: string,"name"?: string,"sector"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "actor_id": string | null,"actor_type": Database["public"]['Enums']["actor_type"],"business_id": string,"entity_id": string | null,"entity_type": string | null,"id": number,"occurred_at": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"business_id": string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_type"?: Database["public"]['Enums']["actor_type"],"business_id"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"occurred_at"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"idempotency_keys": {
                  Row: {
                    "created_at": string,"expires_at": string,"key": string,"request_hash": string,"response": Json | null,"scope": string,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"key": string,"request_hash": string,"response"?: Json | null,"scope": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"key"?: string,"request_hash"?: string,"response"?: Json | null,"scope"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"business_id": string | null,"created_at": string,"dedupe_key": string | null,"finished_at": string | null,"id": string,"last_error": string | null,"locked_at": string | null,"locked_by": string | null,"max_attempts": number,"payload": NonNullable<Json>,"priority": number,"result": Json | null,"run_at": string,"status": Database["public"]['Enums']["job_status"],"type": string,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"business_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"priority"?: number,"result"?: Json | null,"run_at"?: string,"status"?: Database["public"]['Enums']["job_status"],"type": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"business_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"priority"?: number,"result"?: Json | null,"run_at"?: string,"status"?: Database["public"]['Enums']["job_status"],"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "business_id": string,"created_at": string,"role": Database["public"]['Enums']["business_role"],"user_id": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"role": Database["public"]['Enums']["business_role"],"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["business_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"locale": string,"phone": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"locale"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"locale"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_member":
{ Args: { "p_business_id": string,"p_contact": string,"p_role": Database["public"]['Enums']["business_role"] }; Returns: string
                           },
"claim_jobs":
{ Args: { "p_job_id"?: string,"p_limit"?: number,"p_types"?: (string)[],"p_worker": string }; Returns: {
              "attempts": number,
"business_id": string | null,
"created_at": string,
"dedupe_key": string | null,
"finished_at": string | null,
"id": string,
"last_error": string | null,
"locked_at": string | null,
"locked_by": string | null,
"max_attempts": number,
"payload": NonNullable<Json>,
"priority": number,
"result": Json | null,
"run_at": string,
"status": Database["public"]['Enums']["job_status"],
"type": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_job":
{ Args: { "p_job_id": string,"p_result"?: Json }; Returns: undefined
                           },
"create_business":
{ Args: { "p_country_code"?: string,"p_currency"?: string,"p_name": string,"p_sector"?: string,"p_timezone"?: string }; Returns: string
                           },
"enqueue_job":
{ Args: { "p_business_id"?: string,"p_dedupe_key"?: string,"p_max_attempts"?: number,"p_payload"?: Json,"p_run_at"?: string,"p_type": string }; Returns: string
                           },
"fail_job":
{ Args: { "p_error": string,"p_job_id": string,"p_retryable"?: boolean }; Returns: Database["public"]['Enums']["job_status"]
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"purge_expired_ops":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"reap_stale_jobs":
{ Args: { "p_timeout"?: string }; Returns: number
                           }
          }
          Enums: {
            "actor_type": "user"|"agent"|"system","business_role": "owner"|"staff"|"partner"|"program_admin","job_status": "queued"|"running"|"succeeded"|"failed"|"dead"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "actor_type": ["user", "agent", "system"],"business_role": ["owner", "staff", "partner", "program_admin"],"job_status": ["queued", "running", "succeeded", "failed", "dead"]
          }
        }
} as const

