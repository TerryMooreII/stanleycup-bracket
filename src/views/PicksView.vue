<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { getLogoUrl } from '../lib/logos'

const route = useRoute()
const selectedRound = ref(1)
const rounds = ref([])
const matchups = ref([])
const allPicks = ref([])
const users = ref([])
const loading = ref(true)

async function loadData() {
  loading.value = true
  try {
    const year = Number(route.params.year)
    let seasonId
    if (year) {
      const res = await supabase.from('seasons').select('*').eq('year', year).single()
      seasonId = res.data?.id
    } else {
      const res = await supabase.from('seasons').select('*').eq('is_active', true).single()
      seasonId = res.data?.id
    }

    const [roundsRes, profilesRes] = await Promise.all([
      supabase.from('rounds').select('*').eq('season_id', seasonId).order('round_number'),
      supabase.from('profiles').select('*')
    ])
    rounds.value = roundsRes.data || []
    users.value = profilesRes.data || []

    const roundIds = rounds.value.map(r => r.id)
    const matchupsRes = await supabase
      .from('matchups')
      .select('*, team_home:teams!matchups_team_home_id_fkey(*), team_away:teams!matchups_team_away_id_fkey(*)')
      .in('round_id', roundIds)
      .order('bracket_position')
    matchups.value = matchupsRes.data || []

    const matchupIds = matchups.value.map(m => m.id)
    if (matchupIds.length > 0) {
      const picksRes = await supabase.from('picks').select('*').in('matchup_id', matchupIds)
      allPicks.value = picksRes.data || []
    }

    // Default to first active or locked round
    const lockedRound = rounds.value.find(r => r.pick_deadline && new Date(r.pick_deadline) < new Date())
    if (lockedRound) selectedRound.value = lockedRound.round_number
    else selectedRound.value = 1
  } catch (e) {
    console.error('Picks fetch error:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(() => route.params.year, loadData)

const currentRound = computed(() => rounds.value.find(r => r.round_number === selectedRound.value))

const isLocked = computed(() => {
  if (!currentRound.value?.pick_deadline) return false
  return new Date(currentRound.value.pick_deadline) < new Date()
})

const roundMatchups = computed(() => {
  if (!currentRound.value) return []
  return matchups.value.filter(m => m.round_id === currentRound.value.id)
})

const westernMatchups = computed(() => roundMatchups.value.filter(m => m.conference === 'Western'))
const easternMatchups = computed(() => roundMatchups.value.filter(m => m.conference === 'Eastern'))

function getPicksForMatchup(matchupId) {
  return allPicks.value.filter(p => p.matchup_id === matchupId)
}

function getUsersForTeam(matchupId, teamId) {
  const picks = getPicksForMatchup(matchupId).filter(p => p.team_id === teamId)
  return picks.map(p => {
    const user = users.value.find(u => u.id === p.user_id)
    return user?.display_name || 'Unknown'
  }).sort()
}


function getRoundLabel(num) {
  if (num === 1) return 'R1'
  if (num === 2) return 'R2'
  if (num === 3) return 'CF'
  if (num === 4) return 'Final'
  return ''
}
</script>

<template>
  <div class="picks-page">
    <h1>All Picks</h1>

    <div v-if="loading" class="loading">Loading...</div>

    <template v-else>
      <!-- Round selector -->
      <div class="round-selector">
        <button
          v-for="r in [1, 2, 3, 4]"
          :key="r"
          :class="{ active: selectedRound === r }"
          @click="selectedRound = r"
        >
          {{ getRoundLabel(r) }}
        </button>
      </div>

      <!-- Locked message -->
      <div v-if="!isLocked" class="locked-message">
        <div class="lock-icon">&#128274;</div>
        <p>Picks will be revealed after the deadline passes.</p>
        <p v-if="currentRound?.pick_deadline" class="deadline-info">
          Deadline: {{ new Date(currentRound.pick_deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) }}
        </p>
        <p v-else class="deadline-info">No deadline set for this round yet.</p>
      </div>

      <!-- Picks by matchup -->
      <template v-else>
        <div v-if="roundMatchups.length === 0" class="empty-state">
          No matchups for this round yet.
        </div>

        <template v-if="westernMatchups.length > 0">
          <h2 class="conf-heading">Western Conference</h2>
          <div class="matchup-picks-grid">
            <div v-for="matchup in westernMatchups" :key="matchup.id" class="matchup-picks-card">
              <div class="matchup-header">
                <div class="matchup-team">
                  <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-name">{{ matchup.team_home.abbreviation }}</span>
                </div>
                <span class="vs">vs</span>
                <div class="matchup-team">
                  <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-name">{{ matchup.team_away.abbreviation }}</span>
                </div>
              </div>
              <div class="picks-body">
                <div class="team-picks">
                  <div class="team-picks-header">
                    <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="mini-logo" @error="$event.target.style.display='none'" />
                    <span>{{ matchup.team_home.abbreviation }}</span>
                    <span class="pick-count">({{ getUsersForTeam(matchup.id, matchup.team_home_id).length }})</span>
                  </div>
                  <div class="user-list">
                    <span v-for="name in getUsersForTeam(matchup.id, matchup.team_home_id)" :key="name" class="user-chip">{{ name }}</span>
                    <span v-if="getUsersForTeam(matchup.id, matchup.team_home_id).length === 0" class="no-picks">No picks</span>
                  </div>
                </div>
                <div class="team-picks">
                  <div class="team-picks-header">
                    <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="mini-logo" @error="$event.target.style.display='none'" />
                    <span>{{ matchup.team_away.abbreviation }}</span>
                    <span class="pick-count">({{ getUsersForTeam(matchup.id, matchup.team_away_id).length }})</span>
                  </div>
                  <div class="user-list">
                    <span v-for="name in getUsersForTeam(matchup.id, matchup.team_away_id)" :key="name" class="user-chip">{{ name }}</span>
                    <span v-if="getUsersForTeam(matchup.id, matchup.team_away_id).length === 0" class="no-picks">No picks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-if="easternMatchups.length > 0">
          <h2 class="conf-heading">Eastern Conference</h2>
          <div class="matchup-picks-grid">
            <div v-for="matchup in easternMatchups" :key="matchup.id" class="matchup-picks-card">
              <div class="matchup-header">
                <div class="matchup-team">
                  <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-name">{{ matchup.team_home.abbreviation }}</span>
                </div>
                <span class="vs">vs</span>
                <div class="matchup-team">
                  <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-name">{{ matchup.team_away.abbreviation }}</span>
                </div>
              </div>
              <div class="picks-body">
                <div class="team-picks">
                  <div class="team-picks-header">
                    <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="mini-logo" @error="$event.target.style.display='none'" />
                    <span>{{ matchup.team_home.abbreviation }}</span>
                    <span class="pick-count">({{ getUsersForTeam(matchup.id, matchup.team_home_id).length }})</span>
                  </div>
                  <div class="user-list">
                    <span v-for="name in getUsersForTeam(matchup.id, matchup.team_home_id)" :key="name" class="user-chip">{{ name }}</span>
                    <span v-if="getUsersForTeam(matchup.id, matchup.team_home_id).length === 0" class="no-picks">No picks</span>
                  </div>
                </div>
                <div class="team-picks">
                  <div class="team-picks-header">
                    <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="mini-logo" @error="$event.target.style.display='none'" />
                    <span>{{ matchup.team_away.abbreviation }}</span>
                    <span class="pick-count">({{ getUsersForTeam(matchup.id, matchup.team_away_id).length }})</span>
                  </div>
                  <div class="user-list">
                    <span v-for="name in getUsersForTeam(matchup.id, matchup.team_away_id)" :key="name" class="user-chip">{{ name }}</span>
                    <span v-if="getUsersForTeam(matchup.id, matchup.team_away_id).length === 0" class="no-picks">No picks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Final round (no conference split) -->
        <template v-if="selectedRound === 4 && roundMatchups.length > 0 && westernMatchups.length === 0 && easternMatchups.length === 0">
          <div class="matchup-picks-grid">
            <div v-for="matchup in roundMatchups" :key="matchup.id" class="matchup-picks-card">
              <div class="matchup-header">
                <div class="matchup-team">
                  <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-name">{{ matchup.team_home.abbreviation }}</span>
                </div>
                <span class="vs">vs</span>
                <div class="matchup-team">
                  <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="team-logo" @error="$event.target.style.display='none'" />
                  <span class="team-name">{{ matchup.team_away.abbreviation }}</span>
                </div>
              </div>
              <div class="picks-body">
                <div class="team-picks">
                  <div class="team-picks-header">
                    <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="mini-logo" @error="$event.target.style.display='none'" />
                    <span>{{ matchup.team_home.abbreviation }}</span>
                    <span class="pick-count">({{ getUsersForTeam(matchup.id, matchup.team_home_id).length }})</span>
                  </div>
                  <div class="user-list">
                    <span v-for="name in getUsersForTeam(matchup.id, matchup.team_home_id)" :key="name" class="user-chip">{{ name }}</span>
                    <span v-if="getUsersForTeam(matchup.id, matchup.team_home_id).length === 0" class="no-picks">No picks</span>
                  </div>
                </div>
                <div class="team-picks">
                  <div class="team-picks-header">
                    <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="mini-logo" @error="$event.target.style.display='none'" />
                    <span>{{ matchup.team_away.abbreviation }}</span>
                    <span class="pick-count">({{ getUsersForTeam(matchup.id, matchup.team_away_id).length }})</span>
                  </div>
                  <div class="user-list">
                    <span v-for="name in getUsersForTeam(matchup.id, matchup.team_away_id)" :key="name" class="user-chip">{{ name }}</span>
                    <span v-if="getUsersForTeam(matchup.id, matchup.team_away_id).length === 0" class="no-picks">No picks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.picks-page {
  max-width: 900px;
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

/* Round selector */
.round-selector {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
}

.round-selector button {
  padding: 10px 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}

.round-selector button:first-child {
  border-radius: 8px 0 0 8px;
}

.round-selector button:last-child {
  border-radius: 0 8px 8px 0;
}

.round-selector button:not(:last-child) {
  border-right: none;
}

.round-selector button.active {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

/* Locked message */
.locked-message {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.lock-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.5;
}

.locked-message p {
  margin-bottom: 8px;
  font-size: 1rem;
}

.deadline-info {
  color: var(--text-muted);
  font-size: 0.9rem !important;
}

/* Conference heading */
.conf-heading {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 20px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

/* Matchup picks grid */
.matchup-picks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.matchup-picks-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.matchup-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.matchup-team {
  display: flex;
  align-items: center;
  gap: 10px;
}

.team-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.team-name {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.vs {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
}

.picks-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.team-picks-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.mini-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.pick-count {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 0.8rem;
}

.user-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 26px;
}

.user-chip {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.no-picks {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-style: italic;
}

@media (max-width: 500px) {
  .matchup-picks-grid {
    grid-template-columns: 1fr;
  }
  .matchup-header {
    padding: 12px 14px;
    gap: 10px;
  }
  .team-logo {
    width: 28px;
    height: 28px;
  }
  .picks-body {
    padding: 12px 14px;
  }
}
</style>
