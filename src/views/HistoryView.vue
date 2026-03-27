<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { getLogoUrl } from '../lib/logos'

const auth = useAuthStore()

const seasons = ref([])
const users = ref([])
const selectedSeasonId = ref(null)
const selectedUser1 = ref(null)
const selectedUser2 = ref(null)
const rounds = ref([])
const matchups = ref([])
const user1Picks = ref([])
const user2Picks = ref([])
const loading = ref(true)
const loadingPicks = ref(false)

onMounted(async () => {
  try {
    const [seasonsRes, usersRes] = await Promise.all([
      supabase.from('seasons').select('*').order('year', { ascending: false }),
      supabase.from('profiles').select('*').order('display_name')
    ])
    seasons.value = seasonsRes.data || []
    users.value = usersRes.data || []

    // Default: active season, current user
    const activeSeason = seasons.value.find(s => s.is_active)
    if (activeSeason) selectedSeasonId.value = activeSeason.id
    if (auth.user) selectedUser1.value = auth.user.id
  } catch (e) {
    console.error('History fetch error:', e)
  } finally {
    loading.value = false
  }
})

watch([selectedSeasonId, selectedUser1, selectedUser2], async () => {
  if (!selectedSeasonId.value) return
  loadingPicks.value = true
  try {
    // Fetch rounds and matchups for season
    const [roundsRes, matchupsRes] = await Promise.all([
      supabase.from('rounds').select('*').eq('season_id', selectedSeasonId.value).order('round_number'),
      supabase.from('matchups')
        .select('*, team_home:teams!matchups_team_home_id_fkey(*), team_away:teams!matchups_team_away_id_fkey(*), winner:teams!matchups_winner_id_fkey(*)')
        .in('round_id', (await supabase.from('rounds').select('id').eq('season_id', selectedSeasonId.value)).data?.map(r => r.id) || [])
        .order('bracket_position')
    ])
    rounds.value = roundsRes.data || []
    matchups.value = matchupsRes.data || []

    const matchupIds = matchups.value.map(m => m.id)
    if (matchupIds.length === 0) {
      user1Picks.value = []
      user2Picks.value = []
      return
    }

    // Fetch picks for selected users
    const promises = []
    if (selectedUser1.value) {
      promises.push(
        supabase.from('picks').select('*').eq('user_id', selectedUser1.value).in('matchup_id', matchupIds)
          .then(res => { user1Picks.value = res.data || [] })
      )
    } else {
      user1Picks.value = []
    }
    if (selectedUser2.value) {
      promises.push(
        supabase.from('picks').select('*').eq('user_id', selectedUser2.value).in('matchup_id', matchupIds)
          .then(res => { user2Picks.value = res.data || [] })
      )
    } else {
      user2Picks.value = []
    }
    await Promise.all(promises)
  } catch (e) {
    console.error('History picks fetch error:', e)
  } finally {
    loadingPicks.value = false
  }
}, { immediate: true })

const comparing = computed(() => !!selectedUser2.value)

function getUserName(userId) {
  return users.value.find(u => u.id === userId)?.display_name || 'Unknown'
}

function getPickForMatchup(picks, matchupId) {
  return picks.find(p => p.matchup_id === matchupId)
}

function getPickStatus(pick, matchup) {
  if (!pick) return 'none'
  if (!matchup.winner_id) return 'pending'
  return pick.team_id === matchup.winner_id ? 'correct' : 'wrong'
}

function getPickTeam(pick, matchup) {
  if (!pick) return null
  if (pick.team_id === matchup.team_home_id) return matchup.team_home
  if (pick.team_id === matchup.team_away_id) return matchup.team_away
  return null
}


function getMatchupsForRound(roundId) {
  return matchups.value.filter(m => m.round_id === roundId)
}

function calcStats(picks) {
  let correct = 0, wrong = 0, pending = 0
  const roundPointsMap = {}
  rounds.value.forEach(r => { roundPointsMap[r.id] = r.points_per_correct ?? 1 })

  let points = 0
  picks.forEach(p => {
    const m = matchups.value.find(m => m.id === p.matchup_id)
    if (!m) return
    if (!m.winner_id) { pending++; return }
    if (p.team_id === m.winner_id) {
      correct++
      points += roundPointsMap[m.round_id] || 1
    } else {
      wrong++
    }
  })
  return { correct, wrong, pending, points, total: picks.length }
}

const user1Stats = computed(() => calcStats(user1Picks.value))
const user2Stats = computed(() => calcStats(user2Picks.value))
</script>

<template>
  <div class="history-page">
    <h1>Pick History</h1>

    <div v-if="loading" class="loading">Loading...</div>

    <template v-else>
      <!-- Selectors -->
      <div class="selectors">
        <div class="selector">
          <label>Season</label>
          <select v-model="selectedSeasonId">
            <option v-for="s in seasons" :key="s.id" :value="s.id">
              {{ s.year }}{{ s.is_active ? ' (Current)' : '' }}
            </option>
          </select>
        </div>
        <div class="selector">
          <label>Player 1</label>
          <select v-model="selectedUser1">
            <option :value="null">Select player...</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.display_name || 'Unknown' }}
            </option>
          </select>
        </div>
        <div class="selector">
          <label>Compare with</label>
          <select v-model="selectedUser2">
            <option :value="null">— None —</option>
            <option v-for="u in users" :key="u.id" :value="u.id" :disabled="u.id === selectedUser1">
              {{ u.display_name || 'Unknown' }}
            </option>
          </select>
        </div>
      </div>

      <!-- Stats summary -->
      <div v-if="selectedUser1 && !loadingPicks" class="stats-bar">
        <div class="user-stats">
          <span class="stats-name">{{ getUserName(selectedUser1) }}</span>
          <span class="stats-detail">{{ user1Stats.points }} pts &middot; {{ user1Stats.correct }}W {{ user1Stats.wrong }}L {{ user1Stats.pending }}P</span>
        </div>
        <div v-if="comparing" class="user-stats right">
          <span class="stats-name">{{ getUserName(selectedUser2) }}</span>
          <span class="stats-detail">{{ user2Stats.points }} pts &middot; {{ user2Stats.correct }}W {{ user2Stats.wrong }}L {{ user2Stats.pending }}P</span>
        </div>
      </div>

      <div v-if="loadingPicks" class="loading">Loading picks...</div>

      <!-- Rounds -->
      <template v-else>
        <div v-for="round in rounds" :key="round.id" class="round-section">
          <h2 class="round-title">{{ round.name }}</h2>

          <div class="matchup-list">
            <div v-for="matchup in getMatchupsForRound(round.id)" :key="matchup.id" class="history-matchup">
              <!-- Matchup header -->
              <div class="matchup-header">
                <div class="team-side">
                  <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-abbr">{{ matchup.team_home.abbreviation }}</span>
                </div>
                <span class="vs">vs</span>
                <div class="team-side">
                  <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-abbr">{{ matchup.team_away.abbreviation }}</span>
                </div>
                <div v-if="matchup.winner" class="winner-badge">
                  {{ matchup.winner.abbreviation }} won
                </div>
              </div>

              <!-- Picks comparison -->
              <div class="picks-row">
                <div v-if="selectedUser1" :class="['pick-cell', getPickStatus(getPickForMatchup(user1Picks, matchup.id), matchup)]">
                  <template v-if="getPickTeam(getPickForMatchup(user1Picks, matchup.id), matchup)">
                    <img :src="getLogoUrl(getPickTeam(getPickForMatchup(user1Picks, matchup.id), matchup).abbreviation)" class="pick-logo" @error="$event.target.style.display='none'" />
                    <span>{{ getPickTeam(getPickForMatchup(user1Picks, matchup.id), matchup).abbreviation }}</span>
                  </template>
                  <span v-else class="no-pick">No pick</span>
                </div>

                <div v-if="comparing" :class="['pick-cell', getPickStatus(getPickForMatchup(user2Picks, matchup.id), matchup)]">
                  <template v-if="getPickTeam(getPickForMatchup(user2Picks, matchup.id), matchup)">
                    <img :src="getLogoUrl(getPickTeam(getPickForMatchup(user2Picks, matchup.id), matchup).abbreviation)" class="pick-logo" @error="$event.target.style.display='none'" />
                    <span>{{ getPickTeam(getPickForMatchup(user2Picks, matchup.id), matchup).abbreviation }}</span>
                  </template>
                  <span v-else class="no-pick">No pick</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="matchups.length === 0" class="empty-state">
          No matchups for this season yet.
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.history-page {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 1.6rem;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.loading, .empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

/* Selectors */
.selectors {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.selector {
  flex: 1;
  min-width: 160px;
}

.selector label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.selector select {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

/* Stats bar */
.stats-bar {
  display: flex;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 20px;
  margin-bottom: 24px;
  gap: 20px;
}

.user-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-stats.right {
  text-align: right;
}

.stats-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.stats-detail {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Round sections */
.round-section {
  margin-bottom: 24px;
}

.round-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}

.matchup-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-matchup {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.matchup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.team-side {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.team-abbr {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.vs {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.winner-badge {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--success);
  background: rgba(76, 175, 80, 0.1);
  padding: 3px 10px;
  border-radius: 20px;
}

/* Picks row */
.picks-row {
  display: flex;
  gap: 1px;
}

.pick-cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.pick-cell.correct {
  background: rgba(76, 175, 80, 0.12);
  color: var(--success);
}

.pick-cell.wrong {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger);
}

.pick-cell.pending {
  background: transparent;
}

.pick-cell.none {
  background: transparent;
}

.pick-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.no-pick {
  color: var(--text-muted);
  font-weight: 400;
  font-style: italic;
  font-size: 0.85rem;
}

@media (max-width: 500px) {
  .selectors {
    flex-direction: column;
  }
  .matchup-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  .stats-bar {
    flex-direction: column;
    gap: 10px;
  }
  .user-stats.right {
    text-align: left;
  }
}
</style>
