
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
                },"attestation_disputes": {
                  Row: {
                    "attestation_id": string,"business_id": string,"created_at": string,"id": string,"raised_by": string,"reason": string,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string
                  }
                  Insert: {
                    "attestation_id": string,"business_id": string,"created_at"?: string,"id"?: string,"raised_by"?: string,"reason": string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "attestation_id"?: string,"business_id"?: string,"created_at"?: string,"id"?: string,"raised_by"?: string,"reason"?: string,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attestation_disputes_attestation_id_fkey"
      columns: ["attestation_id"]
isOneToOne: false
      referencedRelation: "attestations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestation_disputes_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestation_disputes_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestation_disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attestations": {
                  Row: {
                    "attested_at": string,"attested_by": string,"business_id": string,"claim": NonNullable<Json>,"claim_type": string,"id": string,"method": string,"note": string | null,"request_id": string,"result": string,"status": string,"supersedes": string | null,"valid_until": string,"verifier_id": string
                  }
                  Insert: {
                    "attested_at"?: string,"attested_by"?: string,"business_id": string,"claim": NonNullable<Json>,"claim_type": string,"id"?: string,"method": string,"note"?: string | null,"request_id": string,"result": string,"status"?: string,"supersedes"?: string | null,"valid_until"?: string,"verifier_id": string
                  }
                  Update: {
                    "attested_at"?: string,"attested_by"?: string,"business_id"?: string,"claim"?: NonNullable<Json>,"claim_type"?: string,"id"?: string,"method"?: string,"note"?: string | null,"request_id"?: string,"result"?: string,"status"?: string,"supersedes"?: string | null,"valid_until"?: string,"verifier_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attestations_attested_by_fkey"
      columns: ["attested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "verification_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestations_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "attestations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attestations_verifier_id_fkey"
      columns: ["verifier_id"]
isOneToOne: false
      referencedRelation: "verifiers"
      referencedColumns: ["id"]
    }
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
                },"billing_plan_prices": {
                  Row: {
                    "currency": string,"overage_minor": NonNullable<Json>,"plan_id": string,"price_minor": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "currency": string,"overage_minor"?: NonNullable<Json>,"plan_id": string,"price_minor": number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "currency"?: string,"overage_minor"?: NonNullable<Json>,"plan_id"?: string,"price_minor"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_plan_prices_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "billing_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billing_plan_prices_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"business_memory": {
                  Row: {
                    "business_id": string,"detail": NonNullable<Json>,"id": string,"kind": string,"layer": string,"occurred_at": string,"refreshed_at": string,"source_id": string,"source_type": string,"title": string,"topic": string | null
                  }
                  Insert: {
                    "business_id": string,"detail"?: NonNullable<Json>,"id"?: string,"kind": string,"layer": string,"occurred_at": string,"refreshed_at"?: string,"source_id": string,"source_type": string,"title": string,"topic"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"detail"?: NonNullable<Json>,"id"?: string,"kind"?: string,"layer"?: string,"occurred_at"?: string,"refreshed_at"?: string,"source_id"?: string,"source_type"?: string,"title"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_memory_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"business_packs": {
                  Row: {
                    "activated_at": string,"activated_by": string | null,"business_id": string,"pack_key": string
                  }
                  Insert: {
                    "activated_at"?: string,"activated_by"?: string | null,"business_id": string,"pack_key": string
                  }
                  Update: {
                    "activated_at"?: string,"activated_by"?: string | null,"business_id"?: string,"pack_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_packs_activated_by_fkey"
      columns: ["activated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_packs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_packs_pack_key_fkey"
      columns: ["pack_key"]
isOneToOne: false
      referencedRelation: "vertical_packs"
      referencedColumns: ["key"]
    }
                  ]
                },"businesses": {
                  Row: {
                    "address": NonNullable<Json>,"archived_at": string | null,"country_code": string,"created_at": string,"created_by": string,"currency": string,"data_class": string,"data_sharing": string,"id": string,"locale": string | null,"name": string,"sector": string | null,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "address"?: NonNullable<Json>,"archived_at"?: string | null,"country_code"?: string,"created_at"?: string,"created_by": string,"currency"?: string,"data_class"?: string,"data_sharing"?: string,"id"?: string,"locale"?: string | null,"name": string,"sector"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: NonNullable<Json>,"archived_at"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string,"currency"?: string,"data_class"?: string,"data_sharing"?: string,"id"?: string,"locale"?: string | null,"name"?: string,"sector"?: string | null,"timezone"?: string,"updated_at"?: string
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
                },"change_requests": {
                  Row: {
                    "decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"error": string | null,"id": string,"kind": string,"payload": NonNullable<Json>,"reason": string,"requested_at": string,"requested_by": string,"status": string,"target": string
                  }
                  Insert: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"error"?: string | null,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"reason": string,"requested_at"?: string,"requested_by"?: string,"status"?: string,"target": string
                  }
                  Update: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"error"?: string | null,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"reason"?: string,"requested_at"?: string,"requested_by"?: string,"status"?: string,"target"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "change_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "change_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_costs": {
                  Row: {
                    "amount_usd": number,"channel": string,"created_at": string,"created_by": string | null,"id": string,"month": string,"note": string,"program_id": string | null
                  }
                  Insert: {
                    "amount_usd": number,"channel": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"month": string,"note": string,"program_id"?: string | null
                  }
                  Update: {
                    "amount_usd"?: number,"channel"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"month"?: string,"note"?: string,"program_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_costs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_costs_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"communication_consents": {
                  Row: {
                    "business_id": string,"channel": string,"id": string,"phone": string,"recorded_by": string | null,"source": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "business_id": string,"channel": string,"id"?: string,"phone": string,"recorded_by"?: string | null,"source": string,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "business_id"?: string,"channel"?: string,"id"?: string,"phone"?: string,"recorded_by"?: string | null,"source"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "communication_consents_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "communication_consents_recorded_by_fkey"
      columns: ["recorded_by"]
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
                },"data_quality_issues": {
                  Row: {
                    "business_id": string,"detail": string,"detected_at": string,"fingerprint": string,"id": string,"kind": string,"resolution": Json | null,"resolved_at": string | null,"resolved_by": string | null,"status": string,"subject": NonNullable<Json>
                  }
                  Insert: {
                    "business_id": string,"detail": string,"detected_at"?: string,"fingerprint": string,"id"?: string,"kind": string,"resolution"?: Json | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"subject": NonNullable<Json>
                  }
                  Update: {
                    "business_id"?: string,"detail"?: string,"detected_at"?: string,"fingerprint"?: string,"id"?: string,"kind"?: string,"resolution"?: Json | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"subject"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_quality_issues_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_quality_issues_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dataset_access_log": {
                  Row: {
                    "actor": string | null,"allowed": boolean,"at": string,"dataset_key": string,"id": number,"purpose": string
                  }
                  Insert: {
                    "actor"?: string | null,"allowed": boolean,"at"?: string,"dataset_key": string,"id"?: never,"purpose": string
                  }
                  Update: {
                    "actor"?: string | null,"allowed"?: boolean,"at"?: string,"dataset_key"?: string,"id"?: never,"purpose"?: string
                  }
                  Relationships: [
                    
                  ]
                },"dataset_builds": {
                  Row: {
                    "built_at": string,"businesses_used": number,"data": NonNullable<Json>,"dataset_key": string,"digest": string,"excluded_opt_out": number,"id": string,"rows": number,"suppressed": number,"version": number
                  }
                  Insert: {
                    "built_at"?: string,"businesses_used": number,"data": NonNullable<Json>,"dataset_key": string,"digest": string,"excluded_opt_out": number,"id"?: string,"rows": number,"suppressed": number,"version": number
                  }
                  Update: {
                    "built_at"?: string,"businesses_used"?: number,"data"?: NonNullable<Json>,"dataset_key"?: string,"digest"?: string,"excluded_opt_out"?: number,"id"?: string,"rows"?: number,"suppressed"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "dataset_builds_dataset_key_fkey"
      columns: ["dataset_key"]
isOneToOne: false
      referencedRelation: "datasets"
      referencedColumns: ["key"]
    }
                  ]
                },"datasets": {
                  Row: {
                    "allowed_uses": (string)[],"consent_rule": string,"features": NonNullable<Json>,"key": string,"min_group_size": number,"purpose": string,"sources": NonNullable<Json>,"transformation": string,"version": number
                  }
                  Insert: {
                    "allowed_uses": (string)[],"consent_rule"?: string,"features": NonNullable<Json>,"key": string,"min_group_size"?: number,"purpose": string,"sources": NonNullable<Json>,"transformation": string,"version"?: number
                  }
                  Update: {
                    "allowed_uses"?: (string)[],"consent_rule"?: string,"features"?: NonNullable<Json>,"key"?: string,"min_group_size"?: number,"purpose"?: string,"sources"?: NonNullable<Json>,"transformation"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"decisions": {
                  Row: {
                    "agent_action_id": string | null,"authority": NonNullable<Json>,"business_id": string,"chosen": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decided_by_user": string | null,"evidence": NonNullable<Json>,"id": string,"inputs_digest": string,"intervention_id": string | null,"method_version": string,"options": NonNullable<Json>,"recommended": string | null,"result": Json | null,"signal": NonNullable<Json>,"status": string,"topic": string
                  }
                  Insert: {
                    "agent_action_id"?: string | null,"authority": NonNullable<Json>,"business_id": string,"chosen"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decided_by_user"?: string | null,"evidence": NonNullable<Json>,"id"?: string,"inputs_digest": string,"intervention_id"?: string | null,"method_version"?: string,"options": NonNullable<Json>,"recommended"?: string | null,"result"?: Json | null,"signal": NonNullable<Json>,"status"?: string,"topic": string
                  }
                  Update: {
                    "agent_action_id"?: string | null,"authority"?: NonNullable<Json>,"business_id"?: string,"chosen"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decided_by_user"?: string | null,"evidence"?: NonNullable<Json>,"id"?: string,"inputs_digest"?: string,"intervention_id"?: string | null,"method_version"?: string,"options"?: NonNullable<Json>,"recommended"?: string | null,"result"?: Json | null,"signal"?: NonNullable<Json>,"status"?: string,"topic"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "decisions_agent_action_id_fkey"
      columns: ["agent_action_id"]
isOneToOne: false
      referencedRelation: "agent_actions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_decided_by_user_fkey"
      columns: ["decided_by_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "decisions_intervention_id_fkey"
      columns: ["intervention_id"]
isOneToOne: false
      referencedRelation: "interventions"
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
                },"escalations": {
                  Row: {
                    "business_id": string,"created_at": string,"dedupe_key": string,"evidence": NonNullable<Json>,"id": string,"kind": string,"program_id": string | null,"reason": string,"resolved_at": string | null,"resolved_by": string | null,"source_action_id": string | null,"status": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"dedupe_key": string,"evidence"?: NonNullable<Json>,"id"?: string,"kind": string,"program_id"?: string | null,"reason": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"source_action_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"dedupe_key"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"kind"?: string,"program_id"?: string | null,"reason"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"source_action_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "escalations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "escalations_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "escalations_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "escalations_source_action_id_fkey"
      columns: ["source_action_id"]
isOneToOne: false
      referencedRelation: "agent_actions"
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
                },"evidence_register": {
                  Row: {
                    "batch": string,"business_id": string | null,"claim": string,"confidence": string,"consent_scope": string,"created_at": string,"date": string,"evidence_id": string,"origin": string,"outcome": string | null,"recorded_by": string | null,"rejected_reason": string | null,"source": string,"verification_state": string
                  }
                  Insert: {
                    "batch": string,"business_id"?: string | null,"claim": string,"confidence": string,"consent_scope": string,"created_at"?: string,"date": string,"evidence_id": string,"origin"?: string,"outcome"?: string | null,"recorded_by"?: string | null,"rejected_reason"?: string | null,"source": string,"verification_state": string
                  }
                  Update: {
                    "batch"?: string,"business_id"?: string | null,"claim"?: string,"confidence"?: string,"consent_scope"?: string,"created_at"?: string,"date"?: string,"evidence_id"?: string,"origin"?: string,"outcome"?: string | null,"recorded_by"?: string | null,"rejected_reason"?: string | null,"source"?: string,"verification_state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidence_register_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidence_register_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_minor": number,"business_id": string,"category": string,"created_at": string,"created_by": string | null,"currency": string,"description": string | null,"id": string,"occurred_at": string,"payment_method": Database["public"]['Enums']["payment_method"],"provenance": Database["public"]['Enums']["provenance"],"source_capture_id": string | null,"source_draft_id": string | null,"supersedes": string | null,"supplier": string | null,"updated_at": string,"voided_at": string | null
                  }
                  Insert: {
                    "amount_minor": number,"business_id": string,"category": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"description"?: string | null,"id"?: string,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"supersedes"?: string | null,"supplier"?: string | null,"updated_at"?: string,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_minor"?: number,"business_id"?: string,"category"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"supersedes"?: string | null,"supplier"?: string | null,"updated_at"?: string,"voided_at"?: string | null
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
    },{
      foreignKeyName: "expenses_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    }
                  ]
                },"experiment_assignments": {
                  Row: {
                    "arm": string,"assigned_at": string,"business_id": string,"experiment_id": string
                  }
                  Insert: {
                    "arm": string,"assigned_at"?: string,"business_id": string,"experiment_id": string
                  }
                  Update: {
                    "arm"?: string,"assigned_at"?: string,"business_id"?: string,"experiment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "experiment_assignments_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "experiment_assignments_experiment_id_fkey"
      columns: ["experiment_id"]
isOneToOne: false
      referencedRelation: "experiments"
      referencedColumns: ["id"]
    }
                  ]
                },"experiment_snapshots": {
                  Row: {
                    "decision": string,"experiment_id": string,"id": number,"results": NonNullable<Json>,"taken_at": string
                  }
                  Insert: {
                    "decision": string,"experiment_id": string,"id"?: never,"results": NonNullable<Json>,"taken_at"?: string
                  }
                  Update: {
                    "decision"?: string,"experiment_id"?: string,"id"?: never,"results"?: NonNullable<Json>,"taken_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "experiment_snapshots_experiment_id_fkey"
      columns: ["experiment_id"]
isOneToOne: false
      referencedRelation: "experiments"
      referencedColumns: ["id"]
    }
                  ]
                },"experiments": {
                  Row: {
                    "arms": NonNullable<Json>,"conclusion": string | null,"created_at": string,"created_by": string | null,"eligibility": Json | null,"ended_at": string | null,"guardrails": NonNullable<Json>,"hypothesis": string,"id": string,"key": string,"max_duration_days": number,"min_per_arm": number,"name": string,"primary_metric": string,"solution_id": string | null,"started_at": string | null,"status": string,"surface": string
                  }
                  Insert: {
                    "arms": NonNullable<Json>,"conclusion"?: string | null,"created_at"?: string,"created_by"?: string | null,"eligibility"?: Json | null,"ended_at"?: string | null,"guardrails"?: NonNullable<Json>,"hypothesis": string,"id"?: string,"key": string,"max_duration_days"?: number,"min_per_arm"?: number,"name": string,"primary_metric"?: string,"solution_id"?: string | null,"started_at"?: string | null,"status"?: string,"surface": string
                  }
                  Update: {
                    "arms"?: NonNullable<Json>,"conclusion"?: string | null,"created_at"?: string,"created_by"?: string | null,"eligibility"?: Json | null,"ended_at"?: string | null,"guardrails"?: NonNullable<Json>,"hypothesis"?: string,"id"?: string,"key"?: string,"max_duration_days"?: number,"min_per_arm"?: number,"name"?: string,"primary_metric"?: string,"solution_id"?: string | null,"started_at"?: string | null,"status"?: string,"surface"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "experiments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "experiments_solution_id_fkey"
      columns: ["solution_id"]
isOneToOne: false
      referencedRelation: "solutions"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_uses": {
                  Row: {
                    "consumer": string,"feature_key": string,"use": string
                  }
                  Insert: {
                    "consumer": string,"feature_key": string,"use": string
                  }
                  Update: {
                    "consumer"?: string,"feature_key"?: string,"use"?: string
                  }
                  Relationships: [
                    
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
                },"forecast_evaluations": {
                  Row: {
                    "abs_pct_error": number | null,"actual": number | null,"business_id": string,"evaluated_at": string,"forecast_id": string,"high": number | null,"horizon_end": string,"in_interval": boolean | null,"kind": string,"low": number | null,"point": number | null
                  }
                  Insert: {
                    "abs_pct_error"?: number | null,"actual"?: number | null,"business_id": string,"evaluated_at"?: string,"forecast_id": string,"high"?: number | null,"horizon_end": string,"in_interval"?: boolean | null,"kind": string,"low"?: number | null,"point"?: number | null
                  }
                  Update: {
                    "abs_pct_error"?: number | null,"actual"?: number | null,"business_id"?: string,"evaluated_at"?: string,"forecast_id"?: string,"high"?: number | null,"horizon_end"?: string,"in_interval"?: boolean | null,"kind"?: string,"low"?: number | null,"point"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "forecast_evaluations_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "forecast_evaluations_forecast_id_fkey"
      columns: ["forecast_id"]
isOneToOne: true
      referencedRelation: "forecasts"
      referencedColumns: ["id"]
    }
                  ]
                },"forecasts": {
                  Row: {
                    "as_of": string,"assumptions": NonNullable<Json>,"basis": string,"business_id": string,"confidence": string,"horizon_days": number,"id": string,"input_digest": string,"inputs": NonNullable<Json>,"kind": string,"method": string,"method_version": string,"request": string | null,"result": Json | null,"subject_id": string | null
                  }
                  Insert: {
                    "as_of"?: string,"assumptions": NonNullable<Json>,"basis": string,"business_id": string,"confidence": string,"horizon_days": number,"id"?: string,"input_digest": string,"inputs": NonNullable<Json>,"kind": string,"method": string,"method_version"?: string,"request"?: string | null,"result"?: Json | null,"subject_id"?: string | null
                  }
                  Update: {
                    "as_of"?: string,"assumptions"?: NonNullable<Json>,"basis"?: string,"business_id"?: string,"confidence"?: string,"horizon_days"?: number,"id"?: string,"input_digest"?: string,"inputs"?: NonNullable<Json>,"kind"?: string,"method"?: string,"method_version"?: string,"request"?: string | null,"result"?: Json | null,"subject_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "forecasts_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    }
                  ]
                },"fx_rate_history": {
                  Row: {
                    "currency": string,"effective_date": string,"fetched_at": string,"id": number,"is_placeholder": boolean,"source": string,"usd_per_unit": number
                  }
                  Insert: {
                    "currency": string,"effective_date": string,"fetched_at"?: string,"id"?: never,"is_placeholder"?: boolean,"source": string,"usd_per_unit": number
                  }
                  Update: {
                    "currency"?: string,"effective_date"?: string,"fetched_at"?: string,"id"?: never,"is_placeholder"?: boolean,"source"?: string,"usd_per_unit"?: number
                  }
                  Relationships: [
                    
                  ]
                },"fx_rates": {
                  Row: {
                    "as_of": string,"currency": string,"fetched_at": string | null,"is_placeholder": boolean,"minor_units": number,"source": string,"usd_per_unit": number
                  }
                  Insert: {
                    "as_of"?: string,"currency": string,"fetched_at"?: string | null,"is_placeholder"?: boolean,"minor_units"?: number,"source"?: string,"usd_per_unit": number
                  }
                  Update: {
                    "as_of"?: string,"currency"?: string,"fetched_at"?: string | null,"is_placeholder"?: boolean,"minor_units"?: number,"source"?: string,"usd_per_unit"?: number
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
                },"incidents": {
                  Row: {
                    "acknowledged_by": string | null,"detail": NonNullable<Json>,"fingerprint": string,"id": string,"last_seen_at": string,"opened_at": string,"resolved_at": string | null,"severity": string,"source": string,"status": string,"title": string
                  }
                  Insert: {
                    "acknowledged_by"?: string | null,"detail"?: NonNullable<Json>,"fingerprint": string,"id"?: string,"last_seen_at"?: string,"opened_at"?: string,"resolved_at"?: string | null,"severity": string,"source": string,"status"?: string,"title": string
                  }
                  Update: {
                    "acknowledged_by"?: string | null,"detail"?: NonNullable<Json>,"fingerprint"?: string,"id"?: string,"last_seen_at"?: string,"opened_at"?: string,"resolved_at"?: string | null,"severity"?: string,"source"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incidents_acknowledged_by_fkey"
      columns: ["acknowledged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_calls": {
                  Row: {
                    "at": string,"error": string | null,"id": number,"identity_id": string | null,"latency_ms": number | null,"method": string,"path": string,"program_id": string | null,"request_id": string | null,"status": number
                  }
                  Insert: {
                    "at"?: string,"error"?: string | null,"id"?: never,"identity_id"?: string | null,"latency_ms"?: number | null,"method": string,"path": string,"program_id"?: string | null,"request_id"?: string | null,"status": number
                  }
                  Update: {
                    "at"?: string,"error"?: string | null,"id"?: never,"identity_id"?: string | null,"latency_ms"?: number | null,"method"?: string,"path"?: string,"program_id"?: string | null,"request_id"?: string | null,"status"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_calls_identity_id_fkey"
      columns: ["identity_id"]
isOneToOne: false
      referencedRelation: "service_identities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "integration_calls_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
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
                },"message_events": {
                  Row: {
                    "business_id": string | null,"detail": NonNullable<Json>,"id": number,"kind": string,"message_id": string | null,"occurred_at": string,"provider": string,"provider_event_id": string | null,"status": string | null
                  }
                  Insert: {
                    "business_id"?: string | null,"detail"?: NonNullable<Json>,"id"?: never,"kind": string,"message_id"?: string | null,"occurred_at"?: string,"provider": string,"provider_event_id"?: string | null,"status"?: string | null
                  }
                  Update: {
                    "business_id"?: string | null,"detail"?: NonNullable<Json>,"id"?: never,"kind"?: string,"message_id"?: string | null,"occurred_at"?: string,"provider"?: string,"provider_event_id"?: string | null,"status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_events_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    }
                  ]
                },"message_templates": {
                  Row: {
                    "body": string,"channel": string,"created_at": string,"id": string,"key": string,"locale": string,"params": (string)[],"provider_template": string | null,"status": string,"version": number
                  }
                  Insert: {
                    "body": string,"channel": string,"created_at"?: string,"id"?: string,"key": string,"locale"?: string,"params"?: (string)[],"provider_template"?: string | null,"status"?: string,"version"?: number
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"created_at"?: string,"id"?: string,"key"?: string,"locale"?: string,"params"?: (string)[],"provider_template"?: string | null,"status"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "attempts": number,"body": string | null,"business_id": string,"channel": string | null,"correlation_id": string,"created_at": string,"delivered_at": string | null,"id": string,"last_error": string | null,"phone": string | null,"provider": string | null,"provider_message_id": string | null,"send_after": string,"sent_at": string | null,"source_id": string | null,"source_type": string,"status": string,"suppression_reason": string | null,"template_id": string | null,"variables": NonNullable<Json>
                  }
                  Insert: {
                    "attempts"?: number,"body"?: string | null,"business_id": string,"channel"?: string | null,"correlation_id": string,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"last_error"?: string | null,"phone"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"send_after"?: string,"sent_at"?: string | null,"source_id"?: string | null,"source_type": string,"status"?: string,"suppression_reason"?: string | null,"template_id"?: string | null,"variables"?: NonNullable<Json>
                  }
                  Update: {
                    "attempts"?: number,"body"?: string | null,"business_id"?: string,"channel"?: string | null,"correlation_id"?: string,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"last_error"?: string | null,"phone"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"send_after"?: string,"sent_at"?: string | null,"source_id"?: string | null,"source_type"?: string,"status"?: string,"suppression_reason"?: string | null,"template_id"?: string | null,"variables"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "message_templates"
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
                },"no_trading_periods": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string,"id": string,"period_end": string,"period_start": string,"reason": string
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string,"id"?: string,"period_end": string,"period_start": string,"reason": string
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"period_end"?: string,"period_start"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "no_trading_periods_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "no_trading_periods_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"org_members": {
                  Row: {
                    "org_id": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "org_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "org_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"kind": string,"name": string,"sla": NonNullable<Json>
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"kind"?: string,"name": string,"sla"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"kind"?: string,"name"?: string,"sla"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"payment_events": {
                  Row: {
                    "business_id": string | null,"created_at": string,"detail": NonNullable<Json>,"id": number,"kind": string,"payment_request_id": string | null,"provider": string,"provider_event_id": string | null,"status": string | null
                  }
                  Insert: {
                    "business_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"kind": string,"payment_request_id"?: string | null,"provider": string,"provider_event_id"?: string | null,"status"?: string | null
                  }
                  Update: {
                    "business_id"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"kind"?: string,"payment_request_id"?: string | null,"provider"?: string,"provider_event_id"?: string | null,"status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_events_payment_request_id_fkey"
      columns: ["payment_request_id"]
isOneToOne: false
      referencedRelation: "payment_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_refunds": {
                  Row: {
                    "amount_minor": number,"business_id": string,"created_at": string,"currency": string,"id": string,"payment_request_id": string,"processed_at": string | null,"provider_refund_id": string | null,"reason": string,"requested_by": string | null,"revenue_event_id": string | null,"status": string
                  }
                  Insert: {
                    "amount_minor": number,"business_id": string,"created_at"?: string,"currency": string,"id"?: string,"payment_request_id": string,"processed_at"?: string | null,"provider_refund_id"?: string | null,"reason": string,"requested_by"?: string | null,"revenue_event_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"business_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"payment_request_id"?: string,"processed_at"?: string | null,"provider_refund_id"?: string | null,"reason"?: string,"requested_by"?: string | null,"revenue_event_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_refunds_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_refunds_payment_request_id_fkey"
      columns: ["payment_request_id"]
isOneToOne: false
      referencedRelation: "payment_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_refunds_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_refunds_revenue_event_id_fkey"
      columns: ["revenue_event_id"]
isOneToOne: false
      referencedRelation: "revenue_events"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_requests": {
                  Row: {
                    "access_code": string | null,"amount_minor": number,"billable_event_id": string,"business_id": string,"checkout_url": string | null,"created_at": string,"currency": string,"failure_reason": string | null,"id": string,"last_verified_at": string | null,"paid_amount_minor": number | null,"paid_at": string | null,"paid_currency": string | null,"payment_channel": string | null,"provider": string,"provider_transaction_id": string | null,"reference": string,"refunded_minor": number,"requested_by": string | null,"revenue_event_id": string | null,"status": string
                  }
                  Insert: {
                    "access_code"?: string | null,"amount_minor": number,"billable_event_id": string,"business_id": string,"checkout_url"?: string | null,"created_at"?: string,"currency": string,"failure_reason"?: string | null,"id"?: string,"last_verified_at"?: string | null,"paid_amount_minor"?: number | null,"paid_at"?: string | null,"paid_currency"?: string | null,"payment_channel"?: string | null,"provider": string,"provider_transaction_id"?: string | null,"reference": string,"refunded_minor"?: number,"requested_by"?: string | null,"revenue_event_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "access_code"?: string | null,"amount_minor"?: number,"billable_event_id"?: string,"business_id"?: string,"checkout_url"?: string | null,"created_at"?: string,"currency"?: string,"failure_reason"?: string | null,"id"?: string,"last_verified_at"?: string | null,"paid_amount_minor"?: number | null,"paid_at"?: string | null,"paid_currency"?: string | null,"payment_channel"?: string | null,"provider"?: string,"provider_transaction_id"?: string | null,"reference"?: string,"refunded_minor"?: number,"requested_by"?: string | null,"revenue_event_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_requests_billable_event_id_fkey"
      columns: ["billable_event_id"]
isOneToOne: false
      referencedRelation: "billable_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_requests_revenue_event_id_fkey"
      columns: ["revenue_event_id"]
isOneToOne: false
      referencedRelation: "revenue_events"
      referencedColumns: ["id"]
    }
                  ]
                },"pilot_businesses": {
                  Row: {
                    "at_risk": boolean,"business_id": string,"consent_version": string | null,"eligible": boolean,"failure_reason": string | null,"history": NonNullable<Json>,"ineligible_reason": string | null,"joined_at": string,"last_activity_at": string | null,"pilot_id": string,"stage": string,"stage_changed_at": string
                  }
                  Insert: {
                    "at_risk"?: boolean,"business_id": string,"consent_version"?: string | null,"eligible"?: boolean,"failure_reason"?: string | null,"history"?: NonNullable<Json>,"ineligible_reason"?: string | null,"joined_at"?: string,"last_activity_at"?: string | null,"pilot_id": string,"stage"?: string,"stage_changed_at"?: string
                  }
                  Update: {
                    "at_risk"?: boolean,"business_id"?: string,"consent_version"?: string | null,"eligible"?: boolean,"failure_reason"?: string | null,"history"?: NonNullable<Json>,"ineligible_reason"?: string | null,"joined_at"?: string,"last_activity_at"?: string | null,"pilot_id"?: string,"stage"?: string,"stage_changed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pilot_businesses_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_businesses_pilot_id_fkey"
      columns: ["pilot_id"]
isOneToOne: false
      referencedRelation: "pilots"
      referencedColumns: ["id"]
    }
                  ]
                },"pilot_invites": {
                  Row: {
                    "accepted_at": string | null,"business_id": string | null,"id": string,"invited_at": string,"invited_by": string | null,"phone": string,"pilot_id": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"business_id"?: string | null,"id"?: string,"invited_at"?: string,"invited_by"?: string | null,"phone": string,"pilot_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"business_id"?: string | null,"id"?: string,"invited_at"?: string,"invited_by"?: string | null,"phone"?: string,"pilot_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pilot_invites_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_invites_pilot_id_fkey"
      columns: ["pilot_id"]
isOneToOne: false
      referencedRelation: "pilots"
      referencedColumns: ["id"]
    }
                  ]
                },"pilot_operators": {
                  Row: {
                    "pilot_id": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "pilot_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "pilot_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pilot_operators_pilot_id_fkey"
      columns: ["pilot_id"]
isOneToOne: false
      referencedRelation: "pilots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilot_operators_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pilots": {
                  Row: {
                    "checkpoints": NonNullable<Json>,"consent_version": string,"country_code": string | null,"created_at": string,"created_by": string,"ends_on": string,"escalation_days": number,"evidence_requirements": NonNullable<Json>,"id": string,"intervention_scope": (string)[],"name": string,"pack_key": string | null,"program_id": string,"sector": string | null,"sponsor_org_id": string | null,"stage_rules": NonNullable<Json>,"starts_on": string,"status": string,"success_metrics": NonNullable<Json>,"support_owner": string | null,"target_size": number
                  }
                  Insert: {
                    "checkpoints"?: NonNullable<Json>,"consent_version"?: string,"country_code"?: string | null,"created_at"?: string,"created_by"?: string,"ends_on": string,"escalation_days"?: number,"evidence_requirements"?: NonNullable<Json>,"id"?: string,"intervention_scope"?: (string)[],"name": string,"pack_key"?: string | null,"program_id": string,"sector"?: string | null,"sponsor_org_id"?: string | null,"stage_rules"?: NonNullable<Json>,"starts_on": string,"status"?: string,"success_metrics"?: NonNullable<Json>,"support_owner"?: string | null,"target_size": number
                  }
                  Update: {
                    "checkpoints"?: NonNullable<Json>,"consent_version"?: string,"country_code"?: string | null,"created_at"?: string,"created_by"?: string,"ends_on"?: string,"escalation_days"?: number,"evidence_requirements"?: NonNullable<Json>,"id"?: string,"intervention_scope"?: (string)[],"name"?: string,"pack_key"?: string | null,"program_id"?: string,"sector"?: string | null,"sponsor_org_id"?: string | null,"stage_rules"?: NonNullable<Json>,"starts_on"?: string,"status"?: string,"success_metrics"?: NonNullable<Json>,"support_owner"?: string | null,"target_size"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pilots_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilots_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilots_sponsor_org_id_fkey"
      columns: ["sponsor_org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pilots_support_owner_fkey"
      columns: ["support_owner"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"platform_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"playbook_run_steps": {
                  Row: {
                    "ended_at": string | null,"gate": string,"intervention_id": string | null,"run_id": string,"solution_key": string,"started_at": string | null,"status": string,"step_no": number
                  }
                  Insert: {
                    "ended_at"?: string | null,"gate": string,"intervention_id"?: string | null,"run_id": string,"solution_key": string,"started_at"?: string | null,"status"?: string,"step_no": number
                  }
                  Update: {
                    "ended_at"?: string | null,"gate"?: string,"intervention_id"?: string | null,"run_id"?: string,"solution_key"?: string,"started_at"?: string | null,"status"?: string,"step_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "playbook_run_steps_intervention_id_fkey"
      columns: ["intervention_id"]
isOneToOne: false
      referencedRelation: "interventions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_run_steps_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "playbook_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"playbook_runs": {
                  Row: {
                    "baseline": number | null,"business_id": string,"current_step": number,"decision_id": string | null,"ended_at": string | null,"id": string,"launched_by": string,"playbook_key": string,"result": Json | null,"started_at": string,"status": string,"stop_reason": string | null,"trigger": NonNullable<Json>,"version": number
                  }
                  Insert: {
                    "baseline"?: number | null,"business_id": string,"current_step"?: number,"decision_id"?: string | null,"ended_at"?: string | null,"id"?: string,"launched_by"?: string,"playbook_key": string,"result"?: Json | null,"started_at"?: string,"status"?: string,"stop_reason"?: string | null,"trigger"?: NonNullable<Json>,"version": number
                  }
                  Update: {
                    "baseline"?: number | null,"business_id"?: string,"current_step"?: number,"decision_id"?: string | null,"ended_at"?: string | null,"id"?: string,"launched_by"?: string,"playbook_key"?: string,"result"?: Json | null,"started_at"?: string,"status"?: string,"stop_reason"?: string | null,"trigger"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "playbook_runs_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_runs_decision_id_fkey"
      columns: ["decision_id"]
isOneToOne: false
      referencedRelation: "decisions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_runs_launched_by_fkey"
      columns: ["launched_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playbook_runs_playbook_key_fkey"
      columns: ["playbook_key"]
isOneToOne: false
      referencedRelation: "playbooks"
      referencedColumns: ["key"]
    }
                  ]
                },"playbooks": {
                  Row: {
                    "key": string,"metric": string,"name": string,"problem": string,"status": string,"steps": NonNullable<Json>,"version": number
                  }
                  Insert: {
                    "key": string,"metric": string,"name": string,"problem": string,"status"?: string,"steps": NonNullable<Json>,"version"?: number
                  }
                  Update: {
                    "key"?: string,"metric"?: string,"name"?: string,"problem"?: string,"status"?: string,"steps"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"policies": {
                  Row: {
                    "activated_at": string | null,"created_at": string,"created_by": string | null,"definition": NonNullable<Json>,"id": string,"key": string,"note": string | null,"scope_id": string,"scope_type": string,"status": string,"version": number
                  }
                  Insert: {
                    "activated_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"definition": NonNullable<Json>,"id"?: string,"key": string,"note"?: string | null,"scope_id"?: string,"scope_type": string,"status"?: string,"version": number
                  }
                  Update: {
                    "activated_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"definition"?: NonNullable<Json>,"id"?: string,"key"?: string,"note"?: string | null,"scope_id"?: string,"scope_type"?: string,"status"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "policies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"policy_decisions": {
                  Row: {
                    "business_id": string | null,"decided_at": string,"id": number,"input": NonNullable<Json>,"policy_id": string,"policy_key": string,"reason": string | null,"result": string,"scope": string,"version": number
                  }
                  Insert: {
                    "business_id"?: string | null,"decided_at"?: string,"id"?: never,"input": NonNullable<Json>,"policy_id": string,"policy_key": string,"reason"?: string | null,"result": string,"scope": string,"version": number
                  }
                  Update: {
                    "business_id"?: string | null,"decided_at"?: string,"id"?: never,"input"?: NonNullable<Json>,"policy_id"?: string,"policy_key"?: string,"reason"?: string | null,"result"?: string,"scope"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "policy_decisions_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "policy_decisions_policy_id_fkey"
      columns: ["policy_id"]
isOneToOne: false
      referencedRelation: "policies"
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
                    "capabilities": (string)[],"created_at": string,"program_id": string,"role": Database["public"]['Enums']["program_role"],"user_id": string
                  }
                  Insert: {
                    "capabilities"?: (string)[],"created_at"?: string,"program_id": string,"role": Database["public"]['Enums']["program_role"],"user_id": string
                  }
                  Update: {
                    "capabilities"?: (string)[],"created_at"?: string,"program_id"?: string,"role"?: Database["public"]['Enums']["program_role"],"user_id"?: string
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
                    "auto_route": boolean,"countries": (string)[],"created_at": string,"created_by": string,"current_period_end": string | null,"description": string | null,"ends_on": string | null,"goals": string | null,"id": string,"is_sandbox": boolean,"join_code": string,"kind": string,"name": string,"organization_id": string | null,"phase": string,"pilot_seats": number,"seats": number,"sectors": (string)[],"sponsor_name": string | null,"sponsored_plan_id": string | null,"starts_on": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"subscription_status": string | null,"target_businesses": number | null,"updated_at": string
                  }
                  Insert: {
                    "auto_route"?: boolean,"countries"?: (string)[],"created_at"?: string,"created_by"?: string,"current_period_end"?: string | null,"description"?: string | null,"ends_on"?: string | null,"goals"?: string | null,"id"?: string,"is_sandbox"?: boolean,"join_code"?: string,"kind"?: string,"name": string,"organization_id"?: string | null,"phase"?: string,"pilot_seats"?: number,"seats"?: number,"sectors"?: (string)[],"sponsor_name"?: string | null,"sponsored_plan_id"?: string | null,"starts_on"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"target_businesses"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "auto_route"?: boolean,"countries"?: (string)[],"created_at"?: string,"created_by"?: string,"current_period_end"?: string | null,"description"?: string | null,"ends_on"?: string | null,"goals"?: string | null,"id"?: string,"is_sandbox"?: boolean,"join_code"?: string,"kind"?: string,"name"?: string,"organization_id"?: string | null,"phase"?: string,"pilot_seats"?: number,"seats"?: number,"sectors"?: (string)[],"sponsor_name"?: string | null,"sponsored_plan_id"?: string | null,"starts_on"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"subscription_status"?: string | null,"target_businesses"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "programs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
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
                },"real_world_certifications": {
                  Row: {
                    "id": string,"overall": string,"result": NonNullable<Json>,"taken_at": string,"taken_by": string | null,"technical": string
                  }
                  Insert: {
                    "id"?: string,"overall": string,"result": NonNullable<Json>,"taken_at"?: string,"taken_by"?: string | null,"technical": string
                  }
                  Update: {
                    "id"?: string,"overall"?: string,"result"?: NonNullable<Json>,"taken_at"?: string,"taken_by"?: string | null,"technical"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "real_world_certifications_taken_by_fkey"
      columns: ["taken_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"record_corrections": {
                  Row: {
                    "action": string,"after": Json | null,"before": Json | null,"business_id": string,"corrected_at": string,"corrected_by": string,"id": string,"issue_id": string | null,"reason": string | null,"replacement_id": string | null,"subject_id": string,"subject_type": string
                  }
                  Insert: {
                    "action": string,"after"?: Json | null,"before"?: Json | null,"business_id": string,"corrected_at"?: string,"corrected_by"?: string,"id"?: string,"issue_id"?: string | null,"reason"?: string | null,"replacement_id"?: string | null,"subject_id": string,"subject_type": string
                  }
                  Update: {
                    "action"?: string,"after"?: Json | null,"before"?: Json | null,"business_id"?: string,"corrected_at"?: string,"corrected_by"?: string,"id"?: string,"issue_id"?: string | null,"reason"?: string | null,"replacement_id"?: string | null,"subject_id"?: string,"subject_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "record_corrections_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "record_corrections_corrected_by_fkey"
      columns: ["corrected_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                    "amount_minor": number,"billable_event_id": string | null,"business_id": string | null,"currency": string,"external_id": string | null,"fx_placeholder": boolean | null,"fx_rate_id": number | null,"id": string,"occurred_at": string,"program_id": string | null,"source": string,"usd_minor": number | null
                  }
                  Insert: {
                    "amount_minor": number,"billable_event_id"?: string | null,"business_id"?: string | null,"currency": string,"external_id"?: string | null,"fx_placeholder"?: boolean | null,"fx_rate_id"?: number | null,"id"?: string,"occurred_at"?: string,"program_id"?: string | null,"source"?: string,"usd_minor"?: number | null
                  }
                  Update: {
                    "amount_minor"?: number,"billable_event_id"?: string | null,"business_id"?: string | null,"currency"?: string,"external_id"?: string | null,"fx_placeholder"?: boolean | null,"fx_rate_id"?: number | null,"id"?: string,"occurred_at"?: string,"program_id"?: string | null,"source"?: string,"usd_minor"?: number | null
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
      foreignKeyName: "revenue_events_fx_rate_id_fkey"
      columns: ["fx_rate_id"]
isOneToOne: false
      referencedRelation: "fx_rate_history"
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
                    "amount_paid_minor": number,"business_id": string,"created_at": string,"created_by": string | null,"currency": string,"customer_id": string | null,"id": string,"notes": string | null,"occurred_at": string,"payment_method": Database["public"]['Enums']["payment_method"],"provenance": Database["public"]['Enums']["provenance"],"source_capture_id": string | null,"source_draft_id": string | null,"supersedes": string | null,"total_minor": number,"updated_at": string,"voided_at": string | null
                  }
                  Insert: {
                    "amount_paid_minor": number,"business_id": string,"created_at"?: string,"created_by"?: string | null,"currency": string,"customer_id"?: string | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"supersedes"?: string | null,"total_minor": number,"updated_at"?: string,"voided_at"?: string | null
                  }
                  Update: {
                    "amount_paid_minor"?: number,"business_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"customer_id"?: string | null,"id"?: string,"notes"?: string | null,"occurred_at"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"provenance"?: Database["public"]['Enums']["provenance"],"source_capture_id"?: string | null,"source_draft_id"?: string | null,"supersedes"?: string | null,"total_minor"?: number,"updated_at"?: string,"voided_at"?: string | null
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
    },{
      foreignKeyName: "sales_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"service_identities": {
                  Row: {
                    "created_at": string,"created_by": string,"environment": string,"id": string,"key_hash": string,"key_prefix": string,"last_used_at": string | null,"name": string,"program_id": string,"rate_limit_per_min": number,"revoked_at": string | null,"scopes": (string)[],"status": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"environment": string,"id"?: string,"key_hash": string,"key_prefix": string,"last_used_at"?: string | null,"name": string,"program_id": string,"rate_limit_per_min"?: number,"revoked_at"?: string | null,"scopes": (string)[],"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"environment"?: string,"id"?: string,"key_hash"?: string,"key_prefix"?: string,"last_used_at"?: string | null,"name"?: string,"program_id"?: string,"rate_limit_per_min"?: number,"revoked_at"?: string | null,"scopes"?: (string)[],"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_identities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_identities_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
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
                    "commercial_terms": string | null,"created_at": string,"currency": string | null,"default_window_days": number,"delivery": string,"id": string,"key": string,"name": string,"price_minor": number | null,"pricing_model": string,"provider_id": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["solution_status"],"summary": string,"target_dimension": string | null,"target_metric": string,"vertical_pack": string | null
                  }
                  Insert: {
                    "commercial_terms"?: string | null,"created_at"?: string,"currency"?: string | null,"default_window_days"?: number,"delivery"?: string,"id"?: string,"key": string,"name": string,"price_minor"?: number | null,"pricing_model"?: string,"provider_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["solution_status"],"summary": string,"target_dimension"?: string | null,"target_metric": string,"vertical_pack"?: string | null
                  }
                  Update: {
                    "commercial_terms"?: string | null,"created_at"?: string,"currency"?: string | null,"default_window_days"?: number,"delivery"?: string,"id"?: string,"key"?: string,"name"?: string,"price_minor"?: number | null,"pricing_model"?: string,"provider_id"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["solution_status"],"summary"?: string,"target_dimension"?: string | null,"target_metric"?: string,"vertical_pack"?: string | null
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
    },{
      foreignKeyName: "solutions_vertical_pack_fkey"
      columns: ["vertical_pack"]
isOneToOne: false
      referencedRelation: "vertical_packs"
      referencedColumns: ["key"]
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
                },"verification_requests": {
                  Row: {
                    "access_expires_at": string,"business_id": string,"claim": NonNullable<Json>,"claim_type": string,"consented_by": string,"created_at": string,"id": string,"scope": NonNullable<Json>,"status": string,"verifier_id": string
                  }
                  Insert: {
                    "access_expires_at"?: string,"business_id": string,"claim": NonNullable<Json>,"claim_type": string,"consented_by"?: string,"created_at"?: string,"id"?: string,"scope": NonNullable<Json>,"status"?: string,"verifier_id": string
                  }
                  Update: {
                    "access_expires_at"?: string,"business_id"?: string,"claim"?: NonNullable<Json>,"claim_type"?: string,"consented_by"?: string,"created_at"?: string,"id"?: string,"scope"?: NonNullable<Json>,"status"?: string,"verifier_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_requests_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_consented_by_fkey"
      columns: ["consented_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verification_requests_verifier_id_fkey"
      columns: ["verifier_id"]
isOneToOne: false
      referencedRelation: "verifiers"
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
                },"verifier_members": {
                  Row: {
                    "user_id": string,"verifier_id": string
                  }
                  Insert: {
                    "user_id": string,"verifier_id": string
                  }
                  Update: {
                    "user_id"?: string,"verifier_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifier_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifier_members_verifier_id_fkey"
      columns: ["verifier_id"]
isOneToOne: false
      referencedRelation: "verifiers"
      referencedColumns: ["id"]
    }
                  ]
                },"verifiers": {
                  Row: {
                    "accreditation": string | null,"allowed_claims": (string)[],"created_at": string,"created_by": string,"id": string,"kind": string,"name": string,"program_id": string | null,"provider_id": string | null,"status": string
                  }
                  Insert: {
                    "accreditation"?: string | null,"allowed_claims": (string)[],"created_at"?: string,"created_by"?: string,"id"?: string,"kind": string,"name": string,"program_id"?: string | null,"provider_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "accreditation"?: string | null,"allowed_claims"?: (string)[],"created_at"?: string,"created_by"?: string,"id"?: string,"kind"?: string,"name"?: string,"program_id"?: string | null,"provider_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifiers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifiers_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verifiers_provider_id_fkey"
      columns: ["provider_id"]
isOneToOne: false
      referencedRelation: "providers"
      referencedColumns: ["id"]
    }
                  ]
                },"vertical_packs": {
                  Row: {
                    "definition": NonNullable<Json>,"key": string,"name": string,"status": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "definition": NonNullable<Json>,"key": string,"name": string,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "definition"?: NonNullable<Json>,"key"?: string,"name"?: string,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"vertical_records": {
                  Row: {
                    "business_id": string,"created_at": string,"created_by": string | null,"data": NonNullable<Json>,"entity": string,"id": string,"occurred_at": string,"pack_key": string,"provenance": Database["public"]['Enums']["provenance"],"voided_at": string | null
                  }
                  Insert: {
                    "business_id": string,"created_at"?: string,"created_by"?: string | null,"data": NonNullable<Json>,"entity": string,"id"?: string,"occurred_at"?: string,"pack_key": string,"provenance"?: Database["public"]['Enums']["provenance"],"voided_at"?: string | null
                  }
                  Update: {
                    "business_id"?: string,"created_at"?: string,"created_by"?: string | null,"data"?: NonNullable<Json>,"entity"?: string,"id"?: string,"occurred_at"?: string,"pack_key"?: string,"provenance"?: Database["public"]['Enums']["provenance"],"voided_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vertical_records_business_id_fkey"
      columns: ["business_id"]
isOneToOne: false
      referencedRelation: "businesses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vertical_records_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vertical_records_pack_key_fkey"
      columns: ["pack_key"]
isOneToOne: false
      referencedRelation: "vertical_packs"
      referencedColumns: ["key"]
    }
                  ]
                },"webhook_deliveries": {
                  Row: {
                    "attempts": number,"created_at": string,"delivered_at": string | null,"event_id": number | null,"event_type": string,"id": string,"last_error": string | null,"payload": NonNullable<Json>,"response_status": number | null,"status": string,"subscription_id": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"event_id"?: number | null,"event_type": string,"id"?: string,"last_error"?: string | null,"payload": NonNullable<Json>,"response_status"?: number | null,"status"?: string,"subscription_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"event_id"?: number | null,"event_type"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"response_status"?: number | null,"status"?: string,"subscription_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_deliveries_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "webhook_subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_subscriptions": {
                  Row: {
                    "created_at": string,"event_types": (string)[],"id": string,"identity_id": string,"program_id": string,"secret": string,"status": string,"url": string
                  }
                  Insert: {
                    "created_at"?: string,"event_types": (string)[],"id"?: string,"identity_id": string,"program_id": string,"secret": string,"status"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"event_types"?: (string)[],"id"?: string,"identity_id"?: string,"program_id"?: string,"secret"?: string,"status"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_subscriptions_identity_id_fkey"
      columns: ["identity_id"]
isOneToOne: false
      referencedRelation: "service_identities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "webhook_subscriptions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
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
"acknowledge_incident":
{ Args: { "p_id": string }; Returns: undefined
                           },
"activate_pack":
{ Args: { "p_business_id": string,"p_on"?: boolean,"p_pack_key": string }; Returns: undefined
                           },
"activate_policy":
{ Args: { "p_policy_id": string }; Returns: undefined
                           },
"activation_status":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"add_channel_cost":
{ Args: { "p_amount_usd": number,"p_channel": string,"p_month": string,"p_note": string,"p_program_id"?: string }; Returns: string
                           },
"add_cost_input":
{ Args: { "p_amount_usd": number,"p_category": string,"p_month": string,"p_note"?: string }; Returns: undefined
                           },
"add_member":
{ Args: { "p_business_id": string,"p_contact": string,"p_role": Database["public"]['Enums']["business_role"] }; Returns: string
                           },
"add_org_member":
{ Args: { "p_contact": string,"p_org_id": string,"p_role": string }; Returns: string
                           },
"add_pilot_operator":
{ Args: { "p_contact": string,"p_pilot_id": string,"p_role": string }; Returns: undefined
                           },
"add_program_member":
{ Args: { "p_contact": string,"p_program_id": string,"p_role": Database["public"]['Enums']["program_role"] }; Returns: string
                           },
"add_verification":
{ Args: { "p_business_id": string,"p_evidence_path"?: string,"p_level": Database["public"]['Enums']["provenance"],"p_method": string,"p_note"?: string,"p_period_end"?: string,"p_period_start"?: string,"p_subject_id"?: string,"p_subject_type": Database["public"]['Enums']["verification_subject"] }; Returns: string
                           },
"advance_pilots":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"am_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"api_authenticate":
{ Args: { "p_key_hash": string }; Returns: Json
                           },
"api_business_outcomes":
{ Args: { "p_business_id": string,"p_identity_id": string }; Returns: Json
                           },
"api_invite":
{ Args: { "p_contacts": (string)[],"p_identity_id": string }; Returns: number
                           },
"api_list_businesses":
{ Args: { "p_identity_id": string }; Returns: Json
                           },
"api_log_call":
{ Args: { "p_error"?: string,"p_identity_id": string,"p_latency_ms": number,"p_method": string,"p_path": string,"p_request_id": string,"p_status": number }; Returns: undefined
                           },
"api_program_report":
{ Args: { "p_identity_id": string }; Returns: Json
                           },
"api_send_test_event":
{ Args: { "p_identity_id": string }; Returns: number
                           },
"apply_payment_result":
{ Args: { "p_amount_minor": number,"p_channel": string,"p_currency": string,"p_detail": Json,"p_event_id": string,"p_kind": string,"p_paid_at": string,"p_reference": string,"p_status": string,"p_transaction_id": string }; Returns: string
                           },
"apply_refund_result":
{ Args: { "p_amount_minor": number,"p_detail": Json,"p_event_id": string,"p_provider_refund_id": string,"p_status": string,"p_transaction_id": string }; Returns: string
                           },
"assign_partner":
{ Args: { "p_business_id": string,"p_partner_user_id": string,"p_program_id": string }; Returns: undefined
                           },
"attach_program":
{ Args: { "p_org_id": string,"p_program_id": string }; Returns: undefined
                           },
"attest_claim":
{ Args: { "p_method": string,"p_note"?: string,"p_request_id": string,"p_result": string }; Returns: string
                           },
"automation_overview":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"batch_nudge":
{ Args: { "p_business_ids": (string)[],"p_message": string }; Returns: number
                           },
"build_all_datasets":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"build_dataset":
{ Args: { "p_key": string }; Returns: string
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
"certify_real_world":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"channel_economics":
{ Args: { "p_months"?: number }; Returns: Json
                           },
"check_policy":
{ Args: { "p_business_id": string,"p_key": string,"p_params"?: Json }; Returns: Json
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
"compute_all_forecasts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"compute_benchmarks":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"compute_forecasts":
{ Args: { "p_business_id": string }; Returns: number
                           },
"confirm_draft":
{ Args: { "p_draft_id": string,"p_fields"?: Json }; Returns: string
                           },
"consume_entitlement":
{ Args: { "p_business_id": string,"p_correlation_id": string,"p_feature": string }; Returns: boolean
                           },
"control_plane":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"correct_attestation":
{ Args: { "p_attestation_id": string,"p_note": string,"p_result": string }; Returns: string
                           },
"correct_record":
{ Args: { "p_fields": Json,"p_id": string,"p_kind": Database["public"]['Enums']["record_kind"],"p_reason": string }; Returns: string
                           },
"create_business":
{ Args: { "p_country_code"?: string,"p_currency"?: string,"p_name": string,"p_sector"?: string,"p_timezone"?: string }; Returns: string
                           },
"create_decision":
{ Args: { "p_agent_action_id"?: string,"p_business_id": string,"p_topic": string }; Returns: string
                           },
"create_experiment":
{ Args: { "p_arms": Json,"p_eligibility"?: Json,"p_guardrails"?: Json,"p_hypothesis": string,"p_key": string,"p_max_duration_days"?: number,"p_min_per_arm"?: number,"p_name": string,"p_primary_metric"?: string,"p_solution_id": string,"p_surface": string }; Returns: string
                           },
"create_financial_product":
{ Args: { "p_currency": string,"p_description"?: string,"p_eligibility": Json,"p_max": number,"p_min": number,"p_name": string,"p_product_type": string,"p_program_id": string }; Returns: string
                           },
"create_organization":
{ Args: { "p_kind"?: string,"p_name": string }; Returns: string
                           },
"create_payment_request":
{ Args: { "p_billable_event_id": string }; Returns: Json
                           },
"create_program":
{ Args: { "p_description"?: string,"p_name": string,"p_sponsor_name"?: string }; Returns: string
                           },
"create_sandbox_program":
{ Args: { "p_program_id": string }; Returns: string
                           },
"create_service_identity":
{ Args: { "p_name": string,"p_program_id": string,"p_scopes": (string)[] }; Returns: Json
                           },
"create_webhook_subscription":
{ Args: { "p_event_types": (string)[],"p_identity_id": string,"p_url": string }; Returns: Json
                           },
"data_quality_score":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"decide_action":
{ Args: { "p_action_id": string,"p_decision": string,"p_result"?: Json }; Returns: undefined
                           },
"decide_change":
{ Args: { "p_approve": boolean,"p_id": string,"p_note"?: string }; Returns: string
                           },
"decide_evidence_package":
{ Args: { "p_amount_minor"?: number,"p_note"?: string,"p_package_id": string,"p_status": Database["public"]['Enums']["package_status"] }; Returns: undefined
                           },
"decision_quality":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"delegate_program_role":
{ Args: { "p_contact": string,"p_org_id": string,"p_program_id": string,"p_role": Database["public"]['Enums']["program_role"] }; Returns: string
                           },
"deprecate_solution_version":
{ Args: { "p_reason": string,"p_version_id": string }; Returns: undefined
                           },
"detect_incidents":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"dispute_attestation":
{ Args: { "p_attestation_id": string,"p_reason": string }; Returns: string
                           },
"enqueue_job":
{ Args: { "p_business_id"?: string,"p_dedupe_key"?: string,"p_max_attempts"?: number,"p_payload"?: Json,"p_run_at"?: string,"p_type": string }; Returns: string
                           },
"entitlement_status":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"evaluate_experiments":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"evaluate_forecasts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"experiment_report":
{ Args: { "p_id": string }; Returns: Json
                           },
"experiment_versions_for":
{ Args: { "p_business_id": string }; Returns: {
              "solution_id": string,"solution_version_id": string
            }[]
                           },
"explain_decision":
{ Args: { "p_id": string }; Returns: Json
                           },
"extraction_eval":
{ Args: { "p_days"?: number }; Returns: {
              "confirmed": number,"confirmed_unedited": number,"drafts": number,"edit_rate": number,"edited": number,"model": string,"reject_rate": number,"rejected": number
            }[]
                           },
"fail_job":
{ Args: { "p_error": string,"p_job_id": string,"p_retryable"?: boolean }; Returns: Database["public"]['Enums']["job_status"]
                           },
"feature_lineage":
{ Args: { "p_feature_key": string }; Returns: Json
                           },
"fx_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"give_pulse_feedback":
{ Args: { "p_business_id": string,"p_computed_on": string,"p_dimension": string,"p_note"?: string,"p_verdict": string }; Returns: undefined
                           },
"harvest_evidence":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"integrity_report":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intelligence_quality":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"invite_to_pilot":
{ Args: { "p_phones": (string)[],"p_pilot_id": string }; Returns: number
                           },
"job_overview":
{ Args: { "p_hours"?: number }; Returns: Json
                           },
"join_program":
{ Args: { "p_business_id": string,"p_consent": boolean,"p_join_code": string }; Returns: string
                           },
"latest_forecasts":
{ Args: { "p_business_id": string }; Returns: {
              "as_of": string,
"assumptions": NonNullable<Json>,
"basis": string,
"business_id": string,
"confidence": string,
"horizon_days": number,
"id": string,
"input_digest": string,
"inputs": NonNullable<Json>,
"kind": string,
"method": string,
"method_version": string,
"request": string | null,
"result": Json | null,
"subject_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "forecasts"
        isOneToOne: false
        isSetofReturn: true
      } },
"launch_playbook":
{ Args: { "p_business_id": string,"p_decision_id"?: string,"p_playbook_key": string }; Returns: string
                           },
"learning_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"leave_program":
{ Args: { "p_business_id": string,"p_program_id": string }; Returns: undefined
                           },
"measure_metric":
{ Args: { "p_business_id": string,"p_metric": string }; Returns: number
                           },
"memory_context":
{ Args: { "p_business_id": string,"p_topic": string }; Returns: Json
                           },
"memory_timeline":
{ Args: { "p_business_id": string,"p_include_inferred"?: boolean,"p_limit"?: number }; Returns: {
              "business_id": string,
"detail": NonNullable<Json>,
"id": string,
"kind": string,
"layer": string,
"occurred_at": string,
"refreshed_at": string,
"source_id": string,
"source_type": string,
"title": string,
"topic": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "business_memory"
        isOneToOne: false
        isSetofReturn: true
      } },
"message_for_send":
{ Args: { "p_message_id": string }; Returns: Json
                           },
"messaging_overview":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"moat_certification":
{ Args: { "p_days"?: number }; Returns: Json
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
"org_report":
{ Args: { "p_org_id": string }; Returns: Json
                           },
"org_sponsor_plan":
{ Args: { "p_org_id": string,"p_plan_key": string }; Returns: number
                           },
"pack_benchmark":
{ Args: { "p_business_id": string,"p_metric": string }; Returns: Json
                           },
"pack_pulse":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"partner_performance":
{ Args: { "p_days"?: number,"p_program_id"?: string }; Returns: Json
                           },
"partner_sponsor_business":
{ Args: { "p_active"?: boolean,"p_business_id": string,"p_provider_id": string }; Returns: undefined
                           },
"passport_facts":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"payment_reconciliation":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"payments_to_verify":
{ Args: { "p_limit"?: number }; Returns: {
              "access_code": string | null,
"amount_minor": number,
"billable_event_id": string,
"business_id": string,
"checkout_url": string | null,
"created_at": string,
"currency": string,
"failure_reason": string | null,
"id": string,
"last_verified_at": string | null,
"paid_amount_minor": number | null,
"paid_at": string | null,
"paid_currency": string | null,
"payment_channel": string | null,
"provider": string,
"provider_transaction_id": string | null,
"reference": string,
"refunded_minor": number,
"requested_by": string | null,
"revenue_event_id": string | null,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "payment_requests"
        isOneToOne: false
        isSetofReturn: true
      } },
"pilot_report":
{ Args: { "p_pilot_id": string }; Returns: Json
                           },
"playbook_effectiveness":
{ Args: Record<PropertyKey, never>; Returns: Json
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
"program_integrations":
{ Args: { "p_program_id": string }; Returns: Json
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
"read_dataset":
{ Args: { "p_key": string,"p_purpose": string }; Returns: Json
                           },
"real_world_certification":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"real_world_evidence":
{ Args: Record<PropertyKey, never>; Returns: Json
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
"record_fx_rates":
{ Args: { "p_effective_date": string,"p_rates": Json,"p_source": string }; Returns: number
                           },
"record_inbound_message":
{ Args: { "p_event_id": string,"p_from": string,"p_provider": string,"p_text": string }; Returns: string
                           },
"record_message_receipt":
{ Args: { "p_detail": Json,"p_event_id": string,"p_provider": string,"p_provider_message_id": string,"p_status": string }; Returns: boolean
                           },
"record_message_send":
{ Args: { "p_error": string,"p_final": boolean,"p_message_id": string,"p_provider": string,"p_provider_message_id": string }; Returns: undefined
                           },
"record_pack_entry":
{ Args: { "p_business_id": string,"p_data": Json,"p_entity": string,"p_occurred_at"?: string,"p_pack_key": string }; Returns: string
                           },
"record_payment_dispute":
{ Args: { "p_detail": Json,"p_event_id": string,"p_status": string,"p_transaction_id": string }; Returns: string
                           },
"record_payment_initialized":
{ Args: { "p_access_code": string,"p_checkout_url": string,"p_error": string,"p_id": string }; Returns: undefined
                           },
"record_refund_submission":
{ Args: { "p_error": string,"p_provider_refund_id": string,"p_refund_id": string }; Returns: undefined
                           },
"record_webhook_attempt":
{ Args: { "p_delivery_id": string,"p_error": string,"p_final": boolean,"p_status": number }; Returns: undefined
                           },
"refresh_business_memory":
{ Args: { "p_business_id": string }; Returns: number
                           },
"register_evidence":
{ Args: { "p_batch": string,"p_business_id": string,"p_claim": string,"p_confidence": string,"p_date": string,"p_outcome": string,"p_source": string,"p_verification_state": string }; Returns: string
                           },
"register_provider":
{ Args: { "p_contact": string,"p_description"?: string,"p_kind": string,"p_name": string }; Returns: string
                           },
"register_verifier":
{ Args: { "p_accreditation"?: string,"p_allowed_claims": (string)[],"p_kind": string,"p_name": string,"p_program_id"?: string,"p_provider_id"?: string }; Returns: string
                           },
"reject_draft":
{ Args: { "p_draft_id": string }; Returns: undefined
                           },
"reject_evidence":
{ Args: { "p_evidence_id": string,"p_reason": string }; Returns: undefined
                           },
"reproduce_forecast":
{ Args: { "p_forecast_id": string }; Returns: Json
                           },
"request_change":
{ Args: { "p_kind": string,"p_payload": Json,"p_reason": string,"p_target": string }; Returns: string
                           },
"request_payment_refund":
{ Args: { "p_amount_minor": number,"p_payment_request_id": string,"p_reason": string }; Returns: string
                           },
"request_verification":
{ Args: { "p_business_id": string,"p_claim_type": string,"p_consent": boolean,"p_params": Json,"p_verifier_id": string }; Returns: string
                           },
"requeue_job":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"resolve_dispute":
{ Args: { "p_decision": string,"p_dispute_id": string,"p_resolution": string }; Returns: undefined
                           },
"resolve_escalation":
{ Args: { "p_id": string }; Returns: undefined
                           },
"resolve_quality_issue":
{ Args: { "p_action": string,"p_issue_id": string,"p_note"?: string,"p_params"?: Json }; Returns: undefined
                           },
"retention_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"retire_policy":
{ Args: { "p_policy_id": string }; Returns: undefined
                           },
"revert_ops_action":
{ Args: { "p_action_id": string }; Returns: undefined
                           },
"review_provider":
{ Args: { "p_provider_id": string,"p_status": string }; Returns: undefined
                           },
"review_solution":
{ Args: { "p_decision": string,"p_note"?: string,"p_solution_id": string }; Returns: undefined
                           },
"review_verifier":
{ Args: { "p_status": string,"p_verifier_id": string }; Returns: undefined
                           },
"revoke_service_identity":
{ Args: { "p_identity_id": string }; Returns: undefined
                           },
"rollup_metrics":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"route_candidates":
{ Args: { "p_need"?: string,"p_program_id": string }; Returns: Json
                           },
"run_pack_workflows":
{ Args: { "p_business_id"?: string }; Returns: number
                           },
"run_routine_ops":
{ Args: { "p_business_id"?: string }; Returns: Json
                           },
"save_org_policy":
{ Args: { "p_definition": Json,"p_key": string,"p_note"?: string,"p_org_id": string }; Returns: string
                           },
"save_pilot":
{ Args: { "p_config": Json }; Returns: string
                           },
"save_policy":
{ Args: { "p_definition": Json,"p_key": string,"p_note"?: string,"p_scope_id": string,"p_scope_type": string }; Returns: string
                           },
"scale_metrics":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"scan_data_quality":
{ Args: { "p_business_id"?: string }; Returns: Json
                           },
"scan_retention":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"security_report":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"set_business_data_class":
{ Args: { "p_business_id": string,"p_class": string,"p_reason": string }; Returns: undefined
                           },
"set_business_identifier":
{ Args: { "p_business_id": string,"p_type": string,"p_value": string }; Returns: undefined
                           },
"set_data_sharing":
{ Args: { "p_business_id": string,"p_network": boolean }; Returns: undefined
                           },
"set_experiment_status":
{ Args: { "p_id": string,"p_reason"?: string,"p_status": string }; Returns: undefined
                           },
"set_message_consent":
{ Args: { "p_business_id": string,"p_channel": string,"p_opt_in": boolean }; Returns: undefined
                           },
"set_org_sla":
{ Args: { "p_org_id": string,"p_sla": Json }; Returns: undefined
                           },
"set_partner_capabilities":
{ Args: { "p_capabilities": (string)[],"p_program_id": string,"p_user_id": string }; Returns: undefined
                           },
"set_pilot_failure_reason":
{ Args: { "p_business_id": string,"p_pilot_id": string,"p_reason": string }; Returns: undefined
                           },
"set_plan_price":
{ Args: { "p_currency": string,"p_overage_minor"?: Json,"p_plan_key": string,"p_price_minor": number }; Returns: undefined
                           },
"set_platform_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"set_program_auto_route":
{ Args: { "p_on": boolean,"p_program_id": string }; Returns: undefined
                           },
"settle_billable_event":
{ Args: { "p_id": string,"p_method": string,"p_reference": string }; Returns: string
                           },
"simulate_policy":
{ Args: { "p_context": Json,"p_key": string }; Returns: Json
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
"solution_version_for":
{ Args: { "p_business_id": string,"p_solution_id": string }; Returns: string
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
"suggest_playbooks":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"suppress_message":
{ Args: { "p_message_id": string,"p_reason": string }; Returns: undefined
                           },
"take_eval_snapshot":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"take_intelligence_snapshot":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"update_dataset":
{ Args: { "p_allowed_uses": (string)[],"p_key": string,"p_min_group_size": number }; Returns: undefined
                           },
"upsert_market":
{ Args: { "p_market": Json }; Returns: undefined
                           },
"upsert_pack":
{ Args: { "p_definition": Json,"p_key": string,"p_name": string }; Returns: undefined
                           },
"verification_history":
{ Args: { "p_business_id": string }; Returns: Json
                           },
"verification_request_evidence":
{ Args: { "p_request_id": string }; Returns: Json
                           },
"verifier_attestations":
{ Args: Record<PropertyKey, never>; Returns: {
              "attested_at": string,"business_name": string,"claim_type": string,"id": string,"result": string,"status": string
            }[]
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
"webhook_delivery_for_send":
{ Args: { "p_delivery_id": string }; Returns: Json
                           },
"withdraw_evidence_package":
{ Args: { "p_package_id": string }; Returns: undefined
                           },
"withdraw_verification_request":
{ Args: { "p_request_id": string }; Returns: undefined
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

