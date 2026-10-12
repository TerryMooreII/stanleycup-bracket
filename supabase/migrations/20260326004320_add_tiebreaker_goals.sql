
-- Users predict total goals for the final
ALTER TABLE public.picks ADD COLUMN tiebreaker_goals INTEGER;

-- Admin enters actual total goals for a matchup (used for final)
ALTER TABLE public.matchups ADD COLUMN actual_total_goals INTEGER;
