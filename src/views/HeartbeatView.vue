<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import BaseCard from '../components/ui/BaseCard.vue'

const ok = ref(false)
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    const { data, error: rpcError } = await supabase.rpc('heartbeat')
    if (rpcError) throw rpcError
    ok.value = data === true
    if (!ok.value) error.value = 'Unexpected response'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="heartbeat-page">
    <BaseCard padding="lg" radius="lg" class="heartbeat-card">
      <h1>Heartbeat</h1>
      <p v-if="loading" class="status">Checking...</p>
      <p v-else-if="ok" class="status ok">OK</p>
      <div v-else class="error">{{ error }}</div>
    </BaseCard>
  </div>
</template>

<style scoped>
.heartbeat-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 60px - 72px - 40px);
}

.heartbeat-card {
  width: 100%;
  max-width: 420px;
  text-align: center;
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.status {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.status.ok {
  color: var(--success, #4caf50);
  font-weight: 600;
}

.error {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger);
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
}
</style>
