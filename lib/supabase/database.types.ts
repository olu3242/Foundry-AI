
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "acquisition_attributions": {
                  Row: {
                    "attributed_at": string,"business_id": string,"channel": string,"invitation_id": string | null,"program_id": string | null,"source_partner_user_id": string | null
                  }
                  Insert: {
                    "attributed_at"?: string,"business_id": string,"channel": string,"invitation_id"?: string | null,"program_id"?: string | null,"source_partner_user_id"?: string | null
                  }
                  Update: {
                    "attributed_at"?: string,"business_id"?: string,"channel"?: string,"invitation_id"?: string | null,"program_id"?: string | null,"source_partner_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "acquisition_attributions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acquisition_attributions_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: false
      referencedRelation: "program_invitations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acquisition_attributions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "acquisition_attributions_source_partner_user_id_fkey"
      columns: ["source_partner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_actions": {
                  Row: {
                    "action_type": string,"agent_run_id": string | null,"autonomy_level": number,"body": string | null,"business_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"dedupe_key": string | null,"executed_at": string | null,"expires_at": string | null,"generator": string,"id": string,"payload": NonNullable<Json>,"rank_basis": Json | null,"rank_score": number | null,"result": Json | null,"solution_version_id": string | null,"source": string | null,"status": Database["public"]['Enums']["action_status"],"title": string
                  }
                  Insert: {
                    "action_type": string,"agent_run_id"?: string | null,"autonomy_level": number,"body"?: string | null,"business_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"dedupe_key"?: string | null,"executed_at"?: string | null,"expires_at"?: string | null,"generator"?: string,"id"?: string,"payload"?: NonNullable<Json>,"rank_basis"?: Json | null,"rank_score"?: number | null,"result"?: Json | null,"solution_version_id"?: string | null,"source"?: string | null,"status"?: Database["public"]['Enums']["action_status"],"title": string
                  }
                  Update: {
                    "action_type"?: string,"agent_run_id"?: string | null,"autonomy_level"?: number,"body"?: string | null,"business_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"dedupe_key"?: string | null,"executed_at"?: string | null,"expires_at"?: string | null,"generator"?: string,"id"?: string,"payload"?: NonNullable<Json>,"rank_basis"?: Json | null,"rank_score"?: number | null,"result"?: Json | null,"solution_version_id"?: string | null,"source"?: string | null,"status"?: Database["public"]['Enums']["action_status"],"title"?: string
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
    },{
      foreignKeyName: "agent_actions_solution_version_id_fkey"
      columns: ["solution_version_id"]
isOneToOne: false
      referencedRelation: "solution_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_runs": {
                  Row: {
                    "agent": string,"business_id": string,"created_at": string,"error": string | null,"id": string,"input_tokens": number | null,"latency_ms": number | null,"model": string | null,"output": Json | null,"output_tokens": number | null,"prompt_version": string | null,"status": string,"subject_id": string | null,"subject_type": string | null,"trigger": string
                  }
                  Insert: {
                    "agent": string,"business_id": string,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number | null,"latency_ms"?: number | null,"model"?: string | null,"output"?: Json | null,"output_tokens"?: number | null,"prompt_version"?: string | null,"status": string,"subject_id"?: string | null,"subject_type"?: string | null,"trigger": string
                  }
                  Update: {
                    "agent"?: string,"business_id"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"input_tokens"?: number | null,"latency_ms"?: number | null,"model"?: string | null,"output"?: Json | null,"output_tokens"?: number | null,"prompt_version"?: string | null,"status"?: string,"subject_id"?: string | null,"subject_type"?: string | null,"trigger"?: string
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
                },"ai_prices": {
                  Row: {
                    "model": string,"usd_per_mtok_in": number,"usd_per_mtok_out": number
                  }
                  Insert: {
                    "model": string,"usd_per_mtok_in": number,"usd_per_mtok_out": number
                  }
                  Update: {
                    "model"?: string,"usd_per_mtok_in"?: number,"usd_per_mtok_out"?: number
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"business_id": string | null,"changed_at": string,"id": number,"new_row": Json | null,"old_row": Json | null,"row_id": string | null,"table_name": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"business_id"?: string | null,"changed_at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"business_id"?: string | null,"changed_at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_id"?: string | null,"table_name"?: string
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
                },"benchmarks": {
                  Row: {
                    "avg_quality": number,"band": string | null,"cohort_key": string,"computed_at": string,"confidence": string,"country_code": string,"level": string,"metric": string,"n": number,"p25": number | null,"p50": number | null,"p75": number | null,"period_end": string,"sector": string | null,"weighted_median": number | null
                  }
                  Insert: {
                    "avg_quality": number,"band"?: string | null,"cohort_key": string,"computed_at"?: string,"confidence": string,"country_code": string,"level": string,"metric": string,"n": number,"p25"?: number | null,"p50"?: number | null,"p75"?: number | null,"period_end": string,"sector"?: string | null,"weighted_median"?: number | null
                  }
                  Update: {
                    "avg_quality"?: number,"band"?: string | null,"cohort_key"?: string,"computed_at"?: string,"confidence"?: string,"country_code"?: string,"level"?: string,"metric"?: string,"n"?: number,"p25"?: number | null,"p50"?: number | null,"p75"?: number | null,"period_end"?: string,"sector"?: string | null,"weighted_median"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"billable_events": {
                  Row: {
                    "amount_minor": number,"business_id": string,"created_at": string,"currency": string,"dedupe_key": string,"description": string,"engagement_id": string | null,"entitlement_id": string | null,"id": string,"kind": string,"payee_provider_id": string | null,"payer_kind": string,"payer_program_id": string | null,"payer_provider_id": string | null,"period_start": string | null,"settled_at": string | null,"status": string
                  }
                  Insert: {
                    "amount_minor": number,"business_id": string,"created_at"?: string,"currency": string,"dedupe_key": string,"description": string,"engagement_id"?: string | null,"entitlement_id"?: string | null,"id"?: string,"kind": string,"payee_provider_id"?: string | null,"payer_kind": string,"payer_program_id"?: string | null,"payer_provider_id"?: string | null,"period_start"?: string | null,"settled_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"business_id"?: string,"created_at"?: string,"currency"?: string,"dedupe_key"?: string,"description"?: string,"engagement_id"?: string | null,"entitlement_id"?: string | null,"id"?: string,"kind"?: string,"payee_provider_id"?: string | null,"payer_kind"?: string,"payer_program_id"?: string | null,"payer_provider_id"?: string | null,"period_start"?: string | null,"settled_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billable_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billable_events_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "solution_engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billable_events_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "entitlements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billable_events_payee_provider_id_fkey"
      columns: ["payee_provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billable_events_payer_program_id_fkey"
      columns: ["payer_program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billable_events_payer_provider_id_fkey"
      columns: ["payer_provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_plans": {
                  Row: {
                    "created_at": string,"currency": string,"entitlements": NonNullable<Json>,"id": string,"key": string,"name": string,"overage_minor": NonNullable<Json>,"payer_kind": string,"price_minor": number,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"entitlements"?: NonNullable<Json>,"id"?: string,"key": string,"name": string,"overage_minor"?: NonNullable<Json>,"payer_kind": string,"price_minor"?: number,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"entitlements"?: NonNullable<Json>,"id"?: string,"key"?: string,"name"?: string,"overage_minor"?: NonNullable<Json>,"payer_kind"?: string,"price_minor"?: number,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"business_baselines": {
                  Row: {
                    "business_id": string,"captured_at": string,"id": string,"metrics": NonNullable<Json>,"program_id": string | null,"pulse": NonNullable<Json>
                  }
                  Insert: {
                    "business_id": string,"captured_at"?: string,"id"?: string,"metrics": NonNullable<Json>,"program_id"?: string | null,"pulse"?: NonNullable<Json>
                  }
                  Update: {
                    "business_id"?: string,"captured_at"?: string,"id"?: string,"metrics"?: NonNullable<Json>,"program_id"?: string | null,"pulse"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_baselines_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_baselines_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"business_health": {
                  Row: {
                    "active_days_30": number,"active_days_prev_30": number,"business_id": string,"computed_at": string,"continuation": string,"last_activity_at": string | null,"reasons": NonNullable<Json>,"risk": string,"stage": string,"value": NonNullable<Json>
                  }
                  Insert: {
                    "active_days_30": number,"active_days_prev_30": number,"business_id": string,"computed_at"?: string,"continuation": string,"last_activity_at"?: string | null,"reasons"?: NonNullable<Json>,"risk": string,"stage": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "active_days_30"?: number,"active_days_prev_30"?: number,"business_id"?: string,"computed_at"?: string,"continuation"?: string,"last_activity_at"?: string | null,"reasons"?: NonNullable<Json>,"risk"?: string,"stage"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_health_business_id_fkey"
      columns: ["business_id"]
isOneToOne: true
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_identifiers": {
                  Row: {
                    "business_id": string,"created_at": string,"type": string,"value": string,"verified": boolean
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"type": string,"value": string,"verified"?: boolean
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"type"?: string,"value"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_identifiers_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address": NonNullable<Json>,"archived_at": string | null,"country_code": string,"created_at": string,"created_by": string,"currency": string,"id": string,"locale": string | null,"name": string,"sector": string | null,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "address"?: NonNullable<Json>,"archived_at"?: string | null,"country_code"?: string,"created_at"?: string,"created_by": string,"currency"?: string,"id"?: string,"locale"?: string | null,"name": string,"sector"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: NonNullable<Json>,"archived_at"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"id"?: string,"locale"?: string | null,"name"?: string,"sector"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "businesses_market_fk"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "markets"
      referencedColumns: ["country_code"]
    }
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
                },"cost_inputs": {
                  Row: {
                    "amount_usd": number,"category": string,"created_at": string,"id": string,"month": string,"note": string | null
                  }
                  Insert: {
                    "amount_usd": number,"category": string,"created_at"?: string,"id"?: string,"month": string,"note"?: string | null
                  }
                  Update: {
                    "amount_usd"?: number,"category"?: string,"created_at"?: string,"id"?: string,"month"?: string,"note"?: string | null
                  }
                  Relationships: [
                    
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
                },"engagement_updates": {
                  Row: {
                    "created_at": string,"created_by": string,"engagement_id": string,"id": string,"note": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"engagement_id": string,"id"?: string,"note": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"engagement_id"?: string,"id"?: string,"note"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "engagement_updates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_updates_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "solution_engagements"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlements": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"end_reason": string | null,"ends_at": string | null,"id": string,"payer_program_id": string | null,"payer_provider_id": string | null,"plan_id": string,"source": string,"starts_at": string,"status": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"end_reason"?: string | null,"ends_at"?: string | null,"id"?: string,"payer_program_id"?: string | null,"payer_provider_id"?: string | null,"plan_id": string,"source": string,"starts_at"?: string,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"end_reason"?: string | null,"ends_at"?: string | null,"id"?: string,"payer_program_id"?: string | null,"payer_provider_id"?: string | null,"plan_id"?: string,"source"?: string,"starts_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_payer_program_id_fkey"
      columns: ["payer_program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_payer_provider_id_fkey"
      columns: ["payer_provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "billing_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"eval_snapshots": {
                  Row: {
                    "drift": boolean,"id": string,"metrics": NonNullable<Json>,"scope": string,"subject": string,"taken_on": string
                  }
                  Insert: {
                    "drift"?: boolean,"id"?: string,"metrics": NonNullable<Json>,"scope": string,"subject": string,"taken_on"?: string
                  }
                  Update: {
                    "drift"?: boolean,"id"?: string,"metrics"?: NonNullable<Json>,"scope"?: string,"subject"?: string,"taken_on"?: string
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
                },"evidence_packages": {
                  Row: {
                    "business_id": string,"decided_at": string | null,"decided_by": string | null,"decision_amount_minor": number | null,"decision_note": string | null,"eligibility": NonNullable<Json>,"expires_at": string,"id": string,"product_id": string,"program_id": string,"purpose": string | null,"requested_amount_minor": number | null,"sections": (string)[],"snapshot": NonNullable<Json>,"snapshot_sha256": string,"status": Database["public"]['Enums']["package_status"],"submitted_at": string,"submitted_by": string
                  }
                  Insert: {
                    "business_id": string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_amount_minor"?: number | null,"decision_note"?: string | null,"eligibility": NonNullable<Json>,"expires_at"?: string,"id"?: string,"product_id": string,"program_id": string,"purpose"?: string | null,"requested_amount_minor"?: number | null,"sections": (string)[],"snapshot": NonNullable<Json>,"snapshot_sha256": string,"status"?: Database["public"]['Enums']["package_status"],"submitted_at"?: string,"submitted_by"?: string
                  }
                  Update: {
                    "business_id"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_amount_minor"?: number | null,"decision_note"?: string | null,"eligibility"?: NonNullable<Json>,"expires_at"?: string,"id"?: string,"product_id"?: string,"program_id"?: string,"purpose"?: string | null,"requested_amount_minor"?: number | null,"sections"?: (string)[],"snapshot"?: NonNullable<Json>,"snapshot_sha256"?: string,"status"?: Database["public"]['Enums']["package_status"],"submitted_at"?: string,"submitted_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidence_packages_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidence_packages_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidence_packages_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "financial_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidence_packages_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidence_packages_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"financial_products": {
                  Row: {
                    "created_at": string,"currency": string,"description": string | null,"eligibility": NonNullable<Json>,"id": string,"max_amount_minor": number | null,"min_amount_minor": number | null,"name": string,"product_type": string,"program_id": string,"required_sections": (string)[],"status": string
                  }
                  Insert: {
                    "created_at"?: string,"currency": string,"description"?: string | null,"eligibility"?: NonNullable<Json>,"id"?: string,"max_amount_minor"?: number | null,"min_amount_minor"?: number | null,"name": string,"product_type": string,"program_id": string,"required_sections"?: (string)[],"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"description"?: string | null,"eligibility"?: NonNullable<Json>,"id"?: string,"max_amount_minor"?: number | null,"min_amount_minor"?: number | null,"name"?: string,"product_type"?: string,"program_id"?: string,"required_sections"?: (string)[],"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_products_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"fx_rates": {
                  Row: {
                    "as_of": string,"currency": string,"minor_units": number,"source": string,"usd_per_unit": number
                  }
                  Insert: {
                    "as_of"?: string,"currency": string,"minor_units"?: number,"source"?: string,"usd_per_unit": number
                  }
                  Update: {
                    "as_of"?: string,"currency"?: string,"minor_units"?: number,"source"?: string,"usd_per_unit"?: number
                  }
                  Relationships: [
                    
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
                },"interventions": {
                  Row: {
                    "abandon_reason": string | null,"baseline_value": number,"business_id": string,"completed_at": string | null,"created_by": string,"created_by_role": Database["public"]['Enums']["business_role"],"due_at": string,"expected_direction": string,"id": string,"solution_version_id": string | null,"source_action_id": string | null,"started_at": string,"status": Database["public"]['Enums']["intervention_status"],"target_metric": string,"title": string,"updated_at": string,"window_days": number
                  }
                  Insert: {
                    "abandon_reason"?: string | null,"baseline_value": number,"business_id": string,"completed_at"?: string | null,"created_by"?: string,"created_by_role": Database["public"]['Enums']["business_role"],"due_at": string,"expected_direction": string,"id"?: string,"solution_version_id"?: string | null,"source_action_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["intervention_status"],"target_metric": string,"title": string,"updated_at"?: string,"window_days"?: number
                  }
                  Update: {
                    "abandon_reason"?: string | null,"baseline_value"?: number,"business_id"?: string,"completed_at"?: string | null,"created_by"?: string,"created_by_role"?: Database["public"]['Enums']["business_role"],"due_at"?: string,"expected_direction"?: string,"id"?: string,"solution_version_id"?: string | null,"source_action_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["intervention_status"],"target_metric"?: string,"title"?: string,"updated_at"?: string,"window_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "interventions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interventions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interventions_solution_version_fk"
      columns: ["solution_version_id"]
isOneToOne: false
      referencedRelation: "solution_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interventions_source_action_id_fkey"
      columns: ["source_action_id"]
isOneToOne: false
      referencedRelation: "agent_actions"
      referencedColumns: ["id"]
    }
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
                },"markets": {
                  Row: {
                    "address_format": NonNullable<Json>,"connectors": NonNullable<Json>,"country_code": string,"currency": string,"data_residency": string,"default_locale": string,"default_timezone": string,"identifier_types": NonNullable<Json>,"jurisdiction": NonNullable<Json>,"languages": (string)[],"name": string,"phone_prefix": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "address_format"?: NonNullable<Json>,"connectors"?: NonNullable<Json>,"country_code": string,"currency": string,"data_residency"?: string,"default_locale"?: string,"default_timezone": string,"identifier_types"?: NonNullable<Json>,"jurisdiction"?: NonNullable<Json>,"languages"?: (string)[],"name": string,"phone_prefix": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address_format"?: NonNullable<Json>,"connectors"?: NonNullable<Json>,"country_code"?: string,"currency"?: string,"data_residency"?: string,"default_locale"?: string,"default_timezone"?: string,"identifier_types"?: NonNullable<Json>,"jurisdiction"?: NonNullable<Json>,"languages"?: (string)[],"name"?: string,"phone_prefix"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
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
                },"metrics_daily": {
                  Row: {
                    "day": string,"key": string,"value": number | null
                  }
                  Insert: {
                    "day": string,"key": string,"value"?: number | null
                  }
                  Update: {
                    "day"?: string,"key"?: string,"value"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"operator_item_log": {
                  Row: {
                    "business_id": string,"first_seen": string,"item_key": string,"kind": string,"resolved_at": string | null,"user_id": string
                  }
                  Insert: {
                    "business_id": string,"first_seen"?: string,"item_key": string,"kind": string,"resolved_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "business_id"?: string,"first_seen"?: string,"item_key"?: string,"kind"?: string,"resolved_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operator_item_log_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "operator_item_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"operator_snoozes": {
                  Row: {
                    "item_key": string,"until": string,"user_id": string
                  }
                  Insert: {
                    "item_key": string,"until": string,"user_id"?: string
                  }
                  Update: {
                    "item_key"?: string,"until"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operator_snoozes_user_id_fkey"
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
                },"outcomes": {
                  Row: {
                    "baseline_value": number,"business_id": string,"delta": number,"evidence": NonNullable<Json>,"id": string,"improved": boolean,"intervention_id": string,"measured_at": string,"metric": string,"observed_value": number,"status": Database["public"]['Enums']["outcome_status"],"verification_note": string | null,"verified_at": string | null,"verified_by": string | null,"verifier_role": Database["public"]['Enums']["business_role"] | null,"window_end": string,"window_start": string
                  }
                  Insert: {
                    "baseline_value": number,"business_id": string,"delta": number,"evidence"?: NonNullable<Json>,"id"?: string,"improved": boolean,"intervention_id": string,"measured_at"?: string,"metric": string,"observed_value": number,"status"?: Database["public"]['Enums']["outcome_status"],"verification_note"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null,"verifier_role"?: Database["public"]['Enums']["business_role"] | null,"window_end": string,"window_start": string
                  }
                  Update: {
                    "baseline_value"?: number,"business_id"?: string,"delta"?: number,"evidence"?: NonNullable<Json>,"id"?: string,"improved"?: boolean,"intervention_id"?: string,"measured_at"?: string,"metric"?: string,"observed_value"?: number,"status"?: Database["public"]['Enums']["outcome_status"],"verification_note"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null,"verifier_role"?: Database["public"]['Enums']["business_role"] | null,"window_end"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outcomes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outcomes_intervention_id_fkey"
      columns: ["intervention_id"]
isOneToOne: true
      referencedRelation: "interventions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outcomes_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
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
                },"program_invitations": {
                  Row: {
                    "accepted_at": string | null,"business_id": string | null,"contact": string,"id": string,"invited_at": string,"invited_by": string,"program_id": string,"source_partner_user_id": string | null,"status": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"business_id"?: string | null,"contact": string,"id"?: string,"invited_at"?: string,"invited_by"?: string,"program_id": string,"source_partner_user_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"business_id"?: string | null,"contact"?: string,"id"?: string,"invited_at"?: string,"invited_by"?: string,"program_id"?: string,"source_partner_user_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_invitations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_invitations_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_invitations_source_partner_user_id_fkey"
      columns: ["source_partner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
                    "countries": (string)[],"created_at": string,"created_by": string,"current_period_end": string | null,"description": string | null,"ends_on": string | null,"goals": string | null,"id": string,"join_code": string,"kind": string,"name": string,"phase": string,"pilot_seats": number,"seats": number,"sectors": (string)[],"sponsor_name": string | null,"sponsored_plan_id": string | null,"starts_on": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"subscription_status": string | null,"target_businesses": number | null,"updated_at": string
                  }
                  Insert: {
                    "countries"?: (string)[],"created_at"?: string,"created_by"?: string,"current_period_end"?: string | null,"description"?: string | null,"ends_on"?: string | null,"goals"?: string | null,"id"?: string,"join_code"?: string,"kind"?: string,"name": string,"phase"?: string,"pilot_seats"?: number,"seats"?: number,"sectors"?: (string)[],"sponsor_name"?: string | null,"sponsored_plan_id"?: string | null,"starts_on"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"target_businesses"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "countries"?: (string)[],"created_at"?: string,"created_by"?: string,"current_period_end"?: string | null,"description"?: string | null,"ends_on"?: string | null,"goals"?: string | null,"id"?: string,"join_code"?: string,"kind"?: string,"name"?: string,"phase"?: string,"pilot_seats"?: number,"seats"?: number,"sectors"?: (string)[],"sponsor_name"?: string | null,"sponsored_plan_id"?: string | null,"starts_on"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"target_businesses"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_sponsored_plan_id_fkey"
      columns: ["sponsored_plan_id"]
isOneToOne: false
      referencedRelation: "billing_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"provider_members": {
                  Row: {
                    "provider_id": string,"user_id": string
                  }
                  Insert: {
                    "provider_id": string,"user_id": string
                  }
                  Update: {
                    "provider_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "provider_members_provider_id_fkey"
      columns: ["provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provider_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"providers": {
                  Row: {
                    "contact": string,"created_at": string,"created_by": string,"description": string | null,"id": string,"kind": string,"name": string,"status": string,"take_rate_bps": number
                  }
                  Insert: {
                    "contact": string,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"kind": string,"name": string,"status"?: string,"take_rate_bps"?: number
                  }
                  Update: {
                    "contact"?: string,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"status"?: string,"take_rate_bps"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "providers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pulse_feedback": {
                  Row: {
                    "business_id": string,"computed_on": string,"created_at": string,"dimension": string,"id": string,"note": string | null,"user_id": string,"user_role": Database["public"]['Enums']["business_role"],"verdict": string
                  }
                  Insert: {
                    "business_id": string,"computed_on": string,"created_at"?: string,"dimension": string,"id"?: string,"note"?: string | null,"user_id"?: string,"user_role": Database["public"]['Enums']["business_role"],"verdict": string
                  }
                  Update: {
                    "business_id"?: string,"computed_on"?: string,"created_at"?: string,"dimension"?: string,"id"?: string,"note"?: string | null,"user_id"?: string,"user_role"?: Database["public"]['Enums']["business_role"],"verdict"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pulse_feedback_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pulse_feedback_user_id_fkey"
      columns: ["user_id"]
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
                    "agent_run_id": string | null,"ai_fields": Json | null,"business_id": string,"capture_id": string,"confidence": number,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"evidence": NonNullable<Json>,"explanation": string | null,"fields": NonNullable<Json>,"id": string,"kind": Database["public"]['Enums']["record_kind"],"record_id": string | null,"status": Database["public"]['Enums']["draft_status"]
                  }
                  Insert: {
                    "agent_run_id"?: string | null,"ai_fields"?: Json | null,"business_id": string,"capture_id": string,"confidence": number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"explanation"?: string | null,"fields": NonNullable<Json>,"id"?: string,"kind": Database["public"]['Enums']["record_kind"],"record_id"?: string | null,"status"?: Database["public"]['Enums']["draft_status"]
                  }
                  Update: {
                    "agent_run_id"?: string | null,"ai_fields"?: Json | null,"business_id"?: string,"capture_id"?: string,"confidence"?: number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"explanation"?: string | null,"fields"?: NonNullable<Json>,"id"?: string,"kind"?: Database["public"]['Enums']["record_kind"],"record_id"?: string | null,"status"?: Database["public"]['Enums']["draft_status"]
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
                },"recovery_actions": {
                  Row: {
                    "action_type": string,"business_id": string,"closed_at": string | null,"closed_by": string | null,"created_at": string,"evidence": NonNullable<Json>,"id": string,"note": string | null,"reason": string,"status": string
                  }
                  Insert: {
                    "action_type": string,"business_id": string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"evidence": NonNullable<Json>,"id"?: string,"note"?: string | null,"reason": string,"status"?: string
                  }
                  Update: {
                    "action_type"?: string,"business_id"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"note"?: string | null,"reason"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recovery_actions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recovery_actions_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"revenue_events": {
                  Row: {
                    "amount_minor": number,"billable_event_id": string | null,"business_id": string | null,"currency": string,"external_id": string | null,"id": string,"occurred_at": string,"program_id": string | null,"source": string
                  }
                  Insert: {
                    "amount_minor": number,"billable_event_id"?: string | null,"business_id"?: string | null,"currency": string,"external_id"?: string | null,"id"?: string,"occurred_at"?: string,"program_id"?: string | null,"source"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"billable_event_id"?: string | null,"business_id"?: string | null,"currency"?: string,"external_id"?: string | null,"id"?: string,"occurred_at"?: string,"program_id"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "revenue_events_billable_event_id_fkey"
      columns: ["billable_event_id"]
isOneToOne: true
      referencedRelation: "billable_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revenue_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revenue_events_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
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
                },"solution_engagements": {
                  Row: {
                    "business_id": string,"consented_at": string,"consented_by": string,"id": string,"intervention_id": string,"provider_id": string,"status": string
                  }
                  Insert: {
                    "business_id": string,"consented_at"?: string,"consented_by": string,"id"?: string,"intervention_id": string,"provider_id": string,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"consented_at"?: string,"consented_by"?: string,"id"?: string,"intervention_id"?: string,"provider_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solution_engagements_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solution_engagements_consented_by_fkey"
      columns: ["consented_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solution_engagements_intervention_id_fkey"
      columns: ["intervention_id"]
isOneToOne: true
      referencedRelation: "interventions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solution_engagements_provider_id_fkey"
      columns: ["provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    }
                  ]
                },"solution_versions": {
                  Row: {
                    "created_at": string,"deprecated_reason": string | null,"id": string,"playbook": NonNullable<Json>,"solution_id": string,"status": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"deprecated_reason"?: string | null,"id"?: string,"playbook"?: NonNullable<Json>,"solution_id": string,"status"?: string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"deprecated_reason"?: string | null,"id"?: string,"playbook"?: NonNullable<Json>,"solution_id"?: string,"status"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "solution_versions_solution_id_fkey"
      columns: ["solution_id"]
isOneToOne: false
      referencedRelation: "solutions"
      referencedColumns: ["id"]
    }
                  ]
                },"solutions": {
                  Row: {
                    "commercial_terms": string | null,"created_at": string,"currency": string | null,"default_window_days": number,"delivery": string,"id": string,"key": string,"name": string,"price_minor": number | null,"pricing_model": string,"provider_id": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["solution_status"],"summary": string,"target_dimension": string | null,"target_metric": string
                  }
                  Insert: {
                    "commercial_terms"?: string | null,"created_at"?: string,"currency"?: string | null,"default_window_days"?: number,"delivery"?: string,"id"?: string,"key": string,"name": string,"price_minor"?: number | null,"pricing_model"?: string,"provider_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["solution_status"],"summary": string,"target_dimension"?: string | null,"target_metric": string
                  }
                  Update: {
                    "commercial_terms"?: string | null,"created_at"?: string,"currency"?: string | null,"default_window_days"?: number,"delivery"?: string,"id"?: string,"key"?: string,"name"?: string,"price_minor"?: number | null,"pricing_model"?: string,"provider_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["solution_status"],"summary"?: string,"target_dimension"?: string | null,"target_metric"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "solutions_provider_id_fkey"
      columns: ["provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "solutions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"usage_events": {
                  Row: {
                    "business_id": string,"correlation_id": string,"entitlement_id": string,"feature": string,"id": string,"occurred_at": string,"overage": boolean,"quantity": number
                  }
                  Insert: {
                    "business_id": string,"correlation_id": string,"entitlement_id": string,"feature": string,"id"?: string,"occurred_at"?: string,"overage"?: boolean,"quantity"?: number
                  }
                  Update: {
                    "business_id"?: string,"correlation_id"?: string,"entitlement_id"?: string,"feature"?: string,"id"?: string,"occurred_at"?: string,"overage"?: boolean,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_events_entitlement_id_fkey"
      columns: ["entitlement_id"]
isOneToOne: false
      referencedRelation: "entitlements"
      referencedColumns: ["id"]
    }
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
            "abandon_intervention":
{ Args: { "p_intervention_id": string,"p_reason": string }; Returns: undefined
                           },
"activation_status":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"add_cost_input":
{ Args: { "p_amount_usd": number,"p_category": string,"p_month": string,"p_note"?: string }; Returns: undefined
                           },
"add_member":
{ Args: { "p_business_id": string,"p_contact": string,"p_role": Database["public"]['Enums']["business_role"] }; Returns: string
                           },
"add_program_member":
{ Args: { "p_contact": string,"p_program_id": string,"p_role": Database["public"]['Enums']["program_role"] }; Returns: string
                           },
"add_verification":
{ Args: { "p_business_id": string,"p_evidence_path"?: string,"p_level": Database["public"]['Enums']["provenance"],"p_method": string,"p_note"?: string,"p_period_end"?: string,"p_period_start"?: string,"p_subject_id"?: string,"p_subject_type": Database["public"]['Enums']["verification_subject"] }; Returns: string
                           },
"am_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"assign_partner":
{ Args: { "p_business_id": string,"p_partner_user_id": string,"p_program_id": string }; Returns: undefined
                           },
"batch_nudge":
{ Args: { "p_business_ids": (string)[],"p_message": string }; Returns: number
                           },
"bulk_invite":
{ Args: { "p_contacts": (string)[],"p_program_id": string }; Returns: number
                           },
"business_benchmark":
{ Args: { "p_business_id": string }; Returns: {
              "avg_quality": number,"cohort": string,"confidence": string,"level": string,"metric": string,"n": number,"p25": number,"p50": number,"p75": number,"period_end": string,"placement": string,"value": number
            }[]
                           },
"business_summary":
{ Args: { "p_business_id": string,"p_from": string,"p_to": string }; Returns: {
              "collected_minor": number,"customers_served": number,"expenses_minor": number,"net_minor": number,"receivable_minor": number,"sales_count": number,"sales_minor": number
            }[]
                           },
"choose_plan":
{ Args: { "p_business_id": string,"p_plan_key": string }; Returns: string
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
"close_recovery_action":
{ Args: { "p_id": string,"p_note"?: string,"p_status": string }; Returns: undefined
                           },
"cohort_retention":
{ Args: { "p_months"?: number }; Returns: {
              "active": number,"cohort": string,"month_offset": number,"rate": number,"size": number
            }[]
                           },
"commercial_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"commercial_trace":
{ Args: { "p_revenue_event_id": string }; Returns: Json
                           },
"complete_intervention":
{ Args: { "p_intervention_id": string }; Returns: undefined
                           },
"complete_job":
{ Args: { "p_job_id": string,"p_result"?: Json }; Returns: undefined
                           },
"compute_benchmarks":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"confirm_draft":
{ Args: { "p_draft_id": string,"p_fields"?: Json }; Returns: string
                           },
"consume_entitlement":
{ Args: { "p_business_id": string,"p_correlation_id": string,"p_feature": string }; Returns: boolean
                           },
"create_business":
{ Args: { "p_country_code"?: string,"p_currency"?: string,"p_name": string,"p_sector"?: string,"p_timezone"?: string }; Returns: string
                           },
"create_financial_product":
{ Args: { "p_currency": string,"p_description"?: string,"p_eligibility": Json,"p_max": number,"p_min": number,"p_name": string,"p_product_type": string,"p_program_id": string }; Returns: string
                           },
"create_program":
{ Args: { "p_description"?: string,"p_name": string,"p_sponsor_name"?: string }; Returns: string
                           },
"decide_action":
{ Args: { "p_action_id": string,"p_decision": string,"p_result"?: Json }; Returns: undefined
                           },
"decide_evidence_package":
{ Args: { "p_amount_minor"?: number,"p_note"?: string,"p_package_id": string,"p_status": Database["public"]['Enums']["package_status"] }; Returns: undefined
                           },
"deprecate_solution_version":
{ Args: { "p_reason": string,"p_version_id": string }; Returns: undefined
                           },
"enqueue_job":
{ Args: { "p_business_id"?: string,"p_dedupe_key"?: string,"p_max_attempts"?: number,"p_payload"?: Json,"p_run_at"?: string,"p_type": string }; Returns: string
                           },
"entitlement_status":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"extraction_eval":
{ Args: { "p_days"?: number }; Returns: {
              "confirmed": number,"confirmed_unedited": number,"drafts": number,"edit_rate": number,"edited": number,"model": string,"reject_rate": number,"rejected": number
            }[]
                           },
"fail_job":
{ Args: { "p_error": string,"p_job_id": string,"p_retryable"?: boolean }; Returns: Database["public"]['Enums']["job_status"]
                           },
"give_pulse_feedback":
{ Args: { "p_business_id": string,"p_computed_on": string,"p_dimension": string,"p_note"?: string,"p_verdict": string }; Returns: undefined
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"integrity_report":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"join_program":
{ Args: { "p_business_id": string,"p_consent": boolean,"p_join_code": string }; Returns: string
                           },
"learning_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"leave_program":
{ Args: { "p_business_id": string,"p_program_id": string }; Returns: undefined
                           },
"my_business_role":
{ Args: { "p_business_id": string }; Returns: Database["public"]['Enums']["business_role"]
                           },
"operator_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"operator_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "business_id": string,"business_name": string,"detail": string,"item_key": string,"kind": string,"link": string,"severity": number,"since": string,"title": string
            }[]
                           },
"partner_sponsor_business":
{ Args: { "p_active"?: boolean,"p_business_id": string,"p_provider_id": string }; Returns: undefined
                           },
"passport_facts":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"post_engagement_update":
{ Args: { "p_engagement_id": string,"p_note": string }; Returns: undefined
                           },
"product_eligibility":
{ Args: { "p_business_id": string,"p_product_id": string }; Returns: Json
                           },
"program_access_for_business":
{ Args: { "p_business_id": string }; Returns: {
              "admins": number,"assigned_partners": (string)[],"consented_at": string,"program_id": string,"program_name": string,"sponsor_name": string
            }[]
                           },
"program_report":
{ Args: { "p_program_id": string }; Returns: Json
                           },
"provider_engagements":
{ Args: { "p_provider_id": string }; Returns: {
              "business_name": string,"due_at": string,"engagement_id": string,"plan_status": string,"result_improved": boolean,"result_status": string,"solution": string,"started_at": string,"updates": Json
            }[]
                           },
"publish_solution_version":
{ Args: { "p_playbook": Json,"p_solution_id": string }; Returns: string
                           },
"pulse_calibration":
{ Args: { "p_days"?: number }; Returns: {
              "accuracy": number,"accurate": number,"dimension": string,"feedback": number
            }[]
                           },
"pulse_metrics":
{ Args: { "p_as_of"?: string,"p_business_id": string }; Returns: Json
                           },
"purge_expired_ops":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"rate_billing":
{ Args: { "p_period"?: string }; Returns: number
                           },
"reap_stale_jobs":
{ Args: { "p_timeout"?: string }; Returns: number
                           },
"recommendation_eval":
{ Args: { "p_days"?: number }; Returns: {
              "acceptance_rate": number,"accepted": number,"completion_rate": number,"generator": string,"ignored": number,"improved_rate": number,"median_decision_hours": number,"pending": number,"rejected": number,"shown": number,"verified_rate": number
            }[]
                           },
"record_entry":
{ Args: { "p_business_id": string,"p_fields": Json,"p_kind": Database["public"]['Enums']["record_kind"] }; Returns: string
                           },
"register_provider":
{ Args: { "p_contact": string,"p_description"?: string,"p_kind": string,"p_name": string }; Returns: string
                           },
"reject_draft":
{ Args: { "p_draft_id": string }; Returns: undefined
                           },
"retention_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"review_provider":
{ Args: { "p_provider_id": string,"p_status": string }; Returns: undefined
                           },
"review_solution":
{ Args: { "p_decision": string,"p_note"?: string,"p_solution_id": string }; Returns: undefined
                           },
"rollup_metrics":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"scale_metrics":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"scan_retention":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"security_report":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"set_business_identifier":
{ Args: { "p_business_id": string,"p_type": string,"p_value": string }; Returns: undefined
                           },
"settle_billable_event":
{ Args: { "p_id": string,"p_method": string,"p_reference": string }; Returns: string
                           },
"snooze_items":
{ Args: { "p_days": number,"p_item_keys": (string)[] }; Returns: undefined
                           },
"solution_effectiveness":
{ Args: { "p_solution_id"?: string }; Returns: {
              "abandoned": number,"activated": number,"completed": number,"completion_rate": number,"failure_reasons": Json,"improved": number,"improvement_rate": number,"median_change_pct": number,"sample_ok": boolean,"solution_id": string,"solution_key": string,"solution_name": string,"verified": number,"verified_rate": number,"version": number,"version_id": string,"version_status": string
            }[]
                           },
"solution_rank_stats":
{ Args: Record<PropertyKey, never>; Returns: {
              "completed": number,"solution_version_id": string,"target_dimension": string,"verified_improved": number
            }[]
                           },
"sponsor_plan":
{ Args: { "p_plan_key": string,"p_program_id": string }; Returns: number
                           },
"start_intervention":
{ Args: { "p_business_id": string,"p_metric": string,"p_solution_version_id"?: string,"p_source_action_id"?: string,"p_title": string,"p_window_days"?: number }; Returns: string
                           },
"start_provider_solution":
{ Args: { "p_business_id": string,"p_consent": boolean,"p_solution_version_id": string }; Returns: string
                           },
"submit_evidence_package":
{ Args: { "p_amount_minor": number,"p_business_id": string,"p_consent": boolean,"p_product_id": string,"p_purpose": string,"p_sections": (string)[] }; Returns: string
                           },
"submit_solution":
{ Args: { "p_commercial_terms"?: string,"p_currency": string,"p_delivery": string,"p_key": string,"p_name": string,"p_playbook": Json,"p_price_minor": number,"p_pricing_model": string,"p_provider_id": string,"p_summary": string,"p_target_dimension": string,"p_target_metric": string,"p_window_days": number }; Returns: string
                           },
"take_eval_snapshot":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"upsert_market":
{ Args: { "p_market": Json }; Returns: undefined
                           },
"verify_outcome":
{ Args: { "p_note"?: string,"p_outcome_id": string,"p_verdict": string }; Returns: undefined
                           },
"void_billable_event":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"void_record":
{ Args: { "p_id": string,"p_kind": Database["public"]['Enums']["record_kind"],"p_reason"?: string }; Returns: undefined
                           },
"withdraw_evidence_package":
{ Args: { "p_package_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "action_status": "proposed"|"approved"|"rejected"|"executed"|"failed"|"expired","actor_type": "user"|"agent"|"system","business_role": "owner"|"staff"|"partner"|"program_admin","capture_channel": "text"|"voice"|"photo"|"forward","capture_status": "received"|"processing"|"drafted"|"resolved"|"failed","draft_status": "proposed"|"confirmed"|"rejected","intervention_status": "active"|"completed"|"abandoned","job_status": "queued"|"running"|"succeeded"|"failed"|"dead","outcome_status": "observed"|"verified"|"disputed","package_status": "submitted"|"under_review"|"approved"|"declined"|"withdrawn","payment_method": "cash"|"transfer"|"mobile_money"|"card"|"credit"|"other","program_role": "admin"|"partner","provenance": "self_reported"|"document_backed"|"third_party_verified"|"institution_verified","pulse_state": "strong"|"steady"|"watch"|"at_risk"|"insufficient_data","pulse_trend": "up"|"flat"|"down"|"unknown","record_kind": "sale"|"expense"|"stock_movement"|"customer","solution_status": "draft"|"submitted"|"approved"|"active"|"rejected"|"deprecated","stock_reason": "purchase"|"sale"|"adjustment"|"waste"|"return","verification_subject": "business"|"sale"|"expense"|"stock_movement"
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
            "action_status": ["proposed", "approved", "rejected", "executed", "failed", "expired"],"actor_type": ["user", "agent", "system"],"business_role": ["owner", "staff", "partner", "program_admin"],"capture_channel": ["text", "voice", "photo", "forward"],"capture_status": ["received", "processing", "drafted", "resolved", "failed"],"draft_status": ["proposed", "confirmed", "rejected"],"intervention_status": ["active", "completed", "abandoned"],"job_status": ["queued", "running", "succeeded", "failed", "dead"],"outcome_status": ["observed", "verified", "disputed"],"package_status": ["submitted", "under_review", "approved", "declined", "withdrawn"],"payment_method": ["cash", "transfer", "mobile_money", "card", "credit", "other"],"program_role": ["admin", "partner"],"provenance": ["self_reported", "document_backed", "third_party_verified", "institution_verified"],"pulse_state": ["strong", "steady", "watch", "at_risk", "insufficient_data"],"pulse_trend": ["up", "flat", "down", "unknown"],"record_kind": ["sale", "expense", "stock_movement", "customer"],"solution_status": ["draft", "submitted", "approved", "active", "rejected", "deprecated"],"stock_reason": ["purchase", "sale", "adjustment", "waste", "return"],"verification_subject": ["business", "sale", "expense", "stock_movement"]
          }
        }
} as const

