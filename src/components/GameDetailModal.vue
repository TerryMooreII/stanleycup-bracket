<script setup>
import { ref, watch } from 'vue'
import { nhlUrl } from '../lib/nhlApi'
import { useBracketStore } from '../stores/bracket'

const bracket = useBracketStore()

function getTeamColor(abbrev) {
  const team = bracket.teams.find(t => t.abbreviation === abbrev)
  return team?.primary_color || null
}

const props = defineProps({
  gameId: { type: Number, default: null },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref(null)
const data = ref(null)
const cache = {}

async function fetchGameData(id) {
  if (!id) return

  // Cache final games only
  if (cache[id]) {
    data.value = cache[id]
    return
  }

  loading.value = true
  error.value = null
  data.value = null

  try {
    const [landingRes, boxscoreRes] = await Promise.allSettled([
      fetch(nhlUrl(`/v1/gamecenter/${id}/landing`)),
      fetch(nhlUrl(`/v1/gamecenter/${id}/boxscore`))
    ])

    const landing = landingRes.status === 'fulfilled' && landingRes.value.ok
      ? await landingRes.value.json() : null
    const boxscore = boxscoreRes.status === 'fulfilled' && boxscoreRes.value.ok
      ? await boxscoreRes.value.json() : null

    if (!landing && !boxscore) {
      error.value = 'Failed to load game data'
      return
    }

    const source = landing || boxscore
    const gameState = source.gameState?.toUpperCase()
    const isFinal = gameState === 'OFF' || gameState === 'FINAL'
    const periodType = source.periodDescriptor?.periodType

    const result = {
      awayTeam: {
        abbrev: source.awayTeam?.abbrev || '',
        logo: source.awayTeam?.darkLogo || source.awayTeam?.logo || '',
        score: source.awayTeam?.score ?? 0,
        sog: source.awayTeam?.sog ?? null,
        color: getTeamColor(source.awayTeam?.abbrev) || '#999999'
      },
      homeTeam: {
        abbrev: source.homeTeam?.abbrev || '',
        logo: source.homeTeam?.darkLogo || source.homeTeam?.logo || '',
        score: source.homeTeam?.score ?? 0,
        sog: source.homeTeam?.sog ?? null,
        color: getTeamColor(source.homeTeam?.abbrev) || '#999999'
      },
      status: isFinal ? 'FINAL' : 'LIVE',
      statusLabel: isFinal
        ? (periodType === 'OT' ? 'Final/OT' : periodType === 'SO' ? 'Final/SO' : 'Final')
        : `${source.periodDescriptor?.number || ''}${ordinal(source.periodDescriptor?.number)} - ${source.clock?.timeRemaining || ''}`,
      gameDate: source.gameDate || '',
      venue: source.venue?.default || '',
      scoring: [],
      threeStars: [],
      goalies: [],
      penalties: []
    }

    // Scoring summary from landing
    if (landing?.summary?.scoring) {
      for (const period of landing.summary.scoring) {
        const periodLabel = period.periodDescriptor?.periodType === 'OT' ? 'OT'
          : period.periodDescriptor?.periodType === 'SO' ? 'SO'
          : `Period ${period.periodDescriptor?.number || '?'}`

        const goals = (period.goals || []).map(g => ({
          time: g.timeInPeriod || '',
          scorer: g.firstName?.default ? `${g.firstName.default} ${g.lastName?.default || ''}` : g.name?.default || '',
          headshot: g.headshot || '',
          teamAbbrev: g.teamAbbrev?.default || g.teamAbbrev || '',
          assists: (g.assists || []).map(a =>
            a.firstName?.default ? `${a.firstName.default} ${a.lastName?.default || ''}` : a.name?.default || ''
          ),
          strength: g.strength || 'ev',
          awayScore: g.awayScore,
          homeScore: g.homeScore,
          goalsToDate: g.goalsToDate
        }))

        if (goals.length > 0) {
          result.scoring.push({ label: periodLabel, goals })
        }
      }
    }

    // Three stars from landing
    if (landing?.summary?.threeStars) {
      result.threeStars = landing.summary.threeStars.map(s => ({
        star: s.star,
        name: s.name?.default || '',
        headshot: s.headshot || '',
        teamAbbrev: s.teamAbbrev?.default || s.teamAbbrev || '',
        position: s.position || '',
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        points: s.points ?? 0,
        sweaterNo: s.sweaterNo || ''
      })).sort((a, b) => a.star - b.star)
    }

    // Goalie stats from boxscore
    if (boxscore?.playerByGameStats) {
      const extractGoalies = (teamData, teamAbbrev) => {
        return (teamData?.goalies || []).map(g => ({
          name: g.name?.default || '',
          teamAbbrev,
          saveShotsAgainst: g.saveShotsAgainst || '',
          savePctg: g.savePctg != null ? (g.savePctg * 100).toFixed(1) + '%' : '',
          decision: g.decision || '',
          toi: g.toi || '',
          starter: g.starter || false
        }))
      }
      const awayGoalies = extractGoalies(boxscore.playerByGameStats.awayTeam, result.awayTeam.abbrev)
      const homeGoalies = extractGoalies(boxscore.playerByGameStats.homeTeam, result.homeTeam.abbrev)
      result.goalies = [...awayGoalies, ...homeGoalies]
    }

    // Penalties from landing
    if (landing?.summary?.penalties) {
      for (const period of landing.summary.penalties) {
        const periodLabel = period.periodDescriptor?.periodType === 'OT' ? 'OT'
          : `Period ${period.periodDescriptor?.number || '?'}`

        const pens = (period.penalties || []).map(p => ({
          time: p.timeInPeriod || '',
          player: p.committedByPlayer
            ? `${p.committedByPlayer.firstName?.default || ''} ${p.committedByPlayer.lastName?.default || ''}`
            : '',
          teamAbbrev: p.teamAbbrev?.default || p.teamAbbrev || '',
          infraction: (p.descKey || '').replace(/-/g, ' '),
          duration: p.duration || 2,
          type: p.type || 'MIN'
        }))

        if (pens.length > 0) {
          result.penalties.push({ label: periodLabel, penalties: pens })
        }
      }
    }

    data.value = result

    // Cache only final games
    if (isFinal) {
      cache[id] = result
    }
  } catch (e) {
    error.value = 'Failed to load game data'
  } finally {
    loading.value = false
  }
}

function ordinal(n) {
  if (!n) return ''
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function decisionLabel(d) {
  if (d === 'W') return 'WIN'
  if (d === 'L') return 'LOSS'
  if (d === 'O') return 'OTL'
  return ''
}

watch(() => props.visible, (show) => {
  if (show && props.gameId) {
    fetchGameData(props.gameId)
  }
})
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="game-modal">
      <button class="modal-close" @click="emit('close')">&times;</button>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>Loading game data...</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button class="btn-retry" @click="fetchGameData(gameId)">Retry</button>
      </div>

      <!-- Game Data -->
      <template v-else-if="data">
        <!-- Header: Score -->
        <div class="game-header">
          <div class="header-team">
            <img :src="data.awayTeam.logo" :alt="data.awayTeam.abbrev" class="header-logo" />
            <span class="header-abbrev">{{ data.awayTeam.abbrev }}</span>
            <span class="header-score">{{ data.awayTeam.score }}</span>
          </div>
          <div class="header-center">
            <span class="header-status">{{ data.statusLabel }}</span>
            <span class="header-meta">{{ formatDate(data.gameDate) }}<template v-if="data.venue"> &middot; {{ data.venue }}</template></span>
          </div>
          <div class="header-team">
            <span class="header-score">{{ data.homeTeam.score }}</span>
            <span class="header-abbrev">{{ data.homeTeam.abbrev }}</span>
            <img :src="data.homeTeam.logo" :alt="data.homeTeam.abbrev" class="header-logo" />
          </div>
        </div>

        <!-- SOG -->
        <div v-if="data.awayTeam.sog != null && data.homeTeam.sog != null" class="sog-bar">
          <span class="sog-val">{{ data.awayTeam.sog }}</span>
          <div class="sog-track">
            <div class="sog-fill sog-away" :style="{ width: (data.awayTeam.sog / Math.max(data.awayTeam.sog + data.homeTeam.sog, 1) * 100) + '%', background: data.awayTeam.color }"></div>
            <div class="sog-fill sog-home" :style="{ width: (data.homeTeam.sog / Math.max(data.awayTeam.sog + data.homeTeam.sog, 1) * 100) + '%', background: data.homeTeam.color }"></div>
          </div>
          <span class="sog-val">{{ data.homeTeam.sog }}</span>
          <span class="sog-label">SOG</span>
        </div>

        <!-- Scoring Summary -->
        <section v-if="data.scoring.length > 0" class="game-section">
          <h4 class="section-title">Scoring</h4>
          <div v-for="period in data.scoring" :key="period.label" class="period-block">
            <div class="period-label">{{ period.label }}</div>
            <div v-for="(goal, i) in period.goals" :key="i" class="goal-row">
              <img v-if="goal.headshot" :src="goal.headshot" class="goal-headshot" loading="lazy" />
              <div class="goal-info">
                <div class="goal-scorer">
                  <span class="goal-team">{{ goal.teamAbbrev }}</span>
                  {{ goal.scorer }}
                  <span v-if="goal.goalsToDate" class="goals-count">({{ goal.goalsToDate }})</span>
                  <span v-if="goal.strength !== 'ev'" class="goal-strength" :class="goal.strength">{{ goal.strength.toUpperCase() }}</span>
                </div>
                <div v-if="goal.assists.length > 0" class="goal-assists">
                  {{ goal.assists.join(', ') }}
                </div>
              </div>
              <div class="goal-time">
                <span class="goal-clock">{{ goal.time }}</span>
                <span class="goal-score-after">{{ goal.awayScore }}-{{ goal.homeScore }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Three Stars -->
        <section v-if="data.threeStars.length > 0" class="game-section">
          <h4 class="section-title">Three Stars</h4>
          <div class="stars-row">
            <div v-for="star in data.threeStars" :key="star.star" class="star-card">
              <img v-if="star.headshot" :src="star.headshot" class="star-headshot" loading="lazy" />
              <div class="star-info">
                <span class="star-number">{{ star.star === 1 ? '\u2605' : star.star === 2 ? '\u2605\u2605' : '\u2605\u2605\u2605' }}</span>
                <span class="star-name">{{ star.name }}</span>
                <span class="star-team">{{ star.teamAbbrev }}</span>
                <span class="star-stats">{{ star.goals }}G {{ star.assists }}A</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Goalies -->
        <section v-if="data.goalies.length > 0" class="game-section">
          <h4 class="section-title">Goaltending</h4>
          <div class="goalies-grid">
            <div v-for="g in data.goalies" :key="g.name + g.teamAbbrev" class="goalie-row">
              <span class="goalie-team">{{ g.teamAbbrev }}</span>
              <span class="goalie-name">{{ g.name }}</span>
              <span class="goalie-saves">{{ g.saveShotsAgainst }}</span>
              <span class="goalie-pct">{{ g.savePctg }}</span>
              <span v-if="g.decision" class="goalie-decision" :class="g.decision.toLowerCase()">{{ decisionLabel(g.decision) }}</span>
            </div>
          </div>
        </section>

        <!-- Penalties -->
        <section v-if="data.penalties.length > 0" class="game-section">
          <h4 class="section-title">Penalties</h4>
          <div v-for="period in data.penalties" :key="period.label" class="period-block">
            <div class="period-label">{{ period.label }}</div>
            <div v-for="(pen, i) in period.penalties" :key="i" class="penalty-row">
              <span class="pen-team">{{ pen.teamAbbrev }}</span>
              <span class="pen-player">{{ pen.player }}</span>
              <span class="pen-infraction">{{ pen.infraction }}</span>
              <span class="pen-duration">{{ pen.duration }}:00</span>
              <span class="pen-time">{{ pen.time }}</span>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.game-modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 600px;
  margin: 20px;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.6rem;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
}

.modal-close:hover {
  color: var(--text-primary);
}

/* Loading / Error */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 30px 0;
  color: var(--danger);
  font-size: 0.9rem;
}

.btn-retry {
  margin-top: 12px;
  padding: 8px 20px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-retry:hover {
  border-color: var(--text-secondary);
}

/* Header */
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.header-team {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-logo {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.header-abbrev {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
}

.header-score {
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--accent);
}

.header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.header-status {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.header-meta {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-align: center;
}

/* SOG Bar */
.sog-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border-radius: 6px;
}

.sog-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 24px;
  text-align: center;
}

.sog-track {
  flex: 1;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}

.sog-fill {
  height: 100%;
  transition: width 0.3s;
}

.sog-away {
  border-radius: 4px 0 0 4px;
}

.sog-home {
  border-radius: 0 4px 4px 0;
}

.sog-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Sections */
.game-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.period-block {
  margin-bottom: 8px;
}

.period-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

/* Goals */
.goal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.goal-headshot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.goal-info {
  flex: 1;
  min-width: 0;
}

.goal-scorer {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.goal-team {
  font-weight: 700;
  color: var(--text-secondary);
  margin-right: 4px;
}

.goals-count {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.goal-strength {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
}

.goal-strength.pp {
  background: rgba(33, 150, 243, 0.15);
  color: var(--info);
}

.goal-strength.sh {
  background: rgba(244, 67, 54, 0.15);
  color: var(--danger);
}

.goal-assists {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.goal-time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.goal-clock {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.goal-score-after {
  font-size: 0.65rem;
  color: var(--text-muted);
}

/* Three Stars */
.stars-row {
  display: flex;
  gap: 10px;
}

.star-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
}

.star-headshot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.star-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.star-number {
  font-size: 0.6rem;
  color: var(--accent);
  line-height: 1;
}

.star-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.star-team {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.star-stats {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-secondary);
}

/* Goalies */
.goalies-grid {
  font-size: 0.8rem;
}

.goalie-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.goalie-team {
  font-weight: 700;
  color: var(--text-secondary);
  width: 36px;
  flex-shrink: 0;
}

.goalie-name {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
}

.goalie-saves {
  color: var(--text-secondary);
  font-weight: 600;
}

.goalie-pct {
  color: var(--text-primary);
  font-weight: 700;
  width: 48px;
  text-align: right;
}

.goalie-decision {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  width: 36px;
  text-align: center;
}

.goalie-decision.w {
  background: rgba(76, 175, 80, 0.15);
  color: var(--success);
}

.goalie-decision.l {
  background: rgba(244, 67, 54, 0.15);
  color: var(--danger);
}

.goalie-decision.o {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
}

/* Penalties */
.penalty-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.75rem;
}

.pen-team {
  font-weight: 700;
  color: var(--text-secondary);
  width: 36px;
  flex-shrink: 0;
}

.pen-player {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pen-infraction {
  flex: 1;
  color: var(--text-muted);
  text-transform: capitalize;
}

.pen-duration {
  color: var(--text-secondary);
  font-weight: 600;
  flex-shrink: 0;
}

.pen-time {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 40px;
  text-align: right;
}

@media (max-width: 768px) {
  .game-modal {
    padding: 16px;
    max-height: 90vh;
  }

  .header-logo {
    width: 32px;
    height: 32px;
  }

  .header-score {
    font-size: 1.2rem;
  }

  .stars-row {
    flex-direction: column;
  }

  .penalty-row {
    flex-wrap: wrap;
  }
}
</style>
