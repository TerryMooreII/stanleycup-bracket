<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import NavBar from './components/NavBar.vue'
import ScoreTicker from './components/ScoreTicker.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.initialize()
})
</script>

<template>
  <NavBar />
  <main>
    <router-view />
  </main>
  <ScoreTicker />
</template>

<style scoped>
main {
  flex: 1;
  padding: 20px;
  padding-bottom: 72px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 768px) {
  main {
    padding: 10px;
    padding-bottom: 62px;
  }
}
</style>
