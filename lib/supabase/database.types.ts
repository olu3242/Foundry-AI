
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agent_actions": {
                  Row: {
                    "action_type": string,"agent_run_id": string | null,"autonomy_level": number,"body": string | null,"business_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"dedupe_key": string | null,"executed_at": string | null,"expires_at": string | null,"id": string,"payload": NonNullable<Json>,"result": Json | null,"source": string | null,"status": Database["public"]['Enums']["action_status"],"title": string
                  }
                  Insert: {
                    "action_type": string,"agent_run_id"?: string | null,"autonomy_level": number,"body"?: string | null,"business_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"dedupe_key"?: string | null,"executed_at"?: string | null,"expires_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"result"?: Json | null,"source"?: string | null,"status"?: Database["public"]['Enums']["action_status"],"title": string
                  }
                  Update: {
                    "action_type"?: string,"agent_run_id"?: string | null,"autonomy_level"?: number,"body"?: string | null,"business_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"dedupe_key"?: string | null,"executed_at"?: string | null,"expires_at"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"result"?: Json | null,"source"?: string | null,"status"?: Database["public"]['Enums']["action_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_actions_agent_run_id_fkey"
      columns: ["agent_run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_actions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_actions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_runs": {
                  Row: {
                    "agent": string,"business_id": string,"created_at": string,"error": string | null,"id": string,"input_tokens": number | null,"latency_ms": number | null,"model": string | null,"output": Json | null,"output_tokens": number | null,"status": string,"subject_id": string | null,"subject_type": string | null,"trigger": string
                  }
                  Insert: {
                    "agent": string,"business_id": string,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number | null,"latency_ms"?: number | null,"model"?: string | null,"output"?: Json | null,"output_tokens"?: number | null,"status": string,"subject_id"?: string | null,"subject_type"?: string | null,"trigger": string
                  }
                  Update: {
                    "agent"?: string,"business_id"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number | null,"latency_ms"?: number | null,"model"?: string | null,"output"?: Json | null,"output_tokens"?: number | null,"status"?: string,"subject_id"?: string | null,"subject_type"?: string | null,"trigger"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_runs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
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
                },"autonomy_policies": {
                  Row: {
                    "action_type": string,"business_id": string,"level": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "action_type": string,"business_id": string,"level": number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "action_type"?: string,"business_id"?: string,"level"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "autonomy_policies_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "autonomy_policies_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"captures": {
                  Row: {
                    "business_id": string,"channel": Database["public"]['Enums']["capture_channel"],"client_ref": string | null,"created_at": string,"created_by": string,"error": string | null,"id": string,"mime_type": string | null,"processed_at": string | null,"raw_text": string | null,"status": Database["public"]['Enums']["capture_status"],"storage_path": string | null,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"channel": Database["public"]['Enums']["capture_channel"],"client_ref"?: string | null,"created_at"?: string,"created_by"?: string,"error"?: string | null,"id"?: string,"mime_type"?: string | null,"processed_at"?: string | null,"raw_text"?: string | null,"status"?: Database["public"]['Enums']["capture_status"],"storage_path"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"channel"?: Database["public"]['Enums']["capture_channel"],"client_ref"?: string | null,"created_at"?: string,"created_by"?: string,"error"?: string | null,"id"?: string,"mime_type"?: string | null,"processed_at"?: string | null,"raw_text"?: string | null,"status"?: Database["public"]['Enums']["capture_status"],"storage_path"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "captures_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "captures_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null,"provenance": Database["public"]['Enums']["provenance"],"source_draft_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null,"provenance"?: Database["public"]['Enums']["provenance"],"source_draft_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null,"provenance"?: Database["public"]['Enums']["provenance"],"source_draft_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_source_draft_id_fkey"
      columns: ["source_draft_id"]
isOneToOne: false
      referencedRelation: "record_drafts"
      referencedColumns: ["id"]
    }
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
                },"expenses": {
                  Row: {
                    "amount_minor": number,"business_id": string,"category": string,"created_at": string,"created_by": string | null,"currency": string,"description": string | null,"id": string,"occurred_at": string,"payment_method": Database["public"]['Enums']["payment_method"],"provenance": Database["public"]['Enums']["provenance"],"source_capture_id": string | null,"source_draft_id": string | null,"supplier": string | null,"updated_at": string,"voided_at": string | null
                  }
                  Insert: {
                    "amount_minor": number,"business_id": string,"category": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"description"?: string | null,"id"?: string,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"supplier"?: string | null,"updated_at"?: string,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"business_id"?: string,"category"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"supplier"?: string | null,"updated_at"?: string,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_source_capture_id_fkey"
      columns: ["source_capture_id"]
isOneToOne: false
      referencedRelation: "captures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_source_draft_id_fkey"
      columns: ["source_draft_id"]
isOneToOne: false
      referencedRelation: "record_drafts"
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
                },"opportunities": {
                  Row: {
                    "budget_max_minor": number | null,"budget_min_minor": number | null,"category": string,"contact": string | null,"countries": (string)[],"created_at": string,"created_by": string | null,"currency": string | null,"deadline": string | null,"description": string,"id": string,"is_sample": boolean,"min_months_records": number,"min_proof_level": Database["public"]['Enums']["provenance"],"posted_by_business_id": string | null,"sectors": (string)[],"status": string,"title": string
                  }
                  Insert: {
                    "budget_max_minor"?: number | null,"budget_min_minor"?: number | null,"category": string,"contact"?: string | null,"countries"?: (string)[],"created_at"?: string,"created_by"?: string | null,"currency"?: string | null,"deadline"?: string | null,"description": string,"id"?: string,"is_sample"?: boolean,"min_months_records"?: number,"min_proof_level"?: Database["public"]['Enums']["provenance"],"posted_by_business_id"?: string | null,"sectors"?: (string)[],"status"?: string,"title": string
                  }
                  Update: {
                    "budget_max_minor"?: number | null,"budget_min_minor"?: number | null,"category"?: string,"contact"?: string | null,"countries"?: (string)[],"created_at"?: string,"created_by"?: string | null,"currency"?: string | null,"deadline"?: string | null,"description"?: string,"id"?: string,"is_sample"?: boolean,"min_months_records"?: number,"min_proof_level"?: Database["public"]['Enums']["provenance"],"posted_by_business_id"?: string | null,"sectors"?: (string)[],"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_posted_by_business_id_fkey"
      columns: ["posted_by_business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunity_matches": {
                  Row: {
                    "business_id": string,"created_at": string,"eligible": boolean,"gaps": NonNullable<Json>,"opportunity_id": string,"reasons": NonNullable<Json>,"score": number,"status": string,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"eligible": boolean,"gaps"?: NonNullable<Json>,"opportunity_id": string,"reasons"?: NonNullable<Json>,"score": number,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"eligible"?: boolean,"gaps"?: NonNullable<Json>,"opportunity_id"?: string,"reasons"?: NonNullable<Json>,"score"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_matches_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_matches_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    }
                  ]
                },"partner_assignments": {
                  Row: {
                    "business_id": string,"created_at": string,"partner_user_id": string,"program_id": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"partner_user_id": string,"program_id": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"partner_user_id"?: string,"program_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partner_assignments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partner_assignments_partner_user_id_fkey"
      columns: ["partner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partner_assignments_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"passport_shares": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string,"expires_at": string,"id": string,"label": string,"last_viewed_at": string | null,"revoked_at": string | null,"sections": (string)[],"token_hash": string,"view_count": number
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string,"expires_at": string,"id"?: string,"label": string,"last_viewed_at"?: string | null,"revoked_at"?: string | null,"sections": (string)[],"token_hash": string,"view_count"?: number
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"label"?: string,"last_viewed_at"?: string | null,"revoked_at"?: string | null,"sections"?: (string)[],"token_hash"?: string,"view_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "passport_shares_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passport_shares_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"passport_views": {
                  Row: {
                    "business_id": string,"id": number,"share_id": string,"viewed_at": string,"viewer_hash": string | null
                  }
                  Insert: {
                    "business_id": string,"id"?: never,"share_id": string,"viewed_at"?: string,"viewer_hash"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"id"?: never,"share_id"?: string,"viewed_at"?: string,"viewer_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "passport_views_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passport_views_share_id_fkey"
      columns: ["share_id"]
isOneToOne: false
      referencedRelation: "passport_shares"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "business_id": string,"created_at": string,"id": string,"name": string,"reorder_level": number | null,"stock_qty": number,"unit": string | null,"unit_price_minor": number | null,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"id"?: string,"name": string,"reorder_level"?: number | null,"stock_qty"?: number,"unit"?: string | null,"unit_price_minor"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"reorder_level"?: number | null,"stock_qty"?: number,"unit"?: string | null,"unit_price_minor"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
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
                },"program_enrollments": {
                  Row: {
                    "business_id": string,"consent_scope": (string)[],"consented_at": string | null,"consented_by": string | null,"enrolled_at": string,"left_at": string | null,"program_id": string,"status": string
                  }
                  Insert: {
                    "business_id": string,"consent_scope"?: (string)[],"consented_at"?: string | null,"consented_by"?: string | null,"enrolled_at"?: string,"left_at"?: string | null,"program_id": string,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"consent_scope"?: (string)[],"consented_at"?: string | null,"consented_by"?: string | null,"enrolled_at"?: string,"left_at"?: string | null,"program_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_enrollments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_enrollments_consented_by_fkey"
      columns: ["consented_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_enrollments_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"program_members": {
                  Row: {
                    "created_at": string,"program_id": string,"role": Database["public"]['Enums']["program_role"],"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"program_id": string,"role": Database["public"]['Enums']["program_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"program_id"?: string,"role"?: Database["public"]['Enums']["program_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_members_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "created_at": string,"created_by": string,"current_period_end": string | null,"description": string | null,"id": string,"join_code": string,"name": string,"pilot_seats": number,"seats": number,"sponsor_name": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"subscription_status": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"current_period_end"?: string | null,"description"?: string | null,"id"?: string,"join_code"?: string,"name": string,"pilot_seats"?: number,"seats"?: number,"sponsor_name"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"current_period_end"?: string | null,"description"?: string | null,"id"?: string,"join_code"?: string,"name"?: string,"pilot_seats"?: number,"seats"?: number,"sponsor_name"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pulse_snapshots": {
                  Row: {
                    "action": string | null,"business_id": string,"computed_at": string,"computed_on": string,"dimension": string,"evidence": NonNullable<Json>,"id": string,"score": number | null,"state": Database["public"]['Enums']["pulse_state"],"trend": Database["public"]['Enums']["pulse_trend"],"why": string
                  }
                  Insert: {
                    "action"?: string | null,"business_id": string,"computed_at"?: string,"computed_on": string,"dimension": string,"evidence"?: NonNullable<Json>,"id"?: string,"score"?: number | null,"state": Database["public"]['Enums']["pulse_state"],"trend"?: Database["public"]['Enums']["pulse_trend"],"why": string
                  }
                  Update: {
                    "action"?: string | null,"business_id"?: string,"computed_at"?: string,"computed_on"?: string,"dimension"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"score"?: number | null,"state"?: Database["public"]['Enums']["pulse_state"],"trend"?: Database["public"]['Enums']["pulse_trend"],"why"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pulse_snapshots_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"record_drafts": {
                  Row: {
                    "agent_run_id": string | null,"business_id": string,"capture_id": string,"confidence": number,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"evidence": NonNullable<Json>,"explanation": string | null,"fields": NonNullable<Json>,"id": string,"kind": Database["public"]['Enums']["record_kind"],"record_id": string | null,"status": Database["public"]['Enums']["draft_status"]
                  }
                  Insert: {
                    "agent_run_id"?: string | null,"business_id": string,"capture_id": string,"confidence": number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"explanation"?: string | null,"fields": NonNullable<Json>,"id"?: string,"kind": Database["public"]['Enums']["record_kind"],"record_id"?: string | null,"status"?: Database["public"]['Enums']["draft_status"]
                  }
                  Update: {
                    "agent_run_id"?: string | null,"business_id"?: string,"capture_id"?: string,"confidence"?: number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"explanation"?: string | null,"fields"?: NonNullable<Json>,"id"?: string,"kind"?: Database["public"]['Enums']["record_kind"],"record_id"?: string | null,"status"?: Database["public"]['Enums']["draft_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "record_drafts_agent_run_id_fkey"
      columns: ["agent_run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "record_drafts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "record_drafts_capture_id_fkey"
      columns: ["capture_id"]
isOneToOne: false
      referencedRelation: "captures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "record_drafts_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_items": {
                  Row: {
                    "business_id": string,"description": string,"id": string,"line_total_minor": number,"product_id": string | null,"quantity": number,"sale_id": string,"unit_price_minor": number
                  }
                  Insert: {
                    "business_id": string,"description": string,"id"?: string,"line_total_minor": number,"product_id"?: string | null,"quantity": number,"sale_id": string,"unit_price_minor": number
                  }
                  Update: {
                    "business_id"?: string,"description"?: string,"id"?: string,"line_total_minor"?: number,"product_id"?: string | null,"quantity"?: number,"sale_id"?: string,"unit_price_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "amount_paid_minor": number,"business_id": string,"created_at": string,"created_by": string | null,"currency": string,"customer_id": string | null,"id": string,"notes": string | null,"occurred_at": string,"payment_method": Database["public"]['Enums']["payment_method"],"provenance": Database["public"]['Enums']["provenance"],"source_capture_id": string | null,"source_draft_id": string | null,"total_minor": number,"updated_at": string,"voided_at": string | null
                  }
                  Insert: {
                    "amount_paid_minor": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"customer_id"?: string | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"total_minor": number,"updated_at"?: string,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_paid_minor"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"customer_id"?: string | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"total_minor"?: number,"updated_at"?: string,"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_source_capture_id_fkey"
      columns: ["source_capture_id"]
isOneToOne: false
      referencedRelation: "captures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_source_draft_id_fkey"
      columns: ["source_draft_id"]
isOneToOne: false
      referencedRelation: "record_drafts"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"occurred_at": string,"product_id": string,"provenance": Database["public"]['Enums']["provenance"],"quantity_delta": number,"reason": Database["public"]['Enums']["stock_reason"],"sale_id": string | null,"source_capture_id": string | null,"source_draft_id": string | null,"unit_cost_minor": number | null
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"product_id": string,"provenance"?: Database["public"]['Enums']["provenance"],"quantity_delta": number,"reason": Database["public"]['Enums']["stock_reason"],"sale_id"?: string | null,"source_capture_id"?: string | null,"source_draft_id"?: string | null,"unit_cost_minor"?: number | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"product_id"?: string,"provenance"?: Database["public"]['Enums']["provenance"],"quantity_delta"?: number,"reason"?: Database["public"]['Enums']["stock_reason"],"sale_id"?: string | null,"source_capture_id"?: string | null,"source_draft_id"?: string | null,"unit_cost_minor"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_source_capture_id_fkey"
      columns: ["source_capture_id"]
isOneToOne: false
      referencedRelation: "captures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_source_draft_id_fkey"
      columns: ["source_draft_id"]
isOneToOne: false
      referencedRelation: "record_drafts"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "id": string,"processed_at": string,"program_id": string | null,"type": string
                  }
                  Insert: {
                    "id": string,"processed_at"?: string,"program_id"?: string | null,"type": string
                  }
                  Update: {
                    "id"?: string,"processed_at"?: string,"program_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"verifications": {
                  Row: {
                    "business_id": string,"created_at": string,"evidence_path": string | null,"id": string,"level": Database["public"]['Enums']["provenance"],"method": string,"note": string | null,"period_end": string | null,"period_start": string | null,"subject_id": string | null,"subject_type": Database["public"]['Enums']["verification_subject"],"verified_by": string,"verifier_role": Database["public"]['Enums']["business_role"]
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"evidence_path"?: string | null,"id"?: string,"level": Database["public"]['Enums']["provenance"],"method": string,"note"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"subject_id"?: string | null,"subject_type": Database["public"]['Enums']["verification_subject"],"verified_by"?: string,"verifier_role": Database["public"]['Enums']["business_role"]
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"evidence_path"?: string | null,"id"?: string,"level"?: Database["public"]['Enums']["provenance"],"method"?: string,"note"?: string | null,"period_end"?: string | null,"period_start"?: string | null,"subject_id"?: string | null,"subject_type"?: Database["public"]['Enums']["verification_subject"],"verified_by"?: string,"verifier_role"?: Database["public"]['Enums']["business_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifications_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifications_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
"add_program_member":
{ Args: { "p_contact": string,"p_program_id": string,"p_role": Database["public"]['Enums']["program_role"] }; Returns: string
                           },
"add_verification":
{ Args: { "p_business_id": string,"p_evidence_path"?: string,"p_level": Database["public"]['Enums']["provenance"],"p_method": string,"p_note"?: string,"p_period_end"?: string,"p_period_start"?: string,"p_subject_id"?: string,"p_subject_type": Database["public"]['Enums']["verification_subject"] }; Returns: string
                           },
"assign_partner":
{ Args: { "p_business_id": string,"p_partner_user_id": string,"p_program_id": string }; Returns: undefined
                           },
"business_summary":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "collected_minor": number,"customers_served": number,"expenses_minor": number,"net_minor": number,"receivable_minor": number,"sales_count": number,"sales_minor": number
            }[]
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
"confirm_draft":
{ Args: { "p_draft_id": string,"p_fields"?: Json }; Returns: string
                           },
"create_business":
{ Args: { "p_country_code"?: string,"p_currency"?: string,"p_name": string,"p_sector"?: string,"p_timezone"?: string }; Returns: string
                           },
"create_program":
{ Args: { "p_description"?: string,"p_name": string,"p_sponsor_name"?: string }; Returns: string
                           },
"decide_action":
{ Args: { "p_action_id": string,"p_decision": string,"p_result"?: Json }; Returns: undefined
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
"join_program":
{ Args: { "p_business_id": string,"p_consent": boolean,"p_join_code": string }; Returns: string
                           },
"leave_program":
{ Args: { "p_business_id": string,"p_program_id": string }; Returns: undefined
                           },
"my_business_role":
{ Args: { "p_business_id": string }; Returns: Database["public"]['Enums']["business_role"]
                           },
"passport_facts":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"pulse_metrics":
{ Args: { "p_as_of"?: string,"p_business_id": string }; Returns: Json
                           },
"purge_expired_ops":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"reap_stale_jobs":
{ Args: { "p_timeout"?: string }; Returns: number
                           },
"record_entry":
{ Args: { "p_business_id": string,"p_fields": Json,"p_kind": Database["public"]['Enums']["record_kind"] }; Returns: string
                           },
"reject_draft":
{ Args: { "p_draft_id": string }; Returns: undefined
                           },
"void_record":
{ Args: { "p_id": string,"p_kind": Database["public"]['Enums']["record_kind"],"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "action_status": "proposed"|"approved"|"rejected"|"executed"|"failed"|"expired","actor_type": "user"|"agent"|"system","business_role": "owner"|"staff"|"partner"|"program_admin","capture_channel": "text"|"voice"|"photo"|"forward","capture_status": "received"|"processing"|"drafted"|"resolved"|"failed","draft_status": "proposed"|"confirmed"|"rejected","job_status": "queued"|"running"|"succeeded"|"failed"|"dead","payment_method": "cash"|"transfer"|"mobile_money"|"card"|"credit"|"other","program_role": "admin"|"partner","provenance": "self_reported"|"document_backed"|"third_party_verified"|"institution_verified","pulse_state": "strong"|"steady"|"watch"|"at_risk"|"insufficient_data","pulse_trend": "up"|"flat"|"down"|"unknown","record_kind": "sale"|"expense"|"stock_movement"|"customer","stock_reason": "purchase"|"sale"|"adjustment"|"waste"|"return","verification_subject": "business"|"sale"|"expense"|"stock_movement"
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
            "action_status": ["proposed", "approved", "rejected", "executed", "failed", "expired"],"actor_type": ["user", "agent", "system"],"business_role": ["owner", "staff", "partner", "program_admin"],"capture_channel": ["text", "voice", "photo", "forward"],"capture_status": ["received", "processing", "drafted", "resolved", "failed"],"draft_status": ["proposed", "confirmed", "rejected"],"job_status": ["queued", "running", "succeeded", "failed", "dead"],"payment_method": ["cash", "transfer", "mobile_money", "card", "credit", "other"],"program_role": ["admin", "partner"],"provenance": ["self_reported", "document_backed", "third_party_verified", "institution_verified"],"pulse_state": ["strong", "steady", "watch", "at_risk", "insufficient_data"],"pulse_trend": ["up", "flat", "down", "unknown"],"record_kind": ["sale", "expense", "stock_movement", "customer"],"stock_reason": ["purchase", "sale", "adjustment", "waste", "return"],"verification_subject": ["business", "sale", "expense", "stock_movement"]
          }
        }
} as const

