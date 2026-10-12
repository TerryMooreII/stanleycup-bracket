
-- No two users can pick the same tiebreaker goals for the same matchup
CREATE UNIQUE INDEX unique_tiebreaker_per_matchup 
  ON public.picks (matchup_id, tiebreaker_goals) 
  WHERE tiebreaker_goals IS NOT NULL;
