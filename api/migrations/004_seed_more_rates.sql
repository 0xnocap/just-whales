-- Seed additional reward rates for fishing and trading
INSERT INTO reward_rates (key, category, value, metadata) VALUES
  ('purchase.per_dollar', 'purchase', 10, '{"label":"$OP per $1 pathUSD spent buying NFTs"}'::jsonb),
  ('fishing.tackle_box_cost', 'fishing', 100, '{"label":"Tackle Box cost in $OP","casts_granted":10}'::jsonb),
  ('fishing.free_daily_casts', 'fishing', 5, '{"label":"Free daily casts"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
