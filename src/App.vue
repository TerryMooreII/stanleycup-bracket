<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import NavBar from './components/NavBar.vue'

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
</template>

<style scoped>
main {
  flex: 1;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 768px) {
  main {
    padding: 10px;
  }
}
</style>
