<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseCard from '../components/ui/BaseCard.vue'

const auth = useAuthStore()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const success = ref(false)

async function handleRegister() {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }
  loading.value = true
  try {
    await auth.signUp(email.value, password.value, displayName.value)
    success.value = true
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
      <template v-if="!success">
        <h1>Register</h1>
        <p class="subtitle">Join the Stanley Cup Bracket challenge</p>

        <form @submit.prevent="handleRegister">
          <div class="field">
            <label>Display Name</label>
            <input v-model="displayName" type="text" required placeholder="Your name" />
          </div>
          <div class="field">
            <label>Email</label>
            <input v-model="email" type="email" required placeholder="you@example.com" />
          </div>
          <div class="field">
            <label>Password</label>
            <input v-model="password" type="password" required placeholder="Min 6 characters" />
          </div>
          <div class="field">
            <label>Confirm Password</label>
            <input v-model="confirmPassword" type="password" required placeholder="Confirm password" />
          </div>
          <div v-if="error" class="error">{{ error }}</div>
          <BaseButton type="submit" variant="primary" block :loading="loading">
            {{ loading ? 'Creating account...' : 'Create Account' }}
          </BaseButton>
        </form>

        <p class="switch">
          Already have an account? <router-link to="/login">Sign In</router-link>
        </p>
      </template>

      <template v-else>
        <h1>Check Your Email</h1>
        <p class="subtitle">We've sent a confirmation link to <strong>{{ email }}</strong>. Please confirm your email to continue.</p>
        <BaseButton variant="primary" block style="margin-top: 20px;" @click="router.push('/login')">
          Go to Sign In
        </BaseButton>
      </template>
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

.switch {
  text-align: center;
  margin-top: 20px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
</style>
