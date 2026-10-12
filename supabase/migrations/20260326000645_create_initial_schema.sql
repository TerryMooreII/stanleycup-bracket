
-- Teams table with all NHL teams
CREATE TABLE public.teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  conference TEXT NOT NULL CHECK (conference IN ('Western', 'Eastern')),
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT
);

-- Rounds table
CREATE TABLE public.rounds (
  id SERIAL PRIMARY KEY,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 4),
  name TEXT NOT NULL,
  pick_deadline TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matchups table
CREATE TABLE public.matchups (
  id SERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  team_home_id INTEGER NOT NULL REFERENCES public.teams(id),
  team_away_id INTEGER NOT NULL REFERENCES public.teams(id),
  seed_home TEXT,
  seed_away TEXT,
  winner_id INTEGER REFERENCES public.teams(id),
  series_home_wins INTEGER DEFAULT 0,
  series_away_wins INTEGER DEFAULT 0,
  bracket_position INTEGER NOT NULL,
  conference TEXT NOT NULL CHECK (conference IN ('Western', 'Eastern')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Picks table
CREATE TABLE public.picks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  matchup_id INTEGER NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES public.teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, matchup_id)
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

-- Teams: everyone can read
CREATE POLICY "Teams are viewable by everyone" ON public.teams
  FOR SELECT USING (true);

-- Rounds: everyone can read
CREATE POLICY "Rounds are viewable by everyone" ON public.rounds
  FOR SELECT USING (true);

-- Rounds: only admins can insert/update
CREATE POLICY "Admins can manage rounds" ON public.rounds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Profiles: users can read all profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

-- Profiles: users can update their own
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles: users can insert their own
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Matchups: everyone can read
CREATE POLICY "Matchups are viewable by everyone" ON public.matchups
  FOR SELECT USING (true);

-- Matchups: only admins can manage
CREATE POLICY "Admins can manage matchups" ON public.matchups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Picks: users can read all picks
CREATE POLICY "Picks are viewable by everyone" ON public.picks
  FOR SELECT USING (true);

-- Picks: users can insert their own picks (before deadline)
CREATE POLICY "Users can insert own picks before deadline" ON public.picks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matchups m
      JOIN public.rounds r ON r.id = m.round_id
      WHERE m.id = matchup_id
      AND (r.pick_deadline IS NULL OR r.pick_deadline > NOW())
    )
  );

-- Picks: users can update their own picks (before deadline)
CREATE POLICY "Users can update own picks before deadline" ON public.picks
  FOR UPDATE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matchups m
      JOIN public.rounds r ON r.id = m.round_id
      WHERE m.id = matchup_id
      AND (r.pick_deadline IS NULL OR r.pick_deadline > NOW())
    )
  );

-- Picks: users can delete their own picks (before deadline)
CREATE POLICY "Users can delete own picks before deadline" ON public.picks
  FOR DELETE USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matchups m
      JOIN public.rounds r ON r.id = m.round_id
      WHERE m.id = matchup_id
      AND (r.pick_deadline IS NULL OR r.pick_deadline > NOW())
    )
  );

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed NHL teams
INSERT INTO public.teams (name, abbreviation, conference, primary_color, secondary_color) VALUES
  ('Anaheim Ducks', 'ANA', 'Western', '#F47A38', '#B9975B'),
  ('Arizona Coyotes', 'ARI', 'Western', '#8C2633', '#E2D6B5'),
  ('Boston Bruins', 'BOS', 'Eastern', '#FFB81C', '#000000'),
  ('Buffalo Sabres', 'BUF', 'Eastern', '#003087', '#FFB81C'),
  ('Calgary Flames', 'CGY', 'Western', '#D2001C', '#FAAF19'),
  ('Carolina Hurricanes', 'CAR', 'Eastern', '#CC0000', '#000000'),
  ('Chicago Blackhawks', 'CHI', 'Western', '#CF0A2C', '#000000'),
  ('Colorado Avalanche', 'COL', 'Western', '#6F263D', '#236192'),
  ('Columbus Blue Jackets', 'CBJ', 'Eastern', '#002654', '#CE1126'),
  ('Dallas Stars', 'DAL', 'Western', '#006847', '#8F8F8C'),
  ('Detroit Red Wings', 'DET', 'Eastern', '#CE1126', '#FFFFFF'),
  ('Edmonton Oilers', 'EDM', 'Western', '#041E42', '#FF4C00'),
  ('Florida Panthers', 'FLA', 'Eastern', '#041E42', '#C8102E'),
  ('Los Angeles Kings', 'LAK', 'Western', '#111111', '#A2AAAD'),
  ('Minnesota Wild', 'MIN', 'Western', '#154734', '#A6192E'),
  ('Montreal Canadiens', 'MTL', 'Eastern', '#AF1E2D', '#192168'),
  ('Nashville Predators', 'NSH', 'Western', '#FFB81C', '#041E42'),
  ('New Jersey Devils', 'NJD', 'Eastern', '#CE1126', '#000000'),
  ('New York Islanders', 'NYI', 'Eastern', '#00539B', '#F47D30'),
  ('New York Rangers', 'NYR', 'Eastern', '#0038A8', '#CE1126'),
  ('Ottawa Senators', 'OTT', 'Eastern', '#C52032', '#C2912C'),
  ('Philadelphia Flyers', 'PHI', 'Eastern', '#F74902', '#000000'),
  ('Pittsburgh Penguins', 'PIT', 'Eastern', '#FCB514', '#000000'),
  ('San Jose Sharks', 'SJS', 'Western', '#006D75', '#EA7200'),
  ('Seattle Kraken', 'SEA', 'Western', '#001628', '#99D9D9'),
  ('St. Louis Blues', 'STL', 'Western', '#002F87', '#FCB514'),
  ('Tampa Bay Lightning', 'TBL', 'Eastern', '#002868', '#FFFFFF'),
  ('Toronto Maple Leafs', 'TOR', 'Eastern', '#00205B', '#FFFFFF'),
  ('Utah Hockey Club', 'UTA', 'Western', '#71AFE5', '#000000'),
  ('Vancouver Canucks', 'VAN', 'Western', '#00205B', '#00843D'),
  ('Vegas Golden Knights', 'VGK', 'Western', '#B4975A', '#333F42'),
  ('Washington Capitals', 'WSH', 'Eastern', '#041E42', '#C8102E'),
  ('Winnipeg Jets', 'WPG', 'Western', '#041E42', '#004C97');

-- Seed the 4 rounds
INSERT INTO public.rounds (round_number, name, is_active) VALUES
  (1, 'Round 1', false),
  (2, 'Round 2', false),
  (3, 'Conference Finals', false),
  (4, 'Stanley Cup Final', false);
