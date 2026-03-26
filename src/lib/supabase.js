import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Bypass navigator.locks which can deadlock when tabs are backgrounded
async function noOpLock(_name, _acquireTimeout, fn) {
  return await fn()
}

// Wrap fetch with a timeout so requests can't hang forever
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  // Merge abort signals if one already exists
  const existingSignal = options.signal
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort())
  }

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: noOpLock
  }
})
