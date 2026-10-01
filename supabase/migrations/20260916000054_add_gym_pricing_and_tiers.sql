alter table public.gyms add column price_min numeric;
alter table public.gyms add column price_max numeric;

alter table public.gyms add constraint gyms_price_min_non_negative check (price_min is null or price_min >= 0);
alter table public.gyms add constraint gyms_price_max_non_negative check (price_max is null or price_max >= 0);
alter table public.gyms add constraint gyms_price_min_lte_max
  check (price_min is null or price_max is null or price_min <= price_max);

-- Reusable price-tier computation, relative to each gym's OWN city (via the
-- same gym_locations -> localities -> cities join used by search_gyms), so
-- one gym never gets compared against a totally different city's price
-- range. A gym gets price_tier = NULL (excluded from tiering, not forced
-- into a bucket) when either: it has no price set, or it has no resolvable
-- city via that locality chain (no cohort to rank it within) - see the
-- `resolved`/`tiered` split below, which computes NTILE(3) only over rows
-- that have BOTH, then left-joins the rest back in with a null tier.
create or replace view public.gym_price_tiers as
with resolved as (
  select
    g.id as gym_id,
    ci.id as city_id,
    g.price_min,
    g.price_max,
    coalesce((g.price_min + g.price_max) / 2.0, g.price_min, g.price_max) as avg_price
  from public.gyms g
  left join public.gym_locations gl on gl.gym_id = g.id and gl.is_primary = true
  left join public.localities loc on loc.id = gl.locality_id
  left join public.cities ci on ci.id = loc.city_id
  where g.status = 'active'
),
tiered as (
  select
    gym_id,
    ntile(3) over (partition by city_id order by avg_price) as tier_number
  from resolved
  where city_id is not null and avg_price is not null
)
select
  resolved.gym_id,
  resolved.city_id,
  resolved.price_min,
  resolved.price_max,
  resolved.avg_price,
  case tiered.tier_number
    when 1 then 'budget'
    when 2 then 'mid'
    when 3 then 'premium'
    else null
  end as price_tier
from resolved
left join tiered on tiered.gym_id = resolved.gym_id;

grant select on public.gym_price_tiers to anon, authenticated;
