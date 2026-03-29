#!/usr/bin/env node

/**
 * Migration Script: Import old MySQL Stanley Cup data into new Supabase DB
 *
 * Usage:
 *   node scripts/migrate-old-data.mjs [path-to-sql-dump]
 *
 * Default dump path: ~/Downloads/terrajdg_stanleycup.sql
 * Output: scripts/migration-output.sql
 *
 * Steps:
 *   1. Fill in the USER_MAPPING below with Supabase auth UUIDs
 *   2. Run this script to generate the SQL
 *   3. Review the generated SQL file
 *   4. Paste into Supabase SQL Editor and execute
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// USER MAPPING - FILL THIS IN BEFORE RUNNING
// =============================================================================
// Look up each user's UUID in the Supabase Auth dashboard:
//   1. Go to your Supabase project -> Authentication -> Users
//   2. Find each user by email
//   3. Copy their UUID and paste it into the newUuid field below
//
// If you haven't created these users in Supabase Auth yet, you need to do that
// first. Each user needs an entry in auth.users AND a corresponding row in the
// profiles table.
//
// If UUIDs are not filled in, the script will still generate SQL for seasons,
// rounds, and matchups — but will skip picks.
// =============================================================================
const USER_MAPPING = [
  { oldId: 1,  username: 'terry.moore.ii', fullName: 'Terry Moore II',  email: 'motersho@gmail.com',          newUuid: 'a03cd159-1f8a-4a3d-8323-35c8c06db90c' },
  { oldId: 8,  username: 'tj',             fullName: 'TJ Moore',        email: 'tjmoore24@roadrunner.com',     newUuid: '1bd71c35-1fbc-46ff-969d-d4a917e508b8' },
  { oldId: 12, username: 'Stacie',         fullName: 'Stacie Moore',    email: 'smoore@miamisburg.k12.oh.us',  newUuid: '41c5cd20-8cb9-4ef2-98ab-042c902d46a2' },
  { oldId: 13, username: 'terry',          fullName: 'Terry Moore',     email: 'themooreman53@gmail.com',      newUuid: 'a3ae51b6-de98-48e8-93f4-7caab8eab9e3' },
  { oldId: 14, username: 'betty',          fullName: 'Betty Moore',     email: 'bmoore.25@woh.rr.com',         newUuid: 'ef6eecee-db1b-4ef8-a287-56991a16387a' },
  { oldId: 15, username: 'kinley',         fullName: 'Kinley Moore',    email: 'skemper24@gmail.com',           newUuid: 'bcc28716-2a45-4ad6-b94d-52f2c29997f1' },
  { oldId: 16, username: 'shonagh',        fullName: 'Shonagh Moore',   email: 'shonagh.moore@gmail.com',      newUuid: '3b04eef1-7fe0-45c4-8070-be28aa4225af' },
  { oldId: 17, username: 'nathan',         fullName: 'Nathan Moore',    email: 'motersho@gmail.com',           newUuid: 'a67ffe80-0c75-4963-9848-7efbf507b748' },
  { oldId: 18, username: 'ethel',          fullName: 'Ethel Moore',     email: 'ethemoore2015@gmail.com',      newUuid: '2e769de8-4156-4652-b5d2-53e62ed3defe' },
  { oldId: 19, username: 'ken',          fullName: 'Ken Moore',     email: 'kenmoe@prodigy.com',      newUuid: '68f99a57-3c9e-40ed-9b21-4499ac79ab39' },
];

// =============================================================================
// TEAM ID MAPPING (Old MySQL ID -> New Supabase ID)
// =============================================================================
const TEAM_MAP = {
  1: 18,  // New Jersey Devils
  2: 19,  // New York Islanders
  3: 20,  // New York Rangers
  4: 22,  // Philadelphia Flyers
  5: 23,  // Pittsburgh Penguins
  6: 3,   // Boston Bruins
  7: 4,   // Buffalo Sabres
  8: 16,  // Montreal Canadiens
  9: 21,  // Ottawa Senators
  10: 28, // Toronto Maple Leafs
  11: 33, // Winnipeg Jets
  12: 6,  // Carolina Hurricanes
  13: 13, // Florida Panthers
  14: 27, // Tampa Bay Lightning
  15: 32, // Washington Capitals
  16: 7,  // Chicago Blackhawks
  17: 9,  // Columbus Blue Jackets
  18: 11, // Detroit Red Wings
  19: 17, // Nashville Predators
  20: 26, // St. Louis Blues
  21: 5,  // Calgary Flames
  22: 8,  // Colorado Avalanche
  23: 12, // Edmonton Oilers
  24: 15, // Minnesota Wild
  25: 30, // Vancouver Canucks
  26: 1,  // Anaheim Ducks
  27: 10, // Dallas Stars
  28: 14, // Los Angeles Kings
  29: 2,  // Phoenix Coyotes -> Arizona Coyotes
  30: 24, // San Jose Sharks
  31: 31, // Vegas Golden Knights
  32: 25, // Seattle Kraken
};

// Conference lookup for new team IDs (for Stanley Cup Final matchups)
const NEW_TEAM_CONFERENCE = {
  1: 'Western',  // Anaheim Ducks
  2: 'Western',  // Arizona Coyotes
  3: 'Eastern',  // Boston Bruins
  4: 'Eastern',  // Buffalo Sabres
  5: 'Western',  // Calgary Flames
  6: 'Eastern',  // Carolina Hurricanes
  7: 'Western',  // Chicago Blackhawks
  8: 'Western',  // Colorado Avalanche
  9: 'Eastern',  // Columbus Blue Jackets
  10: 'Western', // Dallas Stars
  11: 'Eastern', // Detroit Red Wings
  12: 'Western', // Edmonton Oilers
  13: 'Eastern', // Florida Panthers
  14: 'Western', // Los Angeles Kings
  15: 'Western', // Minnesota Wild
  16: 'Eastern', // Montreal Canadiens
  17: 'Western', // Nashville Predators
  18: 'Eastern', // New Jersey Devils
  19: 'Eastern', // New York Islanders
  20: 'Eastern', // New York Rangers
  21: 'Eastern', // Ottawa Senators
  22: 'Eastern', // Philadelphia Flyers
  23: 'Eastern', // Pittsburgh Penguins
  24: 'Western', // San Jose Sharks
  25: 'Western', // Seattle Kraken
  26: 'Western', // St. Louis Blues
  27: 'Eastern', // Tampa Bay Lightning
  28: 'Eastern', // Toronto Maple Leafs
  29: 'Western', // Utah Hockey Club
  30: 'Western', // Vancouver Canucks
  31: 'Western', // Vegas Golden Knights
  32: 'Eastern', // Washington Capitals
  33: 'Western', // Winnipeg Jets
};

// =============================================================================
// MYSQL DUMP PARSER
// =============================================================================

function parseInserts(sql, tableName) {
  // Match INSERT INTO `TableName` (...) VALUES ... ;
  const pattern = new RegExp(
    `INSERT INTO \`${tableName}\`\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?);`,
    'gi'
  );
  const rows = [];
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    const valuesStr = match[1];
    // Split into individual row tuples
    const tupleRegex = /\(([^)]*)\)/g;
    let tupleMatch;
    while ((tupleMatch = tupleRegex.exec(valuesStr)) !== null) {
      const fields = parseTupleFields(tupleMatch[1]);
      rows.push(fields);
    }
  }
  return rows;
}

function parseTupleFields(tupleStr) {
  const fields = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < tupleStr.length; i++) {
    const ch = tupleStr[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (ch === "'" && !inString) {
      inString = true;
      continue;
    }
    if (ch === "'" && inString) {
      // Check for escaped quote ''
      if (i + 1 < tupleStr.length && tupleStr[i + 1] === "'") {
        current += "'";
        i++;
        continue;
      }
      inString = false;
      continue;
    }
    if (ch === ',' && !inString) {
      fields.push(parseValue(current.trim()));
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(parseValue(current.trim()));
  return fields;
}

function parseValue(val) {
  if (val === 'NULL' || val === 'null') return null;
  // Remove surrounding quotes if any
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1);
  }
  const num = Number(val);
  if (!isNaN(num) && val !== '') return num;
  return val;
}

// =============================================================================
// ROUND CODE PARSER
// =============================================================================

/**
 * Parse old bracket round code like 'ER1G1A' or 'WR2G2B' or 'SR4G1A'
 * Returns { conference, roundNumber, gameNumber, slot }
 */
function parseBracketCode(code) {
  // Format: {E|W|S}R{1-4}G{1-4}{A|B}
  const m = code.match(/^([EWS])R(\d)G(\d)([AB])$/);
  if (!m) return null;
  return {
    confLetter: m[1],
    conference: m[1] === 'E' ? 'Eastern' : m[1] === 'W' ? 'Western' : 'Stanley',
    roundNumber: parseInt(m[2]),
    gameNumber: parseInt(m[3]),
    slot: m[4],
  };
}

/**
 * Parse old pick/winner round code like 'ER1G1' or 'SR4G1'
 * Returns { conference, roundNumber, gameNumber }
 */
function parseMatchupCode(code) {
  const m = code.match(/^([EWS])R(\d)G(\d)$/);
  if (!m) return null;
  return {
    confLetter: m[1],
    conference: m[1] === 'E' ? 'Eastern' : m[1] === 'W' ? 'Western' : 'Stanley',
    roundNumber: parseInt(m[2]),
    gameNumber: parseInt(m[3]),
  };
}

// =============================================================================
// MAIN
// =============================================================================

const dumpPath = process.argv[2] || resolve(homedir(), 'Downloads', 'terrajdg_stanleycup.sql');
const outputPath = resolve(__dirname, 'migration-output.sql');

console.log(`Reading dump from: ${dumpPath}`);
const sql = readFileSync(dumpPath, 'utf-8');

// Parse all tables
console.log('Parsing tables...');
const brackets = parseInserts(sql, 'Brackets');
const picks = parseInserts(sql, 'Picks');
const roundWinners = parseInserts(sql, 'RoundWinningTeam');
const lockPicks = parseInserts(sql, 'LockPicks');
const pointsPerRound = parseInserts(sql, 'PointsPerRound');
const ranks = parseInserts(sql, 'Rank');
const scGoalsPick = parseInserts(sql, 'StanleyCupGoalsPick');
const scGoalsWin = parseInserts(sql, 'StanleyCupGoalsWin');

console.log(`  Brackets: ${brackets.length} rows`);
console.log(`  Picks: ${picks.length} rows`);
console.log(`  RoundWinningTeam: ${roundWinners.length} rows`);
console.log(`  LockPicks: ${lockPicks.length} rows`);
console.log(`  PointsPerRound: ${pointsPerRound.length} rows`);
console.log(`  Rank: ${ranks.length} rows`);
console.log(`  StanleyCupGoalsPick: ${scGoalsPick.length} rows`);
console.log(`  StanleyCupGoalsWin: ${scGoalsWin.length} rows`);

// Check user mapping
const usersReady = USER_MAPPING.every(u => u.newUuid && u.newUuid.length > 0);
if (!usersReady) {
  console.log('\n⚠️  USER_MAPPING not filled in — will skip picks insertion.');
  console.log('   Fill in newUuid for each user, then re-run to include picks.\n');
}

// Build lookup maps
const lockPickMap = new Map(); // `${year}-${round}` -> lockDate
for (const [year, round, lockDate] of lockPicks) {
  lockPickMap.set(`${year}-${round}`, lockDate);
}

const pointsMap = new Map(); // `${year}-${round}` -> points
for (const [year, round, points] of pointsPerRound) {
  pointsMap.set(`${year}-${round}`, points);
}

const winnerMap = new Map(); // `${year}-${roundCode}` -> oldTeamId
for (const [year, round, winner] of roundWinners) {
  winnerMap.set(`${year}-${round}`, winner);
}

const rankMap = new Map(); // `${year}-${oldTeamId}` -> rank
for (const [year, team, rank, _conf] of ranks) {
  rankMap.set(`${year}-${team}`, rank);
}

const scGoalsWinMap = new Map(); // year -> numberOfGoals
for (const [year, goals] of scGoalsWin) {
  scGoalsWinMap.set(year, goals);
}

const scGoalsPickMap = new Map(); // `${year}-${oldUserId}` -> numberOfGoals
for (const [year, userId, goals] of scGoalsPick) {
  scGoalsPickMap.set(`${year}-${userId}`, goals);
}

// Build user map (oldId -> newUuid)
const userMap = new Map();
for (const u of USER_MAPPING) {
  if (u.newUuid) userMap.set(u.oldId, u.newUuid);
}

// =============================================================================
// STEP 1: Parse brackets into matchup pairs
// =============================================================================

// Group bracket rows: key = `${year}-${confLetter}R${round}G${game}`
const bracketPairs = new Map(); // key -> { A: oldTeamId, B: oldTeamId }

for (const [_id, year, roundCode, oldTeamId] of brackets) {
  const parsed = parseBracketCode(roundCode);
  if (!parsed) {
    console.warn(`  Skipping unparseable bracket code: ${roundCode}`);
    continue;
  }
  const key = `${year}-${parsed.confLetter}R${parsed.roundNumber}G${parsed.gameNumber}`;
  if (!bracketPairs.has(key)) bracketPairs.set(key, {});
  bracketPairs.get(key)[parsed.slot] = oldTeamId;
}

// Validate all pairs have both A and B
let pairErrors = 0;
for (const [key, pair] of bracketPairs) {
  if (!pair.A || !pair.B) {
    console.warn(`  Incomplete bracket pair: ${key} -> A=${pair.A}, B=${pair.B}`);
    pairErrors++;
  }
}
if (pairErrors > 0) {
  console.warn(`  ${pairErrors} incomplete bracket pairs found.`);
}

// =============================================================================
// STEP 2: Get unique years
// =============================================================================

const years = [...new Set(brackets.map(b => b[1]))].sort();
console.log(`\nSeasons to import: ${years.join(', ')}`);

// =============================================================================
// GENERATE SQL
// =============================================================================

const lines = [];

function emit(line) {
  lines.push(line);
}

function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

emit('-- =============================================================================');
emit('-- Migration: Import old Stanley Cup data (2012-2025)');
emit(`-- Generated: ${new Date().toISOString()}`);
emit('-- =============================================================================');
emit('');
emit('BEGIN;');
emit('');

// --- Seasons ---
emit('-- STEP 1: Insert seasons');
for (const year of years) {
  emit(`INSERT INTO seasons (year, is_active) VALUES (${year}, false) ON CONFLICT (year) DO NOTHING;`);
}
emit('');

// --- Rounds ---
emit('-- STEP 2: Insert rounds (need season UUIDs)');
emit('-- Using a DO block to look up season IDs dynamically');
emit('DO $$');
emit('DECLARE');
emit('  v_season_id uuid;');
emit('BEGIN');

for (const year of years) {
  emit(`  SELECT id INTO v_season_id FROM seasons WHERE year = ${year};`);
  for (let round = 1; round <= 4; round++) {
    const deadline = lockPickMap.get(`${year}-${round}`);
    const points = pointsMap.get(`${year}-${round}`) ?? 1;
    const roundName = round === 1 ? 'Round 1' : round === 2 ? 'Round 2' : round === 3 ? 'Conference Finals' : 'Stanley Cup Final';
    const deadlineSql = deadline ? `'${deadline}'::timestamptz` : 'NULL';
    emit(`  INSERT INTO rounds (season_id, round_number, name, pick_deadline, points_per_correct, is_active)`);
    emit(`    VALUES (v_season_id, ${round}, '${roundName}', ${deadlineSql}, ${points}, false)`);
    emit(`    ON CONFLICT (season_id, round_number) DO NOTHING;`);
  }
  emit('');
}
emit('END $$;');
emit('');

// --- Matchups ---
emit('-- STEP 3: Insert matchups');
emit('DO $$');
emit('DECLARE');
emit('  v_round_id integer;');
emit('BEGIN');

// Process each bracket pair
const matchupKeys = [...bracketPairs.keys()].sort();
// Track matchup identifiers for pick mapping later
const matchupIndex = []; // { year, confLetter, roundNumber, gameNumber, newHomeId, newAwayId }

for (const key of matchupKeys) {
  const pair = bracketPairs.get(key);
  if (!pair.A || !pair.B) continue;

  // Parse key: `${year}-${confLetter}R${round}G${game}`
  const keyMatch = key.match(/^(\d+)-([EWS])R(\d)G(\d)$/);
  if (!keyMatch) continue;

  const year = parseInt(keyMatch[1]);
  const confLetter = keyMatch[2];
  const roundNumber = parseInt(keyMatch[3]);
  const gameNumber = parseInt(keyMatch[4]);

  const newHomeId = TEAM_MAP[pair.A];
  const newAwayId = TEAM_MAP[pair.B];

  if (!newHomeId || !newAwayId) {
    console.warn(`  Missing team mapping for pair: ${key} (A=${pair.A}, B=${pair.B})`);
    continue;
  }

  // Determine conference for the matchup
  let conference;
  if (confLetter === 'S') {
    // Stanley Cup Final - use team A's conference in the new DB
    conference = NEW_TEAM_CONFERENCE[newHomeId];
  } else {
    conference = confLetter === 'E' ? 'Eastern' : 'Western';
  }

  // Winner
  const matchupCode = `${confLetter}R${roundNumber}G${gameNumber}`;
  const winnerOldId = winnerMap.get(`${year}-${matchupCode}`);
  const winnerId = winnerOldId ? TEAM_MAP[winnerOldId] : null;

  // Seeds
  const seedHome = rankMap.get(`${year}-${pair.A}`);
  const seedAway = rankMap.get(`${year}-${pair.B}`);

  // Total goals for Stanley Cup Final
  const totalGoals = roundNumber === 4 ? scGoalsWinMap.get(year) : null;

  // Store for pick mapping
  matchupIndex.push({ year, confLetter, roundNumber, gameNumber, newHomeId, newAwayId });

  emit(`  -- ${year} ${matchupCode}: team ${pair.A}->${newHomeId} vs ${pair.B}->${newAwayId}`);
  emit(`  SELECT r.id INTO v_round_id FROM rounds r JOIN seasons s ON r.season_id = s.id WHERE s.year = ${year} AND r.round_number = ${roundNumber};`);
  emit(`  INSERT INTO matchups (round_id, team_home_id, team_away_id, seed_home, seed_away, bracket_position, conference, winner_id, actual_total_goals)`);
  emit(`    VALUES (v_round_id, ${newHomeId}, ${newAwayId}, ${seedHome ? sqlStr(String(seedHome)) : 'NULL'}, ${seedAway ? sqlStr(String(seedAway)) : 'NULL'}, ${gameNumber}, '${conference}', ${winnerId ?? 'NULL'}, ${totalGoals ?? 'NULL'})`);
  emit(`    ON CONFLICT DO NOTHING;`);
  emit('');
}

emit('END $$;');
emit('');

// --- Picks ---
if (usersReady) {
  emit('-- STEP 4: Insert picks');
  emit('DO $$');
  emit('DECLARE');
  emit('  v_matchup_id integer;');
  emit('BEGIN');

  // Build a lookup: `${year}-${confLetter}R${round}G${game}` -> { newHomeId, newAwayId }
  const matchupLookup = new Map();
  for (const m of matchupIndex) {
    const key = `${m.year}-${m.confLetter}R${m.roundNumber}G${m.gameNumber}`;
    matchupLookup.set(key, m);
  }

  let skippedPicks = 0;

  // Picks format: [year, userId, roundCode, pickTeamId]
  for (const [year, oldUserId, roundCode, oldPickTeamId] of picks) {
    const parsed = parseMatchupCode(roundCode);
    if (!parsed) {
      console.warn(`  Skipping unparseable pick code: ${roundCode}`);
      skippedPicks++;
      continue;
    }

    const matchupKey = `${year}-${parsed.confLetter}R${parsed.roundNumber}G${parsed.gameNumber}`;
    const matchup = matchupLookup.get(matchupKey);
    if (!matchup) {
      console.warn(`  No matchup found for pick: ${matchupKey} (user=${oldUserId})`);
      skippedPicks++;
      continue;
    }

    const newUserId = userMap.get(oldUserId);
    if (!newUserId) {
      skippedPicks++;
      continue;
    }

    const newPickTeamId = TEAM_MAP[oldPickTeamId];
    if (!newPickTeamId) {
      console.warn(`  No team mapping for pick team: ${oldPickTeamId}`);
      skippedPicks++;
      continue;
    }

    // Tiebreaker goals for Stanley Cup Final picks
    const tiebreakerGoals = parsed.roundNumber === 4
      ? scGoalsPickMap.get(`${year}-${oldUserId}`)
      : null;

    emit(`  SELECT m.id INTO v_matchup_id FROM matchups m JOIN rounds r ON m.round_id = r.id JOIN seasons s ON r.season_id = s.id WHERE s.year = ${year} AND r.round_number = ${parsed.roundNumber} AND m.team_home_id = ${matchup.newHomeId} AND m.team_away_id = ${matchup.newAwayId} LIMIT 1;`);
    emit(`  IF v_matchup_id IS NOT NULL THEN`);
    emit(`    INSERT INTO picks (user_id, matchup_id, team_id, tiebreaker_goals)`);
    emit(`      VALUES ('${newUserId}', v_matchup_id, ${newPickTeamId}, ${tiebreakerGoals ?? 'NULL'})`);
    emit(`      ON CONFLICT (user_id, matchup_id) DO NOTHING;`);
    emit(`  END IF;`);
    emit('');
  }

  if (skippedPicks > 0) {
    console.log(`  Skipped ${skippedPicks} picks (missing mappings or unparseable codes)`);
  }

  emit('END $$;');
  emit('');
} else {
  emit('-- STEP 4: Picks SKIPPED (user mapping not provided)');
  emit('-- Re-run the script with USER_MAPPING filled in to generate pick inserts.');
  emit('');
}

// --- Verification queries ---
emit('-- =============================================================================');
emit('-- VERIFICATION QUERIES (run these after the migration)');
emit('-- =============================================================================');
emit('');
emit('-- Count seasons');
emit('-- SELECT year FROM seasons WHERE year BETWEEN 2012 AND 2025 ORDER BY year;');
emit('');
emit('-- Count rounds per season');
emit('-- SELECT s.year, count(r.id) as rounds FROM rounds r JOIN seasons s ON r.season_id = s.id WHERE s.year BETWEEN 2012 AND 2025 GROUP BY s.year ORDER BY s.year;');
emit('');
emit('-- Count matchups per season');
emit('-- SELECT s.year, count(m.id) as matchups FROM matchups m JOIN rounds r ON m.round_id = r.id JOIN seasons s ON r.season_id = s.id WHERE s.year BETWEEN 2012 AND 2025 GROUP BY s.year ORDER BY s.year;');
emit('');
emit('-- Count picks per season');
emit('-- SELECT s.year, count(p.id) as picks FROM picks p JOIN matchups m ON p.matchup_id = m.id JOIN rounds r ON m.round_id = r.id JOIN seasons s ON r.season_id = s.id WHERE s.year BETWEEN 2012 AND 2025 GROUP BY s.year ORDER BY s.year;');
emit('');
emit('-- Spot check: 2012 Stanley Cup Final (LA Kings beat NJ Devils)');
emit('-- SELECT s.year, th.name as home, ta.name as away, tw.name as winner FROM matchups m JOIN rounds r ON m.round_id = r.id JOIN seasons s ON r.season_id = s.id JOIN teams th ON m.team_home_id = th.id JOIN teams ta ON m.team_away_id = ta.id LEFT JOIN teams tw ON m.winner_id = tw.id WHERE s.year = 2012 AND r.round_number = 4;');

emit('');
emit('COMMIT;');

// Write output
writeFileSync(outputPath, lines.join('\n'), 'utf-8');
console.log(`\n✅ Migration SQL written to: ${outputPath}`);
console.log(`   Total lines: ${lines.length}`);
console.log(`   Seasons: ${years.length}`);
console.log(`   Rounds: ${years.length * 4}`);
console.log(`   Matchup pairs: ${matchupIndex.length}`);
if (usersReady) {
  console.log(`   Picks: included`);
} else {
  console.log(`   Picks: SKIPPED (fill in USER_MAPPING and re-run)`);
}
