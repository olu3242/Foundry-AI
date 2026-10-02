-- Gap closure: B26 intervention scenarios must never learn from businesses that opted out
-- of network data sharing. Enforce this at the forecasts persistence boundary so every caller,
-- including older compute_forecasts implementations, receives consent-filtered aggregate evidence.

create function private.enforce_intervention_scenario_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_n int;
  improved_n int;
  median_delta numeric;
  conf text;
begin
  if new.kind <> 'intervention_scenario' or new.subject_id is null then
    return new;
  end if;

  select
    count(*) filter (where i.status = 'completed')::int,
    count(*) filter (where o.improved and o.status = 'verified')::int,
    percentile_cont(0.5) within group (order by o.delta) filter (where o.status = 'verified')
  into completed_n, improved_n, median_delta
  from public.interventions i
  join public.businesses b on b.id = i.business_id
  left join public.outcomes o on o.intervention_id = i.id
  where i.solution_version_id = new.subject_id
    and b.data_sharing = 'network';

  conf := case
    when completed_n < 10 then 'insufficient'
    when completed_n < 30 then 'low'
    else 'medium'
  end;

  new.inputs := jsonb_set(
    jsonb_set(
      jsonb_set(new.inputs, '{completed}', to_jsonb(completed_n), true),
      '{improved}', to_jsonb(improved_n), true
    ),
    '{median_delta}', coalesce(to_jsonb(median_delta), 'null'::jsonb), true
  );
  new.input_digest := encode(extensions.digest(new.inputs::text, 'sha256'), 'hex');
  new.confidence := conf;
  new.basis := coalesce(new.inputs ->> 'solution', 'Plan') || ': ' || completed_n || ' completed, ' || improved_n || ' verified improvements from businesses that consented to network learning';
  new.request := case when conf = 'insufficient' then 'Not enough consented completed plans across Foundry yet to estimate the effect' end;
  new.result := case when conf = 'insufficient' then null else private.fc_compute(new.kind, new.inputs, new.horizon_days) end;
  new.method_version := 'fc-v2-consent';
  return new;
end
$$;

drop trigger if exists forecasts_intervention_consent on public.forecasts;
create trigger forecasts_intervention_consent
before insert or update of inputs, subject_id on public.forecasts
for each row
when (new.kind = 'intervention_scenario')
execute function private.enforce_intervention_scenario_consent();

revoke execute on function private.enforce_intervention_scenario_consent() from public, anon, authenticated;
