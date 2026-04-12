<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseCard from '../components/ui/BaseCard.vue'

const router = useRouter()

const password = ref('')
const confirm = ref('')
const error = ref('')
const done = ref(false)
const loading = ref(false)
const ready = ref(false)

let unsub = null

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session) ready.value = true

  const { data: listener } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
      ready.value = true
    }
  })
  unsub = listener.subscription
})

onUnmounted(() => {
  unsub?.unsubscribe()
})

async function handleSubmit() {
  error.value = ''
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match.'
    return
  }
  loading.value = true
  try {
    const { error: err } = await supabase.auth.updateUser({ password: password.value })
    if (err) throw err
    done.value = true
    setTimeout(() => router.push('/login'), 2000)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <BaseCard padding="lg" radius="lg" class="auth-card">
      <h1>Reset Password</h1>

      <div v-if="done" class="success">
        Password updated. Redirecting to sign in...
      </div>

      <template v-else-if="ready">
        <p class="subtitle">Choose a new password for your account.</p>
        <form @submit.prevent="handleSubmit">
          <div class="field">
            <label>New Password</label>
            <input v-model="password" type="password" required placeholder="Min 6 characters" />
          </div>
          <div class="field">
            <label>Confirm Password</label>
            <input v-model="confirm" type="password" required placeholder="Confirm password" />
          </div>
          <div v-if="error" class="error">{{ error }}</div>
          <BaseButton type="submit" variant="primary" block :loading="loading">
            {{ loading ? 'Updating...' : 'Update Password' }}
          </BaseButton>
        </form>
      </template>

      <div v-else class="error">
        This reset link is invalid or has expired. Please
        <router-link to="/forgot-password">request a new one</router-link>.
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 60px - 72px - 40px);
}

.auth-card {
  width: 100%;
  max-width: 420px;
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 30px;
  font-size: 0.9rem;
}

.field {
  margin-bottom: 20px;
}

label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

input:focus {
  border-color: var(--accent);
  outline: none;
}

.error {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.success {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success);
  padding: 14px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
