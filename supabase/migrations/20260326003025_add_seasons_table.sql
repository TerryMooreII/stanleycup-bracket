
-- Create seasons table
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active season at a time
CREATE UNIQUE INDEX seasons_one_active ON public.seasons (is_active) WHERE is_active = true;

-- Add season_id to rounds
ALTER TABLE public.rounds ADD COLUMN season_id UUID REFERENCES public.seasons(id);

-- Backfill: create 2026 season and link existing rounds
INSERT INTO public.seasons (year, is_active) VALUES (2026, true);
UPDATE public.rounds SET season_id = (SELECT id FROM public.seasons WHERE year = 2026);
ALTER TABLE public.rounds ALTER COLUMN season_id SET NOT NULL;

-- RLS for seasons
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasons are viewable by everyone" ON public.seasons
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage seasons" ON public.seasons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
