import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nhlUrl } from '../lib/nhlApi'

function getDateStrings() {
  const now = new Date()
  const etFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const todayET = etFormat.format(now)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayET = etFormat.format(yesterday)

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowET = etFormat.format(tomorrow)

  return { yesterdayET, todayET, tomorrowET }
}

function mapGameState(gameState) {
  if (!gameState) return 'FUT'
  const state = gameState.toUpperCase()
  if (state === 'OFF' || state === 'FINAL') return 'FINAL'
  if (state === 'LIVE' || state === 'CRIT') return 'LIVE'
  return 'FUT'
}

function formatStartTime(utcString) {
  if (!utcString) return ''
  try {
    const date = new Date(utcString)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function normalizePeriod(game) {
  const pd = game.periodDescriptor
  if (!pd) return null
  if (pd.periodType === 'OT') return 'OT'
  if (pd.periodType === 'SO') return 'SO'
  const num = pd.number
  if (num === 1) return '1st'
  if (num === 2) return '2nd'
  if (num === 3) return '3rd'
  if (num > 3) return 'OT'
  return null
}

function normalizeGame(game, dayLabel) {
  const status = mapGameState(game.gameState)
  return {
    id: game.id,
    dayLabel,
    status,
    awayTeam: {
      abbrev: game.awayTeam?.abbrev || '',
      logo: game.awayTeam?.logo.replace('_light', '_dark'),
      score: game.awayTeam?.score ?? null
    },
    homeTeam: {
      abbrev: game.homeTeam?.abbrev || '',
      logo: game.homeTeam?.logo.replace('_light', '_dark'),
      score: game.homeTeam?.score ?? null
    },
    periodDescriptor: normalizePeriod(game),
    clock: game.clock?.timeRemaining || null,
    inIntermission: game.clock?.inIntermission || false,
    startTimeLocal: formatStartTime(game.startTimeUTC)
  }
}

function normalizeScheduleGame(game, dayLabel) {
  return {
    id: game.id,
    dayLabel,
    status: 'FUT',
    awayTeam: {
      abbrev: game.awayTeam?.abbrev || '',
      logo: game.awayTeam?.logo.replace('_light', '_dark'),
      score: null
    },
    homeTeam: {
      abbrev: game.homeTeam?.abbrev || '',
      logo: game.homeTeam?.logo.replace('_light', '_dark'),
      score: null
    },
    periodDescriptor: null,
    clock: null,
    startTimeLocal: formatStartTime(game.startTimeUTC)
  }
}

export const useScoresStore = defineStore('scores', () => {
  const games = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const collapsed = ref(localStorage.getItem('ticker-collapsed') === 'true')

  let pollInterval = null

  const hasLiveGames = computed(() =>
    games.value.some(g => g.status === 'LIVE')
  )

  const yesterdayGames = computed(() =>
    games.value.filter(g => g.dayLabel === 'YESTERDAY')
  )

  const todayGames = computed(() =>
    games.value.filter(g => g.dayLabel === 'TODAY')
  )

  const tomorrowGames = computed(() =>
    games.value.filter(g => g.dayLabel === 'TOMORROW')
  )

  async function fetchAllGames() {
    loading.value = true
    error.value = null

    try {
      const { yesterdayET, tomorrowET } = getDateStrings()

      const [yesterdayRes, todayRes, tomorrowRes] = await Promise.allSettled([
        fetch(nhlUrl(`/v1/score/${yesterdayET}`)),
        fetch(nhlUrl('/v1/score/now')),
        fetch(nhlUrl(`/v1/schedule/${tomorrowET}`))
      ])

      const allGames = []

      // Yesterday
      if (yesterdayRes.status === 'fulfilled' && yesterdayRes.value.ok) {
        const data = await yesterdayRes.value.json()
        const normalized = (data.games || []).map(g => normalizeGame(g, 'YESTERDAY'))
        allGames.push(...normalized)
      }

      // Today
      if (todayRes.status === 'fulfilled' && todayRes.value.ok) {
        const data = await todayRes.value.json()
        const normalized = (data.games || []).map(g => normalizeGame(g, 'TODAY'))
        allGames.push(...normalized)
      }

      // Tomorrow (schedule endpoint has different structure)
      if (tomorrowRes.status === 'fulfilled' && tomorrowRes.value.ok) {
        const data = await tomorrowRes.value.json()
        const gameWeek = data.gameWeek || []
        const tomorrowDay = gameWeek.find(d => d.date === tomorrowET)
        if (tomorrowDay) {
          const normalized = (tomorrowDay.games || []).map(g => normalizeScheduleGame(g, 'TOMORROW'))
          allGames.push(...normalized)
        }
      }

      games.value = allGames
      lastUpdated.value = new Date()
    } catch (e) {
      error.value = 'Failed to load scores'
    } finally {
      loading.value = false
    }
  }

  function startPolling() {
    if (pollInterval) return
    fetchAllGames()
    pollInterval = setInterval(fetchAllGames, 60000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
    localStorage.setItem('ticker-collapsed', collapsed.value)
  }

  return {
    games,
    loading,
    error,
    lastUpdated,
    collapsed,
    hasLiveGames,
    yesterdayGames,
    todayGames,
    tomorrowGames,
    fetchAllGames,
    startPolling,
    stopPolling,
    toggleCollapsed
  }
})
