-- B40 Moat + scale certification. No new product surface: one read-only certification over
-- B1–B39 evidence — data, intelligence, solutions, network, operations, economics, impact — and
-- an explicit check of every link in the closed loop:
--   MORE BUSINESSES → MORE TRUSTED RECORDS → BETTER INTELLIGENCE → BETTER DECISIONS →
--   BETTER SOLUTIONS → VERIFIED OUTCOMES → STRONGER DISTRIBUTION → MORE BUSINESSES
-- Each link is 'evidenced', 'insufficient_evidence' (too little data to say) or 'not_met'.
-- The loop passes only when every link is evidenced by live data.

create function private.loop_link(name text, status text, evidence jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('link', name, 'status', status, 'evidence', evidence);
$$;

create function public.moat_certification(p_days int default 90) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  now_from timestamptz := now() - make_interval(days => p_days);
  prev_from timestamptz := now() - make_interval(days => 2 * p_days);
  scale jsonb;
  iq jsonb;
  ch jsonb;
  data_ jsonb; intel jsonb; sol jsonb; net jsonb; ops jsonb; econ jsonb; impact jsonb;
  b_now int; b_prev int;
  v_now numeric; v_prev numeric; r_now int; r_prev int;
  loop_ jsonb := '[]';
  verified_outcomes int;
  sourced int; acquired int;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  scale := public.scale_metrics(now_from, now());
  iq := public.intelligence_quality(p_days);
  ch := public.channel_economics(greatest(1, ceil(p_days / 30.0)::int));

  -- DATA
  select count(*) into b_now from public.businesses where created_at >= now_from;
  select count(*) into b_prev from public.businesses where created_at >= prev_from and created_at < now_from;
  select count(*), round(count(*) filter (where provenance <> 'self_reported')::numeric / nullif(count(*), 0), 3) into r_now, v_now
  from public.sales where voided_at is null and created_at >= now_from;
  select count(*), round(count(*) filter (where provenance <> 'self_reported')::numeric / nullif(count(*), 0), 3) into r_prev, v_prev
  from public.sales where voided_at is null and created_at >= prev_from and created_at < now_from;
  data_ := jsonb_build_object(
    'businesses', (select count(*) from public.businesses where archived_at is null),
    'businesses_with_3_months_history', (select count(*) from (select business_id from public.sales where voided_at is null
                                          group by business_id having max(occurred_at) - min(occurred_at) >= interval '90 days') x),
    'records_period', r_now, 'records_previous_period', r_prev,
    'backed_share_period', v_now, 'backed_share_previous_period', v_prev,
    'active_attestations', (select count(*) from public.attestations where status = 'active' and result = 'confirmed'),
    'open_quality_issues_per_business', (select round(count(*)::numeric / nullif((select count(*) from public.businesses), 0), 2) from public.data_quality_issues where status = 'open'),
    'network_opt_out_share', (select round(count(*) filter (where data_sharing = 'none')::numeric / nullif(count(*), 0), 3) from public.businesses));

  -- INTELLIGENCE
  intel := jsonb_build_object('pulse', iq -> 'pulse', 'forecasts', iq -> 'forecasts', 'decisions', iq -> 'decisions',
    'recommendations', iq -> 'recommendations', 'drift_alerts', jsonb_array_length(iq -> 'drift_alerts'));

  -- SOLUTIONS
  sol := jsonb_build_object(
    'plans_started', (select count(*) from public.interventions where started_at >= now_from),
    'businesses_with_a_plan', (select count(distinct business_id) from public.interventions where started_at >= now_from),
    'solutions_reused_by_5_plus', (select count(*) from (select solution_version_id from public.interventions where solution_version_id is not null
                                    group by solution_version_id having count(distinct business_id) >= 5) x),
    'verified_improved_rate', scale -> 'solutions' -> 'verified_outcome_rate',
    'playbook_runs', (select count(*) from public.playbook_runs where started_at >= now_from),
    'playbooks_improved', (select count(*) from public.playbook_runs where started_at >= now_from and (result ->> 'improved')::boolean),
    'experiments_concluded', (select count(*) from public.experiments where status = 'concluded'));

  -- NETWORK
  net := jsonb_build_object(
    'programs', (select count(*) from public.programs where not is_sandbox),
    'institutions', (select count(*) from public.organizations),
    'program_partners', (select count(*) from public.program_members where role = 'partner'),
    'providers_approved', (select count(*) from public.providers where status = 'approved'),
    'verifiers_approved', (select count(*) from public.verifiers where status = 'approved'),
    'api_integrations_active', (select count(*) from public.service_identities where status = 'active' and environment = 'live'),
    'acquisition_by_channel', (select coalesce(jsonb_object_agg(c ->> 'channel', c -> 'acquired'), '{}') from jsonb_array_elements(ch -> 'channels') c));

  -- OPERATIONS
  ops := jsonb_build_object(
    'businesses_per_operator', scale -> 'operations' -> 'businesses_per_operator',
    'automation', public.automation_overview(p_days),
    'median_days_plan_to_verified_outcome', (select round((percentile_cont(0.5) within group (order by extract(epoch from o.verified_at - i.started_at) / 86400))::numeric, 1)
                                             from public.outcomes o join public.interventions i on i.id = o.intervention_id where o.verified_at >= now_from),
    'cost_per_active_business_month_usd', scale -> 'economics_usd' -> 'cost_per_active_business_month',
    'open_incidents', (select count(*) from public.incidents where status <> 'resolved'));

  -- ECONOMICS
  econ := jsonb_build_object('scale', scale -> 'economics_usd', 'channels', ch -> 'channels',
    'revenue_by_payer', (select coalesce(jsonb_object_agg(k, v), '{}') from (
        select coalesce(b.payer_kind, 'unattributed') k, round(sum(private.to_usd(r.amount_minor, r.currency)), 2) v
        from public.revenue_events r left join public.billable_events b on b.id = r.billable_event_id where r.occurred_at >= now_from group by 1) x),
    'paid_or_sponsored_businesses', (select count(distinct e.business_id) from public.entitlements e join public.billing_plans p on p.id = e.plan_id
                                     where e.status = 'active' and p.price_minor > 0));

  -- IMPACT
  select count(*) into verified_outcomes from public.outcomes where status = 'verified' and improved and verified_at >= now_from;
  impact := jsonb_build_object('verified_improved_outcomes', verified_outcomes, 'vei_usd', scale -> 'impact_usd',
    'median_days_to_first_record', (select round((percentile_cont(0.5) within group (order by d))::numeric, 1) from (
        select extract(epoch from min(e.occurred_at) - b.created_at) / 86400 d from public.businesses b join public.events e on e.business_id = b.id
        and e.type in ('sale.recorded', 'expense.recorded') where b.created_at >= now_from group by b.id, b.created_at) x),
    'median_days_to_first_verified_outcome', (select round((percentile_cont(0.5) within group (order by d))::numeric, 1) from (
        select extract(epoch from min(o.verified_at) - b.created_at) / 86400 d from public.businesses b join public.outcomes o on o.business_id = b.id
        and o.status = 'verified' group by b.id, b.created_at) x));

  -- THE LOOP
  loop_ := loop_ || private.loop_link('MORE BUSINESSES',
    case when b_now = 0 then 'not_met' when b_prev = 0 then 'insufficient_evidence' when b_now >= b_prev then 'evidenced' else 'not_met' end,
    jsonb_build_object('new_this_period', b_now, 'new_previous_period', b_prev));
  loop_ := loop_ || private.loop_link('MORE TRUSTED RECORDS',
    case when r_now < 30 then 'insufficient_evidence' when r_now >= coalesce(r_prev, 0) and coalesce(v_now, 0) >= coalesce(v_prev, 0) then 'evidenced' else 'not_met' end,
    jsonb_build_object('records', r_now, 'previous', r_prev, 'backed_share', v_now, 'previous_backed_share', v_prev));
  loop_ := loop_ || private.loop_link('BETTER INTELLIGENCE',
    case when coalesce((iq -> 'forecasts' ->> 'evaluated')::int, 0) < 10 and coalesce((iq -> 'pulse' ->> 'feedback')::int, 0) < 20 then 'insufficient_evidence'
         when jsonb_array_length(iq -> 'drift_alerts') > 0 then 'not_met'
         when coalesce((iq -> 'forecasts' ->> 'interval_coverage')::numeric, 0.8) >= 0.7 and coalesce((iq -> 'pulse' ->> 'at_risk_precision')::numeric, 0.6) >= 0.6 then 'evidenced'
         else 'not_met' end,
    jsonb_build_object('forecast_coverage', iq -> 'forecasts' -> 'interval_coverage', 'pulse_precision', iq -> 'pulse' -> 'at_risk_precision', 'drift_alerts', jsonb_array_length(iq -> 'drift_alerts')));
  loop_ := loop_ || private.loop_link('BETTER DECISIONS',
    case when coalesce((iq -> 'decisions' ->> 'decisions')::int, 0) < 30 or (iq -> 'decisions' ->> 'improved_when_accepted') is null then 'insufficient_evidence'
         when (iq -> 'decisions' ->> 'improved_when_accepted')::numeric >= coalesce((iq -> 'decisions' ->> 'improved_when_overridden')::numeric, 0) then 'evidenced'
         else 'not_met' end,
    iq -> 'decisions');
  loop_ := loop_ || private.loop_link('BETTER SOLUTIONS',
    case when (select count(*) from public.experiments where status = 'concluded') = 0 and coalesce((scale -> 'solutions' ->> 'completed')::int, 0) < 30 then 'insufficient_evidence'
         when coalesce((scale -> 'solutions' ->> 'verified_outcome_rate')::numeric, 0) > 0 then 'evidenced' else 'not_met' end,
    jsonb_build_object('completed_plans', scale -> 'solutions' -> 'completed', 'verified_outcome_rate', scale -> 'solutions' -> 'verified_outcome_rate',
      'experiments_concluded', (select count(*) from public.experiments where status = 'concluded')));
  loop_ := loop_ || private.loop_link('VERIFIED OUTCOMES',
    case when verified_outcomes = 0 then 'not_met' when verified_outcomes < 10 then 'insufficient_evidence' else 'evidenced' end,
    jsonb_build_object('verified_improved', verified_outcomes, 'vei_usd', scale -> 'impact_usd' -> 'vei'));
  select coalesce(sum((c ->> 'acquired')::int) filter (where c ->> 'channel' <> 'organic'), 0), coalesce(sum((c ->> 'acquired')::int), 0)
    into sourced, acquired from jsonb_array_elements(ch -> 'channels') c;
  loop_ := loop_ || private.loop_link('STRONGER DISTRIBUTION',
    case when acquired < 20 then 'insufficient_evidence' when sourced::numeric / acquired >= 0.3 then 'evidenced' else 'not_met' end,
    jsonb_build_object('acquired', acquired, 'via_programs_and_partners', sourced, 'share', round(sourced::numeric / nullif(acquired, 0), 3)));

  return jsonb_build_object(
    'generated_at', now(), 'period_days', p_days,
    'data', data_, 'intelligence', intel, 'solutions', sol, 'network', net, 'operations', ops, 'economics', econ, 'impact', impact,
    'loop', loop_,
    'loop_status', case when not exists (select 1 from jsonb_array_elements(loop_) l where l ->> 'status' <> 'evidenced') then 'PASS'
                        when exists (select 1 from jsonb_array_elements(loop_) l where l ->> 'status' = 'not_met') then 'FAIL'
                        else 'PENDING_EVIDENCE' end,
    'note', 'Association, not causation, except where randomized experiments concluded. Links need minimum samples before they count.');
end $$;

revoke execute on function public.moat_certification(int) from public, anon;
grant execute on function public.moat_certification(int) to authenticated;
