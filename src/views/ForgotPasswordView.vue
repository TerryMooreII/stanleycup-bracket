<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseCard from '../components/ui/BaseCard.vue'

const email = ref('')
const error = ref('')
const sent = ref(false)
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) throw err
    sent.value = true
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
      <h1>Forgot Password</h1>
      <p class="subtitle">Enter your email and we'll send you a reset link.</p>

      <div v-if="sent" class="success">
        If an account exists for <strong>{{ email }}</strong>, a reset link is on its way. Check your inbox.
      </div>

      <form v-else @submit.prevent="handleSubmit">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="you@example.com" />
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <BaseButton type="submit" variant="primary" block :loading="loading">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </BaseButton>
      </form>

      <p class="switch">
        <router-link to="/login">Back to sign in</router-link>
      </p>
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
  line-height: 1.5;
  margin-bottom: 16px;
}

.switch {
  text-align: center;
  margin-top: 20px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}
</style>
