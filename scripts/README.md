  What it does:
  1. Reads the MySQL dump file from ~/Downloads/terrajdg_stanleycup.sql
  2. Parses all the old tables (brackets, picks, winners, deadlines, points, seeds, tiebreakers)
  3. Generates scripts/migration-output.sql - a single SQL file wrapped in a transaction

  What it generated (test run):
  - 14 seasons (2012-2025)
  - 56 rounds with deadlines and point values
  - 210 matchups with team pairings, seeds, and winners
  - Picks skipped (user mapping needed)

  To use it:
  1. Fill in USER_MAPPING at the top of the script - each old user needs their Supabase auth UUID. You can
  find these in the Supabase Auth dashboard by looking up each user's email.
  2. Run node scripts/migrate-old-data.mjs
  3. Review scripts/migration-output.sql
  4. Paste into the Supabase SQL Editor and execute
