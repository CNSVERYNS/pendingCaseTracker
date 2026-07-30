-- Personalized processing-time predictions (build brief follow-up,
-- 2026-07-30): given a form type, office, and the stage a case is
-- currently at, returns how long similar anonymous cases took to reach a
-- decision from that same stage. Reads only aggregates from `intervals` —
-- never a raw row — so it's safe to expose directly to authenticated
-- clients despite intervals itself having zero direct-access policies.
create function public.get_stage_estimate(
  p_form_type text,
  p_office_code text,
  p_from_kind text,
  p_to_kind text default 'decision'
)
returns table (sample_size integer, median_days numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer as sample_size,
    percentile_cont(0.5) within group (order by days) as median_days
  from public.intervals
  where form_type = p_form_type
    and office_code = p_office_code
    and from_kind = p_from_kind
    and to_kind = p_to_kind;
$$;

grant execute on function public.get_stage_estimate(text, text, text, text) to authenticated;
