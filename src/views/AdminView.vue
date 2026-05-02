<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useBracketStore } from '../stores/bracket'
import { nhlUrl } from '../lib/nhlApi'
import { getLogoUrl } from '../lib/logos'
import { supabase } from '../lib/supabase'
import ZamboniLoader from '../components/ui/ZamboniLoader.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseTabs from '../components/ui/BaseTabs.vue'
import BaseCard from '../components/ui/BaseCard.vue'
import BaseButtonGroup from '../components/ui/BaseButtonGroup.vue'

const roundOptions = [
  { value: 1, label: 'R1' },
  { value: 2, label: 'R2' },
  { value: 3, label: 'CF' },
  { value: 4, label: 'Final' },
]
const conferenceOptions = [
  { value: 'Western', label: 'Western' },
  { value: 'Eastern', label: 'Eastern' },
]

const adminTabs = [
  { key: 'bracket', label: 'Bracket' },
  { key: 'users', label: 'Users' },
  { key: 'pick-status', label: 'Pick Status' }
]

const auth = useAuthStore()
const bracket = useBracketStore()

const activeTab = ref('bracket')
const allUsers = ref([])
const usersLoading = ref(false)

const selectedRound = ref(1)
const selectedConference = ref('Western')
const showAddMatchup = ref(false)
const editingDeadline = ref(null)
const editingPoints = ref(false)
const pointsInput = ref(1)
const showNewSeason = ref(false)
const newSeasonYear = ref(new Date().getFullYear())
const creatingSeason = ref(false)
const editingMatchupId = ref(null)
const editForm = ref({ team_home_id: null, team_away_id: null, seed_home: '', seed_away: '', bracket_position: 1 })
const importingFromNHL = ref(false)
const importError = ref('')
const selectedSeasonYear = ref(null)

async function handleImportFromNHL() {
  if (!bracket.season?.year || !currentRound.value) return

  // Check if matchups already exist for this round/conference
  const existing = currentMatchups.value
  if (existing.length > 0) {
    if (!confirm(`${existing.length} matchup(s) already exist for this round/conference. Import will add new matchups alongside them. Continue?`)) {
      return
    }
  }

  importingFromNHL.value = true
  importError.value = ''

  try {
    const year = bracket.season.year
    const seasonId = `${year - 1}${year}`
    const res = await fetch(nhlUrl(`/v1/playoff-series/carousel/${seasonId}`))
    if (!res.ok) throw new Error('Failed to fetch NHL playoff data')
    const data = await res.json()

    const nhlRound = (data.rounds || []).find(r => r.roundNumber === selectedRound.value)
    if (!nhlRound || !nhlRound.series || nhlRound.series.length === 0) {
      importError.value = 'NHL bracket not available yet for this round.'
      return
    }

    // Filter by conference (Round 4 / SCF has no conference split)
    let seriesToImport = nhlRound.series
    if (selectedRound.value < 4) {
      seriesToImport = seriesToImport.filter(s => {
        const conf = s.topSeed?.conferenceName || s.conference || ''
        return conf === selectedConference.value
      })
    }

    if (seriesToImport.length === 0) {
      importError.value = 'No matchups found for this conference/round.'
      return
    }

    const unmatchedTeams = []
    let position = existing.length + 1

    for (const series of seriesToImport) {
      const topAbbrev = series.topSeed?.abbrev
      const bottomAbbrev = series.bottomSeed?.abbrev
      if (!topAbbrev || !bottomAbbrev) continue

      const homeTeam = bracket.teams.find(t => t.abbreviation === topAbbrev)
      const awayTeam = bracket.teams.find(t => t.abbreviation === bottomAbbrev)

      if (!homeTeam) unmatchedTeams.push(topAbbrev)
      if (!awayTeam) unmatchedTeams.push(bottomAbbrev)
      if (!homeTeam || !awayTeam) continue

      const seedHome = series.topSeedRank != null ? String(series.topSeedRank) : ''
      const seedAway = series.bottomSeedRank != null ? String(series.bottomSeedRank) : ''

      await bracket.createMatchup({
        round_id: currentRound.value.id,
        team_home_id: homeTeam.id,
        team_away_id: awayTeam.id,
        seed_home: seedHome || null,
        seed_away: seedAway || null,
        bracket_position: position++,
        conference: selectedRound.value < 4 ? selectedConference.value : 'Western'
      })
    }

    if (unmatchedTeams.length > 0) {
      importError.value = `Imported but could not match teams: ${[...new Set(unmatchedTeams)].join(', ')}. Add them to the teams table.`
    }
  } catch (e) {
    importError.value = e.message || 'Failed to import from NHL'
  } finally {
    importingFromNHL.value = false
  }
}

function startEdit(matchup) {
  editingMatchupId.value = matchup.id
  editForm.value = {
    team_home_id: matchup.team_home_id,
    team_away_id: matchup.team_away_id,
    seed_home: matchup.seed_home || '',
    seed_away: matchup.seed_away || '',
    bracket_position: matchup.bracket_position
  }
}

function cancelEdit() {
  editingMatchupId.value = null
}

async function saveEdit(matchupId) {
  try {
    await bracket.updateMatchup(matchupId, {
      team_home_id: editForm.value.team_home_id,
      team_away_id: editForm.value.team_away_id,
      seed_home: editForm.value.seed_home || null,
      seed_away: editForm.value.seed_away || null,
      bracket_position: editForm.value.bracket_position
    })
    editingMatchupId.value = null
  } catch (e) {
    alert(e.message)
  }
}

async function handleCreateSeason() {
  if (!newSeasonYear.value) return
  creatingSeason.value = true
  try {
    await bracket.createSeason(newSeasonYear.value)
    showNewSeason.value = false
  } catch (e) {
    alert(e.message)
  } finally {
    creatingSeason.value = false
  }
}

// Drag and drop reorder
const dragIndex = ref(null)
const dragOverIndex = ref(null)

function onDragStart(idx) {
  dragIndex.value = idx
}

function onDragOver(e, idx) {
  e.preventDefault()
  dragOverIndex.value = idx
}

function onDragLeave() {
  dragOverIndex.value = null
}

async function onDrop(idx) {
  const from = dragIndex.value
  const to = idx
  dragIndex.value = null
  dragOverIndex.value = null
  if (from === null || from === to) return

  // Reorder the current matchups
  const ordered = [...currentMatchups.value]
  const [moved] = ordered.splice(from, 1)
  ordered.splice(to, 0, moved)

  // Update bracket_position for each
  const updates = ordered.map((m, i) =>
    bracket.updateMatchup(m.id, { bracket_position: i + 1 })
  )
  await Promise.all(updates)
  await bracket.fetchMatchups()
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

// New matchup form
const newMatchup = ref({
  team_home_id: null,
  team_away_id: null,
  seed_home: '',
  seed_away: '',
  bracket_position: 1
})

async function fetchUsers() {
  usersLoading.value = true
  try {
    const { data } = await supabase.from('profiles').select('*').order('display_name')
    allUsers.value = data || []
  } catch (e) {
    console.error('Failed to fetch users:', e)
  } finally {
    usersLoading.value = false
  }
}

const pickStatusLoading = ref(false)
const allPicksForRound = ref([])

const activeRoundForStatus = computed(() => bracket.getActiveRound() || null)

const matchupsForActiveRound = computed(() => {
  const r = activeRoundForStatus.value
  if (!r) return []
  return bracket.matchups.filter(m => m.round_id === r.id)
})

const requiredCount = computed(() => matchupsForActiveRound.value.length)

const pickStatusRows = computed(() => {
  const required = requiredCount.value
  const activeUsers = allUsers.value.filter(u => u.is_active !== false)
  const rows = activeUsers.map(user => {
    const pickCount = allPicksForRound.value.filter(p => p.user_id === user.id).length
    return {
      user,
      pickCount,
      required,
      complete: required > 0 && pickCount >= required
    }
  })
  rows.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? 1 : -1
    return (a.user.display_name || '').localeCompare(b.user.display_name || '')
  })
  return rows
})

async function loadPickStatus() {
  const round = activeRoundForStatus.value
  if (!round) {
    allPicksForRound.value = []
    return
  }
  const matchupIds = matchupsForActiveRound.value.map(m => m.id)
  if (matchupIds.length === 0) {
    allPicksForRound.value = []
    return
  }
  pickStatusLoading.value = true
  try {
    allPicksForRound.value = await bracket.fetchAllPicksForMatchups(matchupIds)
  } catch (e) {
    console.error('Failed to load pick status:', e)
    allPicksForRound.value = []
  } finally {
    pickStatusLoading.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'pick-status') loadPickStatus()
})

async function toggleUserActive(user) {
  const newVal = !user.is_active
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: newVal })
    .eq('id', user.id)
  if (error) {
    alert('Error updating user: ' + error.message)
    return
  }
  user.is_active = newVal
}

async function onSeasonChange(year) {
  selectedRound.value = 1
  selectedConference.value = 'Western'
  await bracket.fetchAll(auth.user?.id, year)
}

onMounted(async () => {
  await Promise.all([
    bracket.fetchAll(auth.user?.id),
    fetchUsers()
  ])
  selectedSeasonYear.value = bracket.season?.year
  await loadPickStatus()
})

const currentRound = computed(() => {
  return bracket.rounds.find(r => r.round_number === selectedRound.value)
})

const conferenceTeams = computed(() => {
  if (selectedRound.value === 4) return bracket.teams
  return bracket.teams.filter(t => t.conference === selectedConference.value)
})

const currentMatchups = computed(() => {
  if (!currentRound.value) return []
  if (selectedRound.value === 4) {
    return bracket.matchups.filter(m => m.round_id === currentRound.value.id)
  }
  return bracket.getMatchupsForRound(currentRound.value.id, selectedConference.value)
})

const deadlineInput = ref('')

function startEditDeadline() {
  const round = currentRound.value
  if (round?.pick_deadline) {
    const d = new Date(round.pick_deadline)
    deadlineInput.value = d.toISOString().slice(0, 16)
  } else {
    deadlineInput.value = ''
  }
  editingDeadline.value = true
}

async function saveDeadline() {
  if (!currentRound.value) return
  const deadline = deadlineInput.value ? new Date(deadlineInput.value).toISOString() : null
  await bracket.updateRound(currentRound.value.id, { pick_deadline: deadline })
  editingDeadline.value = false
}

function startEditPoints() {
  pointsInput.value = currentRound.value?.points_per_correct ?? 1
  editingPoints.value = true
}

async function savePoints() {
  if (!currentRound.value) return
  await bracket.updateRound(currentRound.value.id, { points_per_correct: parseInt(pointsInput.value) || 1 })
  editingPoints.value = false
}

async function toggleRoundActive() {
  if (!currentRound.value) return
  await bracket.updateRound(currentRound.value.id, { is_active: !currentRound.value.is_active })
}

async function addMatchup() {
  if (!currentRound.value || !newMatchup.value.team_home_id || !newMatchup.value.team_away_id) return
  try {
    await bracket.createMatchup({
      round_id: currentRound.value.id,
      team_home_id: newMatchup.value.team_home_id,
      team_away_id: newMatchup.value.team_away_id,
      seed_home: newMatchup.value.seed_home || null,
      seed_away: newMatchup.value.seed_away || null,
      bracket_position: newMatchup.value.bracket_position,
      conference: selectedConference.value
    })
    showAddMatchup.value = false
    newMatchup.value = { team_home_id: null, team_away_id: null, seed_home: '', seed_away: '', bracket_position: 1 }
  } catch (e) {
    alert(e.message)
  }
}

async function toggleMatchupLock(matchup) {
  await bracket.updateMatchup(matchup.id, { is_locked: !matchup.is_locked })
}

async function setWinner(matchup, teamId) {
  const newWinner = matchup.winner_id === teamId ? null : teamId
  await bracket.updateMatchup(matchup.id, { winner_id: newWinner })
}

async function updateActualGoals(matchup, value) {
  const goals = parseInt(value) || null
  await bracket.updateMatchup(matchup.id, { actual_total_goals: goals })
}

async function updateSeriesWins(matchup, field, value) {
  await bracket.updateMatchup(matchup.id, { [field]: parseInt(value) || 0 })
}

async function removeMatchup(id) {
  if (confirm('Delete this matchup?')) {
    await bracket.deleteMatchup(id)
  }
}

function formatDeadline(dateStr) {
  if (!dateStr) return 'Not set'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

</script>

<template>
  <div class="admin-page">
    <h1>Admin Panel</h1>

    <BaseTabs v-model="activeTab" :tabs="adminTabs">
      <template #users>
        <div class="users-section">
          <ZamboniLoader v-if="usersLoading" message="Loading users..." />
          <div v-else class="users-list">
            <div v-for="user in allUsers" :key="user.id" class="user-row">
              <div class="user-info">
                <span class="user-name">{{ user.display_name || 'Unknown' }}</span>
                <span v-if="user.is_admin" class="admin-badge">Admin</span>
              </div>
              <BaseButton
                :variant="user.is_active !== false ? 'success' : 'danger'"
                size="sm"
                @click="toggleUserActive(user)"
              >
                {{ user.is_active !== false ? 'Active' : 'Inactive' }}
              </BaseButton>
            </div>
          </div>
        </div>
      </template>

      <template #pick-status>
        <div class="pick-status-section">
          <ZamboniLoader v-if="pickStatusLoading" message="Loading pick status..." />
          <div v-else-if="!activeRoundForStatus" class="empty-state">
            No round is currently active. Activate a round in the Bracket tab to see pick status.
          </div>
          <template v-else>
            <BaseCard padding="md" radius="md" class="pick-status-header">
              <div class="pick-status-header-row">
                <span class="setting-label">Round</span>
                <span class="setting-value">{{ activeRoundForStatus.name }}</span>
              </div>
              <div class="pick-status-header-row">
                <span class="setting-label">Deadline</span>
                <span class="setting-value">{{ formatDeadline(activeRoundForStatus.pick_deadline) }}</span>
              </div>
              <div class="pick-status-header-row">
                <span class="setting-label">Picks required</span>
                <span class="setting-value">{{ requiredCount }}</span>
              </div>
            </BaseCard>

            <div v-if="requiredCount === 0" class="empty-state">
              No matchups have been added to this round yet.
            </div>

            <div v-else class="users-list">
              <div v-for="row in pickStatusRows" :key="row.user.id" class="user-row">
                <div class="user-info">
                  <span class="user-name">{{ row.user.display_name || 'Unknown' }}</span>
                  <span v-if="row.user.is_admin" class="admin-badge">Admin</span>
                </div>
                <div class="pick-status-right">
                  <span class="pick-count">{{ row.pickCount }} / {{ row.required }}</span>
                  <span :class="['status-badge', row.complete ? 'active' : 'inactive']">
                    {{ row.complete ? 'Complete' : 'Incomplete' }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template #bracket>

    <!-- Season info -->
    <div class="season-bar">
      <div class="season-info">
        <span class="season-label">Season:</span>
        <select class="season-year-select" v-model="selectedSeasonYear" @change="onSeasonChange(selectedSeasonYear)">
          <option v-for="s in bracket.seasons" :key="s.id" :value="s.year">
            {{ s.year }}{{ s.is_active ? ' *' : '' }}
          </option>
        </select>
      </div>
      <div v-if="showNewSeason" class="new-season-form">
        <input type="number" v-model.number="newSeasonYear" min="2020" max="2099" placeholder="Year" />
        <BaseButton variant="primary" size="sm" @click="handleCreateSeason" :disabled="creatingSeason">
          {{ creatingSeason ? 'Creating...' : 'Create' }}
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="showNewSeason = false">Cancel</BaseButton>
      </div>
      <BaseButton v-else variant="secondary" size="sm" @click="showNewSeason = true">New Season</BaseButton>
    </div>

    <!-- Round & Conference selector -->
    <div class="controls">
      <div class="control-group">
        <label>Round</label>
        <BaseButtonGroup v-model="selectedRound" :options="roundOptions" size="sm" />
      </div>

      <div class="control-group" v-if="selectedRound < 4">
        <label>Conference</label>
        <BaseButtonGroup v-model="selectedConference" :options="conferenceOptions" size="sm" />
      </div>
    </div>

    <!-- Round settings -->
    <div class="round-settings" v-if="currentRound">
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Status</span>
          <span :class="['status-badge', currentRound.is_active ? 'active' : 'inactive']">
            {{ currentRound.is_active ? 'Active' : 'Inactive' }}
          </span>
        </div>
        <BaseButton variant="secondary" size="sm" @click="toggleRoundActive">
          {{ currentRound.is_active ? 'Deactivate' : 'Activate' }}
        </BaseButton>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Pick Deadline</span>
          <span class="setting-value">{{ formatDeadline(currentRound.pick_deadline) }}</span>
        </div>
        <div v-if="editingDeadline" class="deadline-edit">
          <input type="datetime-local" v-model="deadlineInput" />
          <BaseButton variant="primary" size="sm" @click="saveDeadline">Save</BaseButton>
          <BaseButton variant="secondary" size="sm" @click="editingDeadline = false">Cancel</BaseButton>
        </div>
        <BaseButton v-else variant="secondary" size="sm" @click="startEditDeadline">Edit</BaseButton>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Points Per Correct Pick</span>
          <span class="setting-value">{{ currentRound.points_per_correct ?? 1 }} pts</span>
        </div>
        <div v-if="editingPoints" class="deadline-edit">
          <input type="number" v-model.number="pointsInput" min="1" max="20" style="width: 80px;" />
          <BaseButton variant="primary" size="sm" @click="savePoints">Save</BaseButton>
          <BaseButton variant="secondary" size="sm" @click="editingPoints = false">Cancel</BaseButton>
        </div>
        <BaseButton v-else variant="secondary" size="sm" @click="startEditPoints">Edit</BaseButton>
      </div>
    </div>

    <!-- Matchups -->
    <div class="matchups-section">
      <div class="section-header">
        <h2>Matchups</h2>
        <div class="section-actions">
          <BaseButton variant="info" @click="handleImportFromNHL" :disabled="importingFromNHL">
            {{ importingFromNHL ? 'Importing...' : 'Import from NHL' }}
          </BaseButton>
          <BaseButton variant="primary" @click="showAddMatchup = !showAddMatchup">
            {{ showAddMatchup ? 'Cancel' : '+ Add Matchup' }}
          </BaseButton>
        </div>
      </div>
      <div v-if="importError" class="import-error">{{ importError }}</div>

      <!-- Add matchup form -->
      <div v-if="showAddMatchup" class="add-matchup-form">
        <div class="form-row">
          <div class="form-field">
            <label>Home Team</label>
            <select v-model="newMatchup.team_home_id">
              <option :value="null">Select team...</option>
              <option v-for="team in conferenceTeams" :key="team.id" :value="team.id">
                {{ team.abbreviation }} - {{ team.name }}
              </option>
            </select>
          </div>
          <div class="form-field seed-field">
            <label>Seed</label>
            <input v-model="newMatchup.seed_home" placeholder="D1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Away Team</label>
            <select v-model="newMatchup.team_away_id">
              <option :value="null">Select team...</option>
              <option v-for="team in conferenceTeams" :key="team.id" :value="team.id">
                {{ team.abbreviation }} - {{ team.name }}
              </option>
            </select>
          </div>
          <div class="form-field seed-field">
            <label>Seed</label>
            <input v-model="newMatchup.seed_away" placeholder="WC2" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Bracket Position</label>
            <input type="number" v-model.number="newMatchup.bracket_position" min="1" max="8" />
          </div>
          <BaseButton variant="primary" @click="addMatchup">Add Matchup</BaseButton>
        </div>
      </div>

      <!-- Existing matchups -->
      <div v-if="currentMatchups.length === 0" class="empty-state">
        No matchups for this round yet. Click "+ Add Matchup" to create one.
      </div>

      <BaseCard
        v-for="(matchup, idx) in currentMatchups"
        :key="matchup.id"
        padding="md"
        radius="md"
        :class="['matchup-admin-card', { 'drag-over': dragOverIndex === idx, 'dragging': dragIndex === idx }]"
        draggable="true"
        @dragstart="onDragStart(idx)"
        @dragover="onDragOver($event, idx)"
        @dragleave="onDragLeave"
        @drop="onDrop(idx)"
        @dragend="onDragEnd"
      >
        <!-- Edit mode -->
        <template v-if="editingMatchupId === matchup.id">
          <div class="edit-form">
            <div class="form-row">
              <div class="form-field">
                <label>Home Team</label>
                <select v-model="editForm.team_home_id">
                  <option v-for="team in conferenceTeams" :key="team.id" :value="team.id">
                    {{ team.abbreviation }} - {{ team.name }}
                  </option>
                </select>
              </div>
              <div class="form-field seed-field">
                <label>Seed</label>
                <input v-model="editForm.seed_home" placeholder="D1" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>Away Team</label>
                <select v-model="editForm.team_away_id">
                  <option v-for="team in conferenceTeams" :key="team.id" :value="team.id">
                    {{ team.abbreviation }} - {{ team.name }}
                  </option>
                </select>
              </div>
              <div class="form-field seed-field">
                <label>Seed</label>
                <input v-model="editForm.seed_away" placeholder="WC2" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field seed-field">
                <label>Position</label>
                <input type="number" v-model.number="editForm.bracket_position" min="1" max="8" />
              </div>
              <div class="edit-actions">
                <BaseButton variant="primary" size="sm" @click="saveEdit(matchup.id)">Save</BaseButton>
                <BaseButton variant="secondary" size="sm" @click="cancelEdit">Cancel</BaseButton>
              </div>
            </div>
          </div>
        </template>

        <!-- Display mode -->
        <template v-else>
          <div class="matchup-teams">
            <div class="admin-team">
              <img :src="getLogoUrl(matchup.team_home.abbreviation)" class="admin-logo" @error="$event.target.style.display='none'" />
              <span class="admin-team-name">{{ matchup.team_home.abbreviation }}</span>
              <span class="admin-seed" v-if="matchup.seed_home">({{ matchup.seed_home }})</span>
              <div class="wins-input">
                <label>W</label>
                <input
                  type="number"
                  :value="matchup.series_home_wins"
                  @change="updateSeriesWins(matchup, 'series_home_wins', $event.target.value)"
                  min="0" max="4"
                />
              </div>
              <BaseButton
                :variant="matchup.winner_id === matchup.team_home_id ? 'success' : 'ghost'"
                size="sm"
                @click="setWinner(matchup, matchup.team_home_id)"
              >
                Winner
              </BaseButton>
            </div>

            <span class="vs">vs</span>

            <div class="admin-team">
              <img :src="getLogoUrl(matchup.team_away.abbreviation)" class="admin-logo" @error="$event.target.style.display='none'" />
              <span class="admin-team-name">{{ matchup.team_away.abbreviation }}</span>
              <span class="admin-seed" v-if="matchup.seed_away">({{ matchup.seed_away }})</span>
              <div class="wins-input">
                <label>W</label>
                <input
                  type="number"
                  :value="matchup.series_away_wins"
                  @change="updateSeriesWins(matchup, 'series_away_wins', $event.target.value)"
                  min="0" max="4"
                />
              </div>
              <BaseButton
                :variant="matchup.winner_id === matchup.team_away_id ? 'success' : 'ghost'"
                size="sm"
                @click="setWinner(matchup, matchup.team_away_id)"
              >
                Winner
              </BaseButton>
            </div>
          </div>

          <!-- Tiebreaker: actual total goals (final round only) -->
          <div v-if="selectedRound === 4" class="total-goals-input">
            <label>Total Goals</label>
            <input
              type="number"
              :value="matchup.actual_total_goals"
              @change="updateActualGoals(matchup, $event.target.value)"
              min="0"
              placeholder="—"
            />
          </div>

          <div class="matchup-actions">
            <BaseButton variant="secondary" size="sm" @click="startEdit(matchup)">Edit</BaseButton>
            <BaseButton
              :variant="matchup.is_locked ? 'success' : 'secondary'"
              size="sm"
              @click="toggleMatchupLock(matchup)"
            >
              {{ matchup.is_locked ? 'Unlock' : 'Lock' }}
            </BaseButton>
            <BaseButton variant="danger" size="sm" @click="removeMatchup(matchup.id)">Delete</BaseButton>
          </div>
        </template>
      </BaseCard>
    </div>

      </template>
    </BaseTabs>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 900px;
  margin: 0 auto;
}

.season-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 20px;
  margin-bottom: 24px;
}

.season-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.season-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.season-year-select {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--accent);
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--text-muted);
  border-radius: 0;
  padding: 0 2px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.season-year-select:hover,
.season-year-select:focus {
  border-bottom-color: var(--accent);
}

.season-year-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.new-season-form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.new-season-form input {
  width: 90px;
  padding: 6px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
  text-align: center;
}

h1 {
  font-size: 1.6rem;
  margin-bottom: 24px;
  color: var(--text-primary);
}

h2 {
  font-size: 1.2rem;
  color: var(--text-primary);
}

.controls {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.control-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}


/* Round settings */
.round-settings {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 24px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  flex-wrap: wrap;
  gap: 10px;
}

.setting-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.setting-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-right: 12px;
}

.setting-value {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.status-badge {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
}

.status-badge.active {
  background: rgba(76, 175, 80, 0.15);
  color: var(--success);
}

.status-badge.inactive {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
}

.deadline-edit {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.deadline-edit input {
  padding: 6px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
}

/* Matchups section */
.matchups-section {
  margin-top: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.import-error {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* Add matchup form */
.add-matchup-form {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.form-field {
  flex: 1;
  min-width: 150px;
}

.form-field label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.form-field select,
.form-field input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.seed-field {
  flex: 0 0 80px;
  min-width: 80px;
}

/* Admin matchup cards */
.matchup-admin-card {
  margin-bottom: 12px;
}

.matchup-admin-card :deep(.card-body) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  cursor: grab;
  transition: all 0.15s;
}

.matchup-admin-card:active {
  cursor: grabbing;
}

.matchup-admin-card.dragging {
  opacity: 0.4;
}

.matchup-admin-card.drag-over {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.matchup-teams {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.admin-team {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.admin-team-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
}

.admin-seed {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.vs {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.wins-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wins-input label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.wins-input input {
  width: 50px;
  padding: 4px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  text-align: center;
  font-size: 0.85rem;
}

.total-goals-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.total-goals-input label {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.total-goals-input input {
  width: 60px;
  padding: 4px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  text-align: center;
  font-size: 0.85rem;
}

.edit-form {
  width: 100%;
  padding: 4px 0;
}

.edit-form .form-row {
  margin-bottom: 10px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-bottom: 2px;
}

.matchup-actions {
  display: flex;
  gap: 8px;
}

/* Users section */
.users-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 24px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.user-row:last-child {
  border-bottom: none;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.admin-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(201, 168, 76, 0.15);
  color: var(--accent);
}

.pick-status-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pick-status-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pick-status-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.pick-status-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pick-count {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .matchup-teams {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .admin-team {
    flex-wrap: wrap;
  }
}
</style>
