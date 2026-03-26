# Stanley Cup Bracket

An NHL Stanley Cup Playoffs bracket prediction app. Users log in, view the bracket, and pick winners for each round. An admin sets up matchups, deadlines, and scores. A leaderboard tracks points with a tiebreaker system for the Final.

## Tech Stack

- **Frontend**: Vue 3, Vite, Pinia, Vue Router
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
- **Styling**: Custom CSS with CSS variables (dark theme)

## Features

- Interactive bracket with team logos — click to pick winners
- Admin panel: manage seasons, matchups, deadlines, points per round, series scores
- Drag-and-drop matchup reordering in admin
- Leaderboard with configurable points per round
- Stanley Cup Final tiebreaker: predict total goals (unique per user, closest without going over wins)
- Picks page: see what everyone picked after the deadline locks
- Pick history: view any user's picks for any season, side-by-side comparison
- User profiles with stats and password management
- Season support: start fresh each year, historical data preserved
- Responsive mobile layout
- Row Level Security on all tables

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com/) project

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd stanleycup
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com/)
2. Go to **Settings > API** and copy your **Project URL** and **anon public key**
3. Run the database migrations (see [Database Setup](#database-setup) below)

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install and run

```bash
npm install
npm run dev
```

The app will be running at `http://localhost:5173`.

### 5. Create your first admin user

1. Register a new account through the app
2. Confirm your email (check your inbox)
3. In the Supabase dashboard, go to **SQL Editor** and run:

```sql
UPDATE public.profiles SET is_admin = true WHERE display_name = 'Your Name';
```

4. Refresh the app — you'll see the **Admin** link in the navbar

## Database Setup

The app uses 6 migrations that create all tables, RLS policies, and seed data. You can apply them through the Supabase dashboard SQL editor or CLI.

### Tables

| Table | Purpose |
|-------|---------|
| `seasons` | Year and active flag. Only one active at a time |
| `teams` | All 33 NHL teams with abbreviations, colors, conference |
| `rounds` | 4 rounds per season (R1, R2, CF, Final) with deadline and points config |
| `matchups` | Bracket matchups linking two teams per round with series scores |
| `picks` | User predictions per matchup, with optional tiebreaker goals |
| `profiles` | User display names and admin flag, auto-created on signup |

### Row Level Security

All tables have RLS enabled:

- **Everyone can read** all tables (teams, rounds, matchups, picks, profiles, seasons)
- **Users** can only insert/update/delete their own picks, and only before the round deadline
- **Admins** (profiles.is_admin = true) can manage rounds, matchups, and seasons
- **Users cannot** set their own `is_admin` flag (enforced by RLS policy)
- Profile inserts are locked to `is_admin = false`

### Migrations (in order)

1. `create_initial_schema` — Teams, rounds, matchups, picks, profiles tables + RLS + seed data
2. `add_points_per_round` — Configurable points per correct pick per round
3. `add_seasons_table` — Season/year support with FK on rounds
4. `add_tiebreaker_goals` — Tiebreaker predictions for the Final + actual goals on matchups
5. `unique_tiebreaker_goals_per_matchup` — No duplicate tiebreaker predictions per matchup
6. `fix_security_vulnerabilities` — Prevent users from escalating to admin

## Project Structure

```
src/
  lib/supabase.js          # Supabase client
  stores/
    auth.js                # Auth state, login/signup/signout
    bracket.js             # Bracket data, picks, admin operations
  router/index.js          # Routes with auth guards
  components/
    NavBar.vue             # Responsive nav with auth state
    MatchupCard.vue        # Team matchup display + click to pick
    EmptyMatchupCard.vue   # TBD placeholder
  views/
    BracketView.vue        # Main bracket (desktop + mobile)
    AdminView.vue          # Admin panel
    LeaderboardView.vue    # Rankings and scoring
    PicksView.vue          # Community picks per round
    HistoryView.vue        # Pick history + comparison
    ProfileView.vue        # User profile + stats
    LoginView.vue          # Sign in
    RegisterView.vue       # Create account
  App.vue                  # Root component
  main.js                  # App entry point
  style.css                # Global styles + CSS variables
```

## Admin Workflow

1. **Create a season** — Admin panel > "New Season" button
2. **Add matchups** — Select round and conference, click "+ Add Matchup", pick teams and seeds
3. **Activate the round** — Toggle the round to "Active" so users can pick
4. **Set a deadline** — Edit the pick deadline for the round
5. **Update scores** — As series progress, update win counts and mark winners
6. **Repeat** for each round as the playoffs advance

## Scoring

- Each round has configurable **points per correct pick** (e.g., R1=1, R2=2, CF=3, Final=5)
- Leaderboard sorts by: total points > tiebreaker > correct picks > name
- **Tiebreaker**: For the Stanley Cup Final, users predict total goals in the series. Closest without going over wins ties. Each number can only be picked once.

## Building for Production

```bash
npm run build
```

Output is in `dist/`. Deploy to any static hosting (Vercel, Netlify, etc.).

For SPA routing, configure your host to serve `index.html` for all routes.
