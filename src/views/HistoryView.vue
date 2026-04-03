<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { getLogoUrl } from '../lib/logos'
import ZamboniLoader from '../components/ZamboniLoader.vue'

const auth = useAuthStore()

const activeTab = ref('career')
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

// Career stats state
const careerData = ref([])
const careerLoaded = ref(false)
const careerLoading = ref(false)

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
    // Load career stats immediately if that's the active tab
    if (activeTab.value === 'career') {
      loadCareerStats()
    }
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

const isActiveSeason = computed(() => {
  const season = seasons.value.find(s => s.id === selectedSeasonId.value)
  return season?.is_active === true
})

const filteredUsers = computed(() => {
  if (isActiveSeason.value) {
    return users.value.filter(u => u.is_active !== false)
  }
  return users.value
})

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

// Career stats
watch(activeTab, (tab) => {
  if (tab === 'career' && !careerLoaded.value) {
    loadCareerStats()
  }
})

async function loadCareerStats() {
  careerLoading.value = true
  try {
    const { data, error } = await supabase.rpc('get_career_stats')
    if (error) throw error

    careerData.value = (data || []).map(row => ({
      id: row.user_id,
      name: row.display_name || 'Unknown',
      points: Number(row.total_points),
      correct: Number(row.total_correct),
      total: Number(row.total_picks),
      accuracy: Number(row.total_picks) > 0 ? Math.round((Number(row.total_correct) / Number(row.total_picks)) * 100) : null,
      seasons: Number(row.seasons_played),
      roundPerformance: [
        { label: 'R1', correct: Number(row.r1_correct), decided: Number(row.r1_decided) },
        { label: 'R2', correct: Number(row.r2_correct), decided: Number(row.r2_decided) },
        { label: 'CF', correct: Number(row.r3_correct), decided: Number(row.r3_decided) },
        { label: 'SCF', correct: Number(row.r4_correct), decided: Number(row.r4_decided) }
      ],
      seasonRows: (row.season_details || []).map(s => ({
        year: s.year,
        points: Number(s.points),
        correct: Number(s.correct),
        total: Number(s.total),
        accuracy: s.accuracy != null ? Number(s.accuracy) : null
      }))
    }))
    careerLoaded.value = true
  } catch (e) {
    console.error('Career stats fetch error:', e)
  } finally {
    careerLoading.value = false
  }
}

const expandedUser = ref(null)

function toggleExpand(userId) {
  expandedUser.value = expandedUser.value === userId ? null : userId
}
</script>

<template>
  <div class="history-page">
    <h1>History</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'career' }" @click="activeTab = 'career'">Career Stats</button>
      <button class="tab" :class="{ active: activeTab === 'picks' }" @click="activeTab = 'picks'">Pick History</button>
    </div>

    <ZamboniLoader v-if="loading" />

    <!-- Pick History Tab -->
    <template v-if="!loading && activeTab === 'picks'">
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
            <option v-for="u in filteredUsers" :key="u.id" :value="u.id">
              {{ u.display_name || 'Unknown' }}
            </option>
          </select>
        </div>
        <div class="selector">
          <label>Compare with</label>
          <select v-model="selectedUser2">
            <option :value="null">— None —</option>
            <option v-for="u in filteredUsers" :key="u.id" :value="u.id" :disabled="u.id === selectedUser1">
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

      <ZamboniLoader v-if="loadingPicks" message="Loading picks..." />

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

    <!-- Career Stats Tab -->
    <template v-if="!loading && activeTab === 'career'">
      <ZamboniLoader v-if="careerLoading" message="Loading career stats..." />

      <template v-else-if="careerData.length > 0">
        <div class="table-scroll">
        <table class="career-table">
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th>Player</th>
              <th class="num-col">Points</th>
              <th class="num-col">Correct</th>
              <th class="num-col">Picks</th>
              <th class="num-col">Acc</th>
              <th class="num-col">Seasons</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(entry, idx) in careerData" :key="entry.id">
              <tr class="career-row" :class="{ 'top-3': idx < 3, expanded: expandedUser === entry.id }" @click="toggleExpand(entry.id)">
                <td class="rank-col">
                  <span v-if="idx === 0" class="medal gold">1</span>
                  <span v-else-if="idx === 1" class="medal silver">2</span>
                  <span v-else-if="idx === 2" class="medal bronze">3</span>
                  <span v-else>{{ idx + 1 }}</span>
                </td>
                <td class="player-name">
                  {{ entry.name }}
                  <span class="expand-icon">{{ expandedUser === entry.id ? '&#9650;' : '&#9660;' }}</span>
                </td>
                <td class="num-col points">{{ entry.points }}</td>
                <td class="num-col correct">{{ entry.correct }}</td>
                <td class="num-col">{{ entry.total }}</td>
                <td class="num-col">{{ entry.accuracy != null ? entry.accuracy + '%' : '—' }}</td>
                <td class="num-col">{{ entry.seasons }}</td>
              </tr>

              <!-- Expanded detail -->
              <tr v-if="expandedUser === entry.id" class="detail-row">
                <td colspan="7">
                  <div class="detail-content">
                    <!-- Round Performance -->
                    <div class="detail-section">
                      <h3>Round Performance</h3>
                      <div class="round-bars">
                        <div v-for="round in entry.roundPerformance" :key="round.label" class="round-bar-row">
                          <span class="round-bar-label">{{ round.label }}</span>
                          <div class="round-bar-track">
                            <div
                              class="round-bar-fill"
                              :style="{ width: round.decided > 0 ? (round.correct / round.decided * 100) + '%' : '0%' }"
                            ></div>
                          </div>
                          <span class="round-bar-pct">
                            {{ round.decided > 0 ? Math.round(round.correct / round.decided * 100) + '%' : '—' }}
                          </span>
                          <span class="round-bar-count">{{ round.correct }}/{{ round.decided }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Season History -->
                    <div class="detail-section">
                      <h3>Season History</h3>
                      <div class="season-history">
                        <div class="sh-row sh-header">
                          <span class="sh-year">Year</span>
                          <span class="sh-val">Pts</span>
                          <span class="sh-val">Correct</span>
                          <span class="sh-val">Picks</span>
                          <span class="sh-val">Acc</span>
                        </div>
                        <div v-for="s in entry.seasonRows" :key="s.year" class="sh-row">
                          <span class="sh-year">{{ s.year }}</span>
                          <span class="sh-val">{{ s.points }}</span>
                          <span class="sh-val">{{ s.correct }}</span>
                          <span class="sh-val">{{ s.total }}</span>
                          <span class="sh-val">{{ s.accuracy != null ? s.accuracy + '%' : '—' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        </div>
      </template>

      <div v-else class="empty-state">
        No career data available yet.
      </div>
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
  margin-bottom: 16px;
  color: var(--text-primary);
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 10px 24px;
  background: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
  margin-bottom: -1px;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
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

/* Career Stats Table */
.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.career-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.career-table thead {
  background: var(--bg-secondary);
}

.career-table th {
  padding: 12px 16px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: left;
}

.career-table td {
  padding: 14px 16px;
  font-size: 0.95rem;
  color: var(--text-primary);
  border-top: 1px solid var(--border);
}

.career-row {
  cursor: pointer;
  transition: background 0.15s;
}

.career-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.career-row.expanded {
  background: rgba(201, 168, 76, 0.03);
}

.rank-col {
  width: 50px;
  text-align: center;
}

.num-col {
  width: 80px;
  text-align: center;
}

.player-name {
  font-weight: 600;
}

.expand-icon {
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-left: 6px;
}

.points {
  color: var(--accent);
  font-weight: 800;
  font-size: 1.05rem;
}

.correct {
  color: var(--success);
  font-weight: 700;
}

.medal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.85rem;
}

.gold { background: #c9a84c; color: #1a1a2e; }
.silver { background: #a0a0b0; color: #1a1a2e; }
.bronze { background: #cd7f32; color: #1a1a2e; }

.top-3 td {
  background: rgba(201, 168, 76, 0.05);
}

/* Detail row */
.detail-row td {
  padding: 0;
  border-top: none;
}

.detail-content {
  padding: 16px 20px 20px;
  background: var(--bg-secondary);
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.detail-section {
  flex: 1;
  min-width: 200px;
}

.detail-section h3 {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

/* Round bars (reused from ProfileView) */
.round-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.round-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.round-bar-label {
  width: 36px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.round-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
}

.round-bar-fill {
  height: 100%;
  background: var(--success);
  border-radius: 3px;
  transition: width 0.3s;
}

.round-bar-pct {
  width: 32px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
  flex-shrink: 0;
}

.round-bar-count {
  width: 32px;
  font-size: 0.65rem;
  color: var(--text-muted);
  text-align: right;
  flex-shrink: 0;
}

/* Season history */
.season-history {
  font-size: 0.8rem;
}

.sh-row {
  display: flex;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.sh-row.sh-header {
  font-weight: 700;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

.sh-year {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
}

.sh-header .sh-year {
  color: var(--text-muted);
}

.sh-val {
  width: 48px;
  text-align: center;
  color: var(--text-secondary);
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
  .career-table th,
  .career-table td {
    padding: 10px 8px;
    font-size: 0.85rem;
  }
  .num-col {
    width: 55px;
  }
  .detail-content {
    flex-direction: column;
    gap: 20px;
  }
}
</style>
