<script setup>
import { useAuthStore } from '../stores/auth'
import { useBracketStore } from '../stores/bracket'
import { useRouter } from 'vue-router'
import { ref, computed } from 'vue'

const auth = useAuthStore()
const bracket = useBracketStore()

const cupLogoUrl = computed(() => {
  const year = bracket.season?.year
  if (year) return `https://assets.nhle.com/logos/playoffs/png/scp-${year - 1}${year}-cup.png`
  return 'https://assets.nhle.com/logos/playoffs/png/scp-20252026-cup.png'
})
const router = useRouter()
const menuOpen = ref(false)

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
  menuOpen.value = false
}
</script>

<template>
  <nav class="navbar">
    <div class="nav-content">
      <router-link to="/" class="nav-brand">
        <img :src="cupLogoUrl" alt="Stanley Cup" class="nav-cup-logo" />
        <span class="brand-text">Stanley Cup Bracket</span>
      </router-link>

      <button class="hamburger" @click="menuOpen = !menuOpen" :class="{ open: menuOpen }">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div class="nav-links" :class="{ open: menuOpen }">
        <router-link to="/" @click="menuOpen = false">Bracket</router-link>
        <router-link to="/picks" @click="menuOpen = false">Picks</router-link>
        <router-link to="/leaderboard" @click="menuOpen = false">Leaderboard</router-link>
        <router-link to="/history" @click="menuOpen = false">History</router-link>
        <template v-if="auth.isLoggedIn">
          <router-link v-if="auth.isAdmin" to="/admin" @click="menuOpen = false">Admin</router-link>
          <router-link to="/profile" class="nav-user" @click="menuOpen = false">{{ auth.profile?.display_name }}</router-link>
          <button class="btn-signout" @click="handleSignOut">Sign Out</button>
        </template>
        <template v-else>
          <router-link to="/login" @click="menuOpen = false">Sign In</router-link>
          <router-link to="/register" class="btn-register" @click="menuOpen = false">Register</router-link>
        </template>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
}

.nav-cup-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-links a {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  padding: 8px 0;
  transition: color 0.2s;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: var(--accent);
}

.nav-user {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.btn-signout {
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: all 0.2s;
}
.btn-signout:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.btn-register {
  background: var(--accent) !important;
  color: var(--bg-primary) !important;
  padding: 6px 16px !important;
  border-radius: 6px;
  font-weight: 600 !important;
}

.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  padding: 5px;
}
.hamburger span {
  width: 24px;
  height: 2px;
  background: var(--text-primary);
  transition: all 0.3s;
}
.hamburger.open span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}
.hamburger.open span:nth-child(2) {
  opacity: 0;
}
.hamburger.open span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

@media (max-width: 768px) {
  .hamburger {
    display: flex;
  }
  .nav-links {
    display: none;
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    flex-direction: column;
    padding: 20px;
    border-bottom: 1px solid var(--border);
    gap: 15px;
  }
  .nav-links.open {
    display: flex;
  }
  .brand-text {
    font-size: 0.95rem;
  }
}
</style>
