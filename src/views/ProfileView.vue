<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const auth = useAuthStore()

const displayName = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const savingPassword = ref(false)
const message = ref('')
const passwordMessage = ref('')
const stats = ref({ total: 0, correct: 0, pending: 0, points: 0 })
const loading = ref(true)

onMounted(async () => {
  displayName.value = auth.profile?.display_name || ''
  try {
    await loadStats()
  } catch (e) {
    console.error('Stats fetch error:', e)
  } finally {
    loading.value = false
  }
})

async function loadStats() {
  const seasonRes = await supabase.from('seasons').select('*').eq('is_active', true).single()
  const seasonId = seasonRes.data?.id
  if (!seasonId) return

  const roundsRes = await supabase.from('rounds').select('*').eq('season_id', seasonId)
  const rounds = roundsRes.data || []
  const roundIds = rounds.map(r => r.id)
  const roundPointsMap = {}
  rounds.forEach(r => { roundPointsMap[r.id] = r.points_per_correct ?? 1 })

  const matchupsRes = await supabase.from('matchups').select('*').in('round_id', roundIds)
  const matchups = matchupsRes.data || []
  const matchupRoundMap = {}
  matchups.forEach(m => { matchupRoundMap[m.id] = m.round_id })

  const decidedMatchups = matchups.filter(m => m.winner_id != null)
  const decidedIds = new Set(decidedMatchups.map(m => m.id))
  const winnerMap = {}
  decidedMatchups.forEach(m => { winnerMap[m.id] = m.winner_id })

  const matchupIds = matchups.map(m => m.id)
  if (matchupIds.length === 0) return

  const picksRes = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', auth.user.id)
    .in('matchup_id', matchupIds)
  const picks = picksRes.data || []

  let correct = 0
  let points = 0
  let pending = 0
  picks.forEach(p => {
    if (decidedIds.has(p.matchup_id)) {
      if (p.team_id === winnerMap[p.matchup_id]) {
        correct++
        points += roundPointsMap[matchupRoundMap[p.matchup_id]] || 1
      }
    } else {
      pending++
    }
  })

  stats.value = { total: picks.length, correct, pending, points }
}

const accuracy = computed(() => {
  const decided = stats.value.total - stats.value.pending
  if (decided === 0) return '—'
  return Math.round((stats.value.correct / decided) * 100) + '%'
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

    <!-- Stats -->
    <div class="stats-grid" v-if="!loading">
      <div class="stat-card">
        <div class="stat-value">{{ stats.points }}</div>
        <div class="stat-label">Points</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.correct }}</div>
        <div class="stat-label">Correct</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ accuracy }}</div>
        <div class="stat-label">Accuracy</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Picks</div>
      </div>
    </div>

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
</template>

<style scoped>
.profile-page {
  max-width: 600px;
  margin: 0 auto;
}

h1 {
  font-size: 1.6rem;
  margin-bottom: 24px;
  color: var(--text-primary);
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
