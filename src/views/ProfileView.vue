<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()

const activeTab = ref('profile')
const displayName = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const savingPassword = ref(false)
const message = ref('')
const passwordMessage = ref('')
const currentStats = ref({ total: 0, correct: 0, pending: 0, points: 0 })
const careerStats = ref({ total: 0, correct: 0, points: 0, seasons: 0 })
const seasonBreakdown = ref([])
const roundPerformance = ref([])
const loading = ref(true)

onMounted(async () => {
  displayName.value = auth.profile?.display_name || ''
  try {
    await loadAllStats()
  } catch (e) {
    console.error('Stats fetch error:', e)
  } finally {
    loading.value = false
  }
})

async function loadAllStats() {
  if (!auth.user?.id) return

  // Fetch all seasons
  const { data: seasons } = await supabase.from('seasons').select('*').order('year', { ascending: false })
  if (!seasons || seasons.length === 0) return

  // Fetch all rounds
  const { data: allRounds } = await supabase.from('rounds').select('*').order('round_number')
  if (!allRounds) return

  // Fetch all matchups
  const allRoundIds = allRounds.map(r => r.id)
  const { data: allMatchups } = await supabase.from('matchups').select('*').in('round_id', allRoundIds)
  if (!allMatchups) return

  // Fetch all user picks
  const allMatchupIds = allMatchups.map(m => m.id)
  if (allMatchupIds.length === 0) return
  const { data: allPicks } = await supabase.from('picks').select('*').eq('user_id', auth.user.id).in('matchup_id', allMatchupIds)
  const picks = allPicks || []

  // Build lookup maps
  const roundMap = {}
  allRounds.forEach(r => { roundMap[r.id] = r })

  const matchupRoundMap = {}
  const winnerMap = {}
  allMatchups.forEach(m => {
    matchupRoundMap[m.id] = m.round_id
    if (m.winner_id != null) winnerMap[m.id] = m.winner_id
  })

  // Per-season stats
  const perSeason = []
  let careerTotal = 0, careerCorrect = 0, careerPoints = 0, seasonsPlayed = 0

  // Round performance accumulators
  const roundAccum = { 1: { correct: 0, decided: 0 }, 2: { correct: 0, decided: 0 }, 3: { correct: 0, decided: 0 }, 4: { correct: 0, decided: 0 } }

  const activeSeason = seasons.find(s => s.is_active)

  for (const season of seasons) {
    const seasonRounds = allRounds.filter(r => r.season_id === season.id)
    const seasonRoundIds = new Set(seasonRounds.map(r => r.id))
    const roundPointsMap = {}
    seasonRounds.forEach(r => { roundPointsMap[r.id] = r.points_per_correct ?? 1 })

    const seasonMatchups = allMatchups.filter(m => seasonRoundIds.has(m.round_id))
    const seasonMatchupIds = new Set(seasonMatchups.map(m => m.id))
    const seasonPicks = picks.filter(p => seasonMatchupIds.has(p.matchup_id))

    if (seasonPicks.length === 0) continue
    seasonsPlayed++

    let correct = 0, points = 0, pending = 0
    seasonPicks.forEach(p => {
      if (winnerMap[p.matchup_id] !== undefined) {
        if (p.team_id === winnerMap[p.matchup_id]) {
          correct++
          points += roundPointsMap[matchupRoundMap[p.matchup_id]] || 1

          const round = roundMap[matchupRoundMap[p.matchup_id]]
          if (round) roundAccum[round.round_number].correct++
        }
        const round = roundMap[matchupRoundMap[p.matchup_id]]
        if (round) roundAccum[round.round_number].decided++
      } else {
        pending++
      }
    })

    careerTotal += seasonPicks.length
    careerCorrect += correct
    careerPoints += points

    const decided = seasonPicks.length - pending
    perSeason.push({
      year: season.year,
      isActive: season.is_active,
      total: seasonPicks.length,
      correct,
      points,
      accuracy: decided > 0 ? Math.round((correct / decided) * 100) : null
    })

    // Set current season stats
    if (season.is_active) {
      currentStats.value = { total: seasonPicks.length, correct, pending, points }
    }
  }

  careerStats.value = { total: careerTotal, correct: careerCorrect, points: careerPoints, seasons: seasonsPlayed }
  seasonBreakdown.value = perSeason

  roundPerformance.value = [
    { label: 'Round 1', ...roundAccum[1] },
    { label: 'Round 2', ...roundAccum[2] },
    { label: 'Conf Finals', ...roundAccum[3] },
    { label: 'Cup Final', ...roundAccum[4] }
  ]
}

const accuracy = computed(() => {
  const decided = currentStats.value.total - currentStats.value.pending
  if (decided === 0) return '—'
  return Math.round((currentStats.value.correct / decided) * 100) + '%'
})

const careerAccuracy = computed(() => {
  if (careerStats.value.total === 0) return '—'
  return Math.round((careerStats.value.correct / careerStats.value.total) * 100) + '%'
})

async function saveDisplayName() {
  if (!displayName.value.trim()) return
  saving.value = true
  message.value = ''
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.value.trim() })
      .eq('id', auth.user.id)
    if (error) throw error
    await auth.fetchProfile()
    message.value = 'Display name updated!'
  } catch (e) {
    message.value = 'Error: ' + e.message
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  passwordMessage.value = ''
  if (newPassword.value.length < 6) {
    passwordMessage.value = 'Password must be at least 6 characters'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordMessage.value = 'Passwords do not match'
    return
  }
  savingPassword.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword.value })
    if (error) throw error
    passwordMessage.value = 'Password updated!'
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    passwordMessage.value = 'Error: ' + e.message
  } finally {
    savingPassword.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <h1>Profile</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">Profile</button>
      <button class="tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">Stats</button>
    </div>

    <!-- Profile Tab -->
    <div v-if="activeTab === 'profile'">
      <!-- Display Name -->
      <div class="section">
        <h2>Display Name</h2>
        <form @submit.prevent="saveDisplayName" class="inline-form">
          <input v-model="displayName" type="text" placeholder="Your display name" />
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </form>
        <div v-if="message" :class="['msg', message.startsWith('Error') ? 'error' : 'success']">
          {{ message }}
        </div>
      </div>

      <!-- Email (read-only) -->
      <div class="section">
        <h2>Email</h2>
        <div class="readonly-field">{{ auth.user?.email }}</div>
      </div>

      <!-- Change Password -->
      <div class="section">
        <h2>Change Password</h2>
        <form @submit.prevent="changePassword" class="stack-form">
          <div class="field">
            <label>New Password</label>
            <input v-model="newPassword" type="password" placeholder="Min 6 characters" />
          </div>
          <div class="field">
            <label>Confirm Password</label>
            <input v-model="confirmPassword" type="password" placeholder="Confirm password" />
          </div>
          <button type="submit" class="btn-primary" :disabled="savingPassword">
            {{ savingPassword ? 'Updating...' : 'Update Password' }}
          </button>
        </form>
        <div v-if="passwordMessage" :class="['msg', passwordMessage.startsWith('Error') ? 'error' : 'success']">
          {{ passwordMessage }}
        </div>
      </div>
    </div>

    <!-- Stats Tab -->
    <div v-if="activeTab === 'stats'">
      <div v-if="!loading">
        <h2 class="section-title">This Season</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.points }}</div>
            <div class="stat-label">Points</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.correct }}</div>
            <div class="stat-label">Correct</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ accuracy }}</div>
            <div class="stat-label">Accuracy</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.total }}</div>
            <div class="stat-label">Total Picks</div>
          </div>
        </div>

        <!-- Career Stats -->
        <div class="career-section">
          <h2 class="section-title">Career</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{ careerStats.points }}</div>
              <div class="stat-label">All-Time Pts</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ careerStats.correct }}/{{ careerStats.total }}</div>
              <div class="stat-label">Correct</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ careerAccuracy }}</div>
              <div class="stat-label">Accuracy</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ careerStats.seasons }}</div>
              <div class="stat-label">Seasons</div>
            </div>
          </div>
        </div>

        <!-- Round Performance -->
        <h2 class="section-title">Round Performance</h2>
        <div class="section round-section">
          <div class="round-bars">
            <div v-for="round in roundPerformance" :key="round.label" class="round-bar-row">
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
        <div v-if="seasonBreakdown.length > 0" class="section history-section">
          <h2>Season History</h2>
          <div class="history-table">
            <div class="history-row history-header">
              <span class="hist-year">Year</span>
              <span class="hist-pts">Pts</span>
              <span class="hist-correct">Correct</span>
              <span class="hist-total">Picks</span>
              <span class="hist-acc">Acc</span>
            </div>
            <div v-for="s in seasonBreakdown" :key="s.year" class="history-row" :class="{ active: s.isActive }">
              <span class="hist-year">{{ s.year }}</span>
              <span class="hist-pts">{{ s.points }}</span>
              <span class="hist-correct">{{ s.correct }}</span>
              <span class="hist-total">{{ s.total }}</span>
              <span class="hist-acc">{{ s.accuracy != null ? s.accuracy + '%' : '—' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="loading">Loading stats...</div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: 1.6rem;
  margin-bottom: 16px;
  color: var(--text-primary);
}

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

.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

h2 {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 4px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.career-section {
  margin-bottom: 24px;
}

/* Round Performance */
.round-section h2 {
  margin-bottom: 14px;
}

.round-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.round-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.round-bar-label {
  width: 90px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.round-bar-track {
  flex: 1;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.round-bar-fill {
  height: 100%;
  background: var(--success);
  border-radius: 4px;
  transition: width 0.3s;
}

.round-bar-pct {
  width: 36px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
  flex-shrink: 0;
}

.round-bar-count {
  width: 36px;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-align: right;
  flex-shrink: 0;
}

/* Season History */
.history-section h2 {
  margin-bottom: 12px;
}

.history-table {
  font-size: 0.8rem;
}

.history-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.history-row.history-header {
  font-weight: 700;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

.history-row.active {
  color: var(--accent);
}

.hist-year {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
}

.history-header .hist-year {
  color: var(--text-muted);
}

.hist-pts, .hist-correct, .hist-total, .hist-acc {
  width: 50px;
  text-align: center;
  color: var(--text-secondary);
}

.history-row.active .hist-pts,
.history-row.active .hist-correct,
.history-row.active .hist-total,
.history-row.active .hist-acc {
  color: var(--accent);
}

.section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}

.inline-form {
  display: flex;
  gap: 10px;
}

.inline-form input {
  flex: 1;
}

.stack-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.95rem;
}

input:focus {
  border-color: var(--accent);
  outline: none;
}

.readonly-field {
  padding: 10px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: 8px;
  white-space: nowrap;
}
.btn-primary:hover { background: var(--accent-light); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.msg {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}
.msg.success {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success);
}
.msg.error {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger);
}

@media (max-width: 500px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .inline-form {
    flex-direction: column;
  }
}
</style>
