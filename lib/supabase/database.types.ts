
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agent_runs": {
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_member":
{ Args: { "p_business_id": string,"p_contact": string,"p_role": Database["public"]['Enums']["business_role"] }; Returns: string
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
"enqueue_job":
{ Args: { "p_business_id"?: string,"p_dedupe_key"?: string,"p_max_attempts"?: number,"p_payload"?: Json,"p_run_at"?: string,"p_type": string }; Returns: string
                           },
"fail_job":
{ Args: { "p_error": string,"p_job_id": string,"p_retryable"?: boolean }; Returns: Database["public"]['Enums']["job_status"]
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
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
            "actor_type": "user"|"agent"|"system","business_role": "owner"|"staff"|"partner"|"program_admin","capture_channel": "text"|"voice"|"photo"|"forward","capture_status": "received"|"processing"|"drafted"|"resolved"|"failed","draft_status": "proposed"|"confirmed"|"rejected","job_status": "queued"|"running"|"succeeded"|"failed"|"dead","payment_method": "cash"|"transfer"|"mobile_money"|"card"|"credit"|"other","provenance": "self_reported"|"document_backed"|"third_party_verified"|"institution_verified","pulse_state": "strong"|"steady"|"watch"|"at_risk"|"insufficient_data","pulse_trend": "up"|"flat"|"down"|"unknown","record_kind": "sale"|"expense"|"stock_movement"|"customer","stock_reason": "purchase"|"sale"|"adjustment"|"waste"|"return"
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
            "actor_type": ["user", "agent", "system"],"business_role": ["owner", "staff", "partner", "program_admin"],"capture_channel": ["text", "voice", "photo", "forward"],"capture_status": ["received", "processing", "drafted", "resolved", "failed"],"draft_status": ["proposed", "confirmed", "rejected"],"job_status": ["queued", "running", "succeeded", "failed", "dead"],"payment_method": ["cash", "transfer", "mobile_money", "card", "credit", "other"],"provenance": ["self_reported", "document_backed", "third_party_verified", "institution_verified"],"pulse_state": ["strong", "steady", "watch", "at_risk", "insufficient_data"],"pulse_trend": ["up", "flat", "down", "unknown"],"record_kind": ["sale", "expense", "stock_movement", "customer"],"stock_reason": ["purchase", "sale", "adjustment", "waste", "return"]
          }
        }
} as const

