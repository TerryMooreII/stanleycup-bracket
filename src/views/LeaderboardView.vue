<script setup>
import { onMounted, ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

const users = ref([])
const allPicks = ref([])
const matchups = ref([])
const rounds = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const seasonRes = await supabase.from('seasons').select('*').eq('is_active', true).single()
    const seasonId = seasonRes.data?.id

    const [profilesRes, roundsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('rounds').select('*').eq('season_id', seasonId)
    ])
    rounds.value = roundsRes.data || []
    users.value = profilesRes.data || []

    const roundIds = rounds.value.map(r => r.id)
    const matchupsRes = await supabase.from('matchups').select('*').in('round_id', roundIds)
    matchups.value = matchupsRes.data || []

    const matchupIds = matchups.value.map(m => m.id)
    if (matchupIds.length > 0) {
      const picksRes = await supabase.from('picks').select('*').in('matchup_id', matchupIds)
      allPicks.value = picksRes.data || []
    }
  } catch (e) {
    console.error('Leaderboard fetch error:', e)
  } finally {
    loading.value = false
  }
})

const roundPointsMap = computed(() => {
  const map = {}
  rounds.value.forEach(r => { map[r.id] = r.points_per_correct ?? 1 })
  return map
})

const leaderboard = computed(() => {
  const decidedMatchups = matchups.value.filter(m => m.winner_id != null)
  const decidedMatchupIds = new Set(decidedMatchups.map(m => m.id))
  const winnerMap = {}
  const matchupRoundMap = {}
  matchups.value.forEach(m => {
    winnerMap[m.id] = m.winner_id
    matchupRoundMap[m.id] = m.round_id
  })

  // Find the final matchup's actual total goals for tiebreaker
  const finalRound = rounds.value.find(r => r.round_number === 4)
  const finalMatchup = finalRound
    ? matchups.value.find(m => m.round_id === finalRound.id && m.actual_total_goals != null)
    : null
  const actualGoals = finalMatchup?.actual_total_goals ?? null

  return users.value.map(user => {
    const userPicks = allPicks.value.filter(p => p.user_id === user.id)
    const totalPicks = userPicks.length
    let points = 0
    let correctPicks = 0
    let tiebreakerGoals = null
    userPicks.forEach(p => {
      if (decidedMatchupIds.has(p.matchup_id) && p.team_id === winnerMap[p.matchup_id]) {
        correctPicks++
        points += roundPointsMap.value[matchupRoundMap[p.matchup_id]] || 1
      }
      if (p.tiebreaker_goals != null) tiebreakerGoals = p.tiebreaker_goals
    })
    const pendingPicks = userPicks.filter(p => !decidedMatchupIds.has(p.matchup_id)).length

    // Tiebreaker diff: closest without going over. If over, use Infinity so they rank last among ties.
    let tiebreakerDiff = Infinity
    if (tiebreakerGoals != null && actualGoals != null) {
      tiebreakerDiff = tiebreakerGoals <= actualGoals
        ? actualGoals - tiebreakerGoals
        : Infinity
    }

    return {
      id: user.id,
      name: user.display_name || 'Unknown',
      points,
      correct: correctPicks,
      total: totalPicks,
      pending: pendingPicks,
      tiebreakerGoals,
      tiebreakerDiff
    }
  }).sort((a, b) => b.points - a.points || a.tiebreakerDiff - b.tiebreakerDiff || b.correct - a.correct || a.name.localeCompare(b.name))
})
</script>

<template>
  <div class="leaderboard-page">
    <h1>Leaderboard</h1>

    <div v-if="loading" class="loading">Loading...</div>

    <table v-else-if="leaderboard.length > 0" class="lb-table">
      <thead>
        <tr>
          <th class="rank-col">#</th>
          <th>Player</th>
          <th class="num-col">Points</th>
          <th class="num-col">Correct</th>
          <th class="num-col">Pending</th>
          <th class="num-col">Total Picks</th>
          <th class="num-col">Tiebreaker</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, idx) in leaderboard" :key="entry.id" :class="{ 'top-3': idx < 3 }">
          <td class="rank-col">
            <span v-if="idx === 0" class="medal gold">1</span>
            <span v-else-if="idx === 1" class="medal silver">2</span>
            <span v-else-if="idx === 2" class="medal bronze">3</span>
            <span v-else>{{ idx + 1 }}</span>
          </td>
          <td class="player-name">{{ entry.name }}</td>
          <td class="num-col points">{{ entry.points }}</td>
          <td class="num-col correct">{{ entry.correct }}</td>
          <td class="num-col pending">{{ entry.pending }}</td>
          <td class="num-col">{{ entry.total }}</td>
          <td class="num-col tiebreaker">{{ entry.tiebreakerGoals ?? '—' }}</td>
        </tr>
      </tbody>
    </table>

    <div v-else class="empty-state">
      No picks have been made yet. Be the first!
    </div>
  </div>
</template>

<style scoped>
.leaderboard-page {
  max-width: 700px;
  margin: 0 auto;
}

h1 {
  font-size: 1.6rem;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.loading, .empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.lb-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

thead {
  background: var(--bg-secondary);
}

th {
  padding: 12px 16px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: left;
}

td {
  padding: 14px 16px;
  font-size: 0.95rem;
  color: var(--text-primary);
  border-top: 1px solid var(--border);
}

.rank-col {
  width: 50px;
  text-align: center;
}

.num-col {
  width: 100px;
  text-align: center;
}

.player-name {
  font-weight: 600;
}

.points {
  color: var(--accent);
  font-weight: 800;
  font-size: 1.05rem;
}

.correct {
  color: var(--success);
  font-weight: 700;
}

.pending {
  color: var(--text-muted);
}

.tiebreaker {
  color: var(--text-secondary);
  font-style: italic;
}

.medal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.85rem;
}

.gold { background: #c9a84c; color: #1a1a2e; }
.silver { background: #a0a0b0; color: #1a1a2e; }
.bronze { background: #cd7f32; color: #1a1a2e; }

.top-3 td {
  background: rgba(201, 168, 76, 0.05);
}

@media (max-width: 500px) {
  th, td {
    padding: 10px 8px;
    font-size: 0.85rem;
  }
  .num-col {
    width: 70px;
  }
}
</style>
