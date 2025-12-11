INSERT INTO badges (badge_key, name, svg_path, bonus_points)
VALUES
  ('treat_diallock', 'DialLock Treat', '/images/treat1.svg', 500)
ON CONFLICT (badge_key) DO NOTHING;

INSERT INTO badges (badge_key, name, svg_path, bonus_points)
VALUES
  ('treat_pintumbler', 'PinTumbler Treat', '/images/treat2.svg', 500)
ON CONFLICT (badge_key) DO NOTHING;