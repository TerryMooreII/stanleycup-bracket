import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useBracketStore } from '../stores/bracket'

const routes = [
  {
    path: '/',
    name: 'home',
    meta: { requiresAuth: true, needsYearRedirect: true },
    // Component won't render — beforeEach redirects to /:year/bracket
    component: { template: '<div/>' }
  },
  {
    path: '/:year(\\d+)/bracket',
    name: 'bracket',
    component: () => import('../views/BracketView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:year(\\d+)/picks',
    name: 'picks',
    component: () => import('../views/PicksView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:year(\\d+)/leaderboard',
    name: 'leaderboard',
    component: () => import('../views/LeaderboardView.vue'),
    meta: { requiresAuth: true }
  },
  // Legacy routes
  {
    path: '/picks',
    name: 'picks-legacy',
    component: () => import('../views/PicksView.vue'),
    meta: { requiresAuth: true, needsYearRedirect: true, targetView: 'picks' }
  },
  {
    path: '/leaderboard',
    name: 'leaderboard-legacy',
    component: () => import('../views/LeaderboardView.vue'),
    meta: { requiresAuth: true, needsYearRedirect: true, targetView: 'leaderboard' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { guest: true }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('../views/ResetPasswordView.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAdmin: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Ensure auth is initialized
  await auth.initialize()

  if ((to.meta.requiresAuth || to.meta.requiresAdmin) && !auth.isLoggedIn) {
    return { name: 'login' }
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    if (!auth.isLoggedIn) return { name: 'login' }
    const bracket = useBracketStore()
    if (bracket.seasons.length === 0) await bracket.fetchAllSeasons()
    const year = bracket.activeSeason?.year || bracket.seasons[0]?.year
    return year ? `/${year}/bracket` : '/'
  }
  if (to.meta.guest && auth.isLoggedIn) {
    const bracket = useBracketStore()
    if (bracket.seasons.length === 0) await bracket.fetchAllSeasons()
    const year = bracket.activeSeason?.year || bracket.seasons[0]?.year
    return year ? `/${year}/bracket` : '/'
  }

  // Redirect legacy routes (/, /picks, /leaderboard) to year-prefixed versions
  if (to.meta.needsYearRedirect && auth.isLoggedIn) {
    const bracket = useBracketStore()
    if (bracket.seasons.length === 0) {
      await bracket.fetchAllSeasons()
    }
    const year = bracket.activeSeason?.year || bracket.seasons[0]?.year
    if (year) {
      const view = to.meta.targetView || 'bracket'
      return `/${year}/${view}`
    }
  }

  // Ensure seasons are loaded for year-prefixed routes
  if (to.params.year) {
    const bracket = useBracketStore()
    if (bracket.seasons.length === 0) {
      await bracket.fetchAllSeasons()
    }
  }
})

export default router
