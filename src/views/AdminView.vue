<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useBracketStore } from '../stores/bracket'

const auth = useAuthStore()
const bracket = useBracketStore()

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

onMounted(async () => {
  await bracket.fetchAll(auth.user?.id)
})

const currentRound = computed(() => {
  return bracket.rounds.find(r => r.round_number === selectedRound.value)
})

const conferenceTeams = computed(() => {
  return bracket.teams.filter(t => t.conference === selectedConference.value)
})

const currentMatchups = computed(() => {
  if (!currentRound.value) return []
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

async function setWinner(matchup, teamId) {
  await bracket.updateMatchup(matchup.id, { winner_id: teamId })
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

function getLogoUrl(abbr) {
  return `https://assets.nhle.com/logos/nhl/svg/${abbr}_dark.svg`
}
</script>

<template>
  <div class="admin-page">
    <h1>Admin Panel</h1>

    <!-- Season info -->
    <div class="season-bar">
      <div class="season-info">
        <span class="season-label">Season:</span>
        <span class="season-year">{{ bracket.season?.year || '—' }}</span>
      </div>
      <div v-if="showNewSeason" class="new-season-form">
        <input type="number" v-model.number="newSeasonYear" min="2020" max="2099" placeholder="Year" />
        <button class="btn-sm btn-save" @click="handleCreateSeason" :disabled="creatingSeason">
          {{ creatingSeason ? 'Creating...' : 'Create' }}
        </button>
        <button class="btn-sm" @click="showNewSeason = false">Cancel</button>
      </div>
      <button v-else class="btn-sm" @click="showNewSeason = true">New Season</button>
    </div>

    <!-- Round & Conference selector -->
    <div class="controls">
      <div class="control-group">
        <label>Round</label>
        <div class="btn-group">
          <button
            v-for="r in [1, 2, 3, 4]"
            :key="r"
            :class="{ active: selectedRound === r }"
            @click="selectedRound = r"
          >
            {{ r === 4 ? 'Final' : r === 3 ? 'CF' : 'R' + r }}
          </button>
        </div>
      </div>

      <div class="control-group" v-if="selectedRound < 4">
        <label>Conference</label>
        <div class="btn-group">
          <button
            v-for="c in ['Western', 'Eastern']"
            :key="c"
            :class="{ active: selectedConference === c }"
            @click="selectedConference = c"
          >
            {{ c }}
          </button>
        </div>
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
        <button class="btn-sm" @click="toggleRoundActive">
          {{ currentRound.is_active ? 'Deactivate' : 'Activate' }}
        </button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Pick Deadline</span>
          <span class="setting-value">{{ formatDeadline(currentRound.pick_deadline) }}</span>
        </div>
        <div v-if="editingDeadline" class="deadline-edit">
          <input type="datetime-local" v-model="deadlineInput" />
          <button class="btn-sm btn-save" @click="saveDeadline">Save</button>
          <button class="btn-sm" @click="editingDeadline = false">Cancel</button>
        </div>
        <button v-else class="btn-sm" @click="startEditDeadline">Edit</button>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Points Per Correct Pick</span>
          <span class="setting-value">{{ currentRound.points_per_correct ?? 1 }} pts</span>
        </div>
        <div v-if="editingPoints" class="deadline-edit">
          <input type="number" v-model.number="pointsInput" min="1" max="20" style="width: 80px;" />
          <button class="btn-sm btn-save" @click="savePoints">Save</button>
          <button class="btn-sm" @click="editingPoints = false">Cancel</button>
        </div>
        <button v-else class="btn-sm" @click="startEditPoints">Edit</button>
      </div>
    </div>

    <!-- Matchups -->
    <div class="matchups-section">
      <div class="section-header">
        <h2>Matchups</h2>
        <button class="btn-add" @click="showAddMatchup = !showAddMatchup">
          {{ showAddMatchup ? 'Cancel' : '+ Add Matchup' }}
        </button>
      </div>

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
          <button class="btn-primary" @click="addMatchup">Add Matchup</button>
        </div>
      </div>

      <!-- Existing matchups -->
      <div v-if="currentMatchups.length === 0" class="empty-state">
        No matchups for this round yet. Click "+ Add Matchup" to create one.
      </div>

      <div
        v-for="(matchup, idx) in currentMatchups"
        :key="matchup.id"
        class="matchup-admin-card"
        :class="{ 'drag-over': dragOverIndex === idx, 'dragging': dragIndex === idx }"
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
                <button class="btn-sm btn-save" @click="saveEdit(matchup.id)">Save</button>
                <button class="btn-sm" @click="cancelEdit">Cancel</button>
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
              <button
                class="btn-winner"
                :class="{ won: matchup.winner_id === matchup.team_home_id }"
                @click="setWinner(matchup, matchup.team_home_id)"
              >
                Winner
              </button>
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
              <button
                class="btn-winner"
                :class="{ won: matchup.winner_id === matchup.team_away_id }"
                @click="setWinner(matchup, matchup.team_away_id)"
              >
                Winner
              </button>
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
            <button class="btn-edit" @click="startEdit(matchup)">Edit</button>
            <button class="btn-delete" @click="removeMatchup(matchup.id)">Delete</button>
          </div>
        </template>
      </div>
    </div>
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

.season-year {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--accent);
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

.btn-group {
  display: flex;
  gap: 0;
}

.btn-group button {
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-group button:first-child {
  border-radius: 6px 0 0 6px;
}

.btn-group button:last-child {
  border-radius: 0 6px 6px 0;
}

.btn-group button:not(:last-child) {
  border-right: none;
}

.btn-group button.active {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
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

.btn-sm {
  padding: 6px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 6px;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.btn-sm:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-save {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
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

.btn-add {
  padding: 8px 16px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
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

.btn-primary {
  padding: 8px 20px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
}

/* Admin matchup cards */
.matchup-admin-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 12px;
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

.btn-winner {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 4px;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn-winner:hover {
  border-color: var(--success);
  color: var(--success);
}

.btn-winner.won {
  background: rgba(76, 175, 80, 0.15);
  border-color: var(--success);
  color: var(--success);
  font-weight: 600;
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

.btn-edit {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  font-size: 0.8rem;
}

.btn-edit:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-delete {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  font-size: 0.8rem;
}

.btn-delete:hover {
  border-color: var(--danger);
  color: var(--danger);
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
