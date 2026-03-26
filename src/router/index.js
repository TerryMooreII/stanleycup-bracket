import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'bracket',
    component: () => import('../views/BracketView.vue'),
    meta: { requiresAuth: true }
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
    path: '/admin',
    name: 'admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAdmin: true }
  },
  {
    path: '/picks',
    name: 'picks',
    component: () => import('../views/PicksView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/leaderboard',
    name: 'leaderboard',
    component: () => import('../views/LeaderboardView.vue'),
    meta: { requiresAuth: true }
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
    return { name: auth.isLoggedIn ? 'bracket' : 'login' }
  }
  if (to.meta.guest && auth.isLoggedIn) {
    return { name: 'bracket' }
  }
})

export default router
