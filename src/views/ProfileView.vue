<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import ZamboniLoader from '../components/ui/ZamboniLoader.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseTabs from '../components/ui/BaseTabs.vue'
import BaseCard from '../components/ui/BaseCard.vue'

const profileTabs = [
  { key: 'profile', label: 'Profile' },
  { key: 'stats', label: 'Stats' }
]

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

  const { data, error } = await supabase.rpc('get_career_stats')
  if (error) throw error

  const me = (data || []).find(r => r.user_id === auth.user.id)
  if (!me) return

  const seasons = (me.season_details || [])

  careerStats.value = {
    total: Number(me.total_picks),
    correct: Number(me.total_correct),
    points: Number(me.total_points),
    seasons: Number(me.seasons_played)
  }

  seasonBreakdown.value = seasons.map(s => ({
    year: s.year,
    isActive: s.isActive,
    total: Number(s.total),
    correct: Number(s.correct),
    points: Number(s.points),
    accuracy: s.accuracy != null ? Number(s.accuracy) : null
  }))

  // Current season stats
  const active = seasons.find(s => s.isActive)
  if (active) {
    const pending = Number(active.total) - Number(active.decided)
    currentStats.value = {
      total: Number(active.total),
      correct: Number(active.correct),
      pending,
      points: Number(active.points)
    }
  }

  roundPerformance.value = [
    { label: 'Round 1', correct: Number(me.r1_correct), decided: Number(me.r1_decided) },
    { label: 'Round 2', correct: Number(me.r2_correct), decided: Number(me.r2_decided) },
    { label: 'Conf Finals', correct: Number(me.r3_correct), decided: Number(me.r3_decided) },
    { label: 'Cup Final', correct: Number(me.r4_correct), decided: Number(me.r4_decided) }
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
    <BaseTabs v-model="activeTab" :tabs="profileTabs">
      <template #profile>
      <!-- Display Name -->
      <BaseCard class="section" padding="md" radius="md">
        <h2>Display Name</h2>
        <form @submit.prevent="saveDisplayName" class="inline-form">
          <input v-model="displayName" type="text" placeholder="Your display name" />
          <BaseButton type="submit" variant="primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </BaseButton>
        </form>
        <div v-if="message" :class="['msg', message.startsWith('Error') ? 'error' : 'success']">
          {{ message }}
        </div>
      </BaseCard>

      <!-- Email (read-only) -->
      <BaseCard class="section" padding="md" radius="md">
        <h2>Email</h2>
        <div class="readonly-field">{{ auth.user?.email }}</div>
      </BaseCard>

      <!-- Change Password -->
      <BaseCard class="section" padding="md" radius="md">
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
          <BaseButton type="submit" variant="primary" :disabled="savingPassword">
            {{ savingPassword ? 'Updating...' : 'Update Password' }}
          </BaseButton>
        </form>
        <div v-if="passwordMessage" :class="['msg', passwordMessage.startsWith('Error') ? 'error' : 'success']">
          {{ passwordMessage }}
        </div>
      </BaseCard>
      </template>

      <template #stats>
      <div v-if="!loading">
        <h2 class="section-title">This Season</h2>
        <div class="stats-grid">
          <BaseCard padding="md" radius="md">
            <div class="stat-value">{{ currentStats.points }}</div>
            <div class="stat-label">Points</div>
          </BaseCard>
          <BaseCard padding="md" radius="md">
            <div class="stat-value">{{ currentStats.correct }}</div>
            <div class="stat-label">Correct</div>
          </BaseCard>
          <BaseCard padding="md" radius="md">
            <div class="stat-value">{{ accuracy }}</div>
            <div class="stat-label">Accuracy</div>
          </BaseCard>
          <BaseCard padding="md" radius="md">
            <div class="stat-value">{{ currentStats.total }}</div>
            <div class="stat-label">Total Picks</div>
          </BaseCard>
        </div>

        <!-- Career Stats -->
        <div class="career-section">
          <h2 class="section-title">Career</h2>
          <div class="stats-grid">
            <BaseCard padding="md" radius="md">
              <div class="stat-value">{{ careerStats.points }}</div>
              <div class="stat-label">All-Time Pts</div>
            </BaseCard>
            <BaseCard padding="md" radius="md">
              <div class="stat-value">{{ careerStats.correct }}/{{ careerStats.total }}</div>
              <div class="stat-label">Correct</div>
            </BaseCard>
            <BaseCard padding="md" radius="md">
              <div class="stat-value">{{ careerAccuracy }}</div>
              <div class="stat-label">Accuracy</div>
            </BaseCard>
            <BaseCard padding="md" radius="md">
              <div class="stat-value">{{ careerStats.seasons }}</div>
              <div class="stat-label">Seasons</div>
            </BaseCard>
          </div>
        </div>

        <!-- Round Performance -->
        <h2 class="section-title">Round Performance</h2>
        <BaseCard class="section round-section" padding="md" radius="md">
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
        </BaseCard>

        <!-- Season History -->
        <BaseCard v-if="seasonBreakdown.length > 0" class="section history-section" padding="md" radius="md">
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
        </BaseCard>
      </div>
      <ZamboniLoader v-else message="Loading stats..." />
      </template>
    </BaseTabs>
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

.stats-grid :deep(.card-body) {
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
