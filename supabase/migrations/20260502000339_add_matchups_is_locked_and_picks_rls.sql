-- Add per-matchup lock flag for admin to lock individual series before round-level deadline
ALTER TABLE public.matchups ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Update picks RLS policies to also reject when matchup.is_locked is true
DROP POLICY IF EXISTS "Users can insert own picks before deadline" ON public.picks;
CREATE POLICY "Users can insert own picks before deadline"
  ON public.picks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM matchups m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = picks.matchup_id
        AND m.is_locked = false
        AND (r.pick_deadline IS NULL OR r.pick_deadline > now())
    )
  );

DROP POLICY IF EXISTS "Users can update own picks before deadline" ON public.picks;
CREATE POLICY "Users can update own picks before deadline"
  ON public.picks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM matchups m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = picks.matchup_id
        AND m.is_locked = false
        AND (r.pick_deadline IS NULL OR r.pick_deadline > now())
    )
  );

DROP POLICY IF EXISTS "Users can delete own picks before deadline" ON public.picks;
CREATE POLICY "Users can delete own picks before deadline"
  ON public.picks FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM matchups m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = picks.matchup_id
        AND m.is_locked = false
        AND (r.pick_deadline IS NULL OR r.pick_deadline > now())
    )
  );