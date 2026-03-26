import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)

  const isAdmin = computed(() => profile.value?.is_admin === true)
  const isLoggedIn = computed(() => !!user.value)

  async function fetchProfile() {
    if (!user.value) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    profile.value = data
  }

  let initPromise = null

  async function initialize() {
    if (initPromise) return initPromise
    initPromise = _doInitialize()
    return initPromise
  }

  async function _doInitialize() {
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      user.value = session?.user ?? null
      if (user.value) await fetchProfile()
    } catch (e) {
      console.error('Auth init error:', e)
      user.value = null
      profile.value = null
    } finally {
      loading.value = false
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      user.value = newUser
      if (newUser) {
        // Break out of the auth state change callback context
        // to avoid deadlocking the Supabase client's internal session lock
        setTimeout(() => {
          fetchProfile().catch(e => console.error('Profile fetch error:', e))
        }, 0)
      } else {
        profile.value = null
      }
    })

  }

  async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return {
    user, profile, loading, isAdmin, isLoggedIn,
    initialize, fetchProfile, signUp, signIn, signOut
  }
})
