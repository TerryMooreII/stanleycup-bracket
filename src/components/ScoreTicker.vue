<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useScoresStore } from '../stores/scores'
import GameDetailModal from './GameDetailModal.vue'

const scores = useScoresStore()
const trackRef = ref(null)
const selectedGameId = ref(null)
const showGameDetail = ref(false)

function openGame(game) {
  if (game.status === 'FUT') return
  selectedGameId.value = game.id
  showGameDetail.value = true
}

function closeGame() {
  showGameDetail.value = false
}

const sections = computed(() => [
  { label: 'YESTERDAY', games: scores.yesterdayGames },
  { label: 'TODAY', games: scores.todayGames },
  { label: 'TOMORROW', games: scores.tomorrowGames }
])

function scrollLeft() {
  if (trackRef.value) {
    trackRef.value.scrollBy({ left: -200, behavior: 'smooth' })
  }
}

function scrollRight() {
  if (trackRef.value) {
    trackRef.value.scrollBy({ left: 200, behavior: 'smooth' })
  }
}

onMounted(() => scores.startPolling())
onUnmounted(() => scores.stopPolling())
</script>

<template>
  <div v-if="scores.games.length > 0 || scores.loading" class="score-ticker" :class="{ collapsed: scores.collapsed }">
    <button class="ticker-toggle" @click="scores.toggleCollapsed()" :aria-label="scores.collapsed ? 'Expand scores' : 'Collapse scores'">
      <span class="toggle-icon">{{ scores.collapsed ? '\u25B2' : '\u25BC' }}</span>
      <span class="toggle-label">NHL Scores</span>
      <span v-if="scores.hasLiveGames" class="live-dot"></span>
    </button>

    <div v-show="!scores.collapsed" class="ticker-bar">
      <button class="arrow arrow-left" @click="scrollLeft" aria-label="Scroll left">&lsaquo;</button>

      <div class="ticker-track" ref="trackRef">
        <template v-for="section in sections" :key="section.label">
          <div class="day-separator">{{ section.label }}</div>
          <div v-if="section.games.length === 0" class="no-games">No games</div>
          <div v-for="game in section.games" :key="game.id" class="game-item" :class="{ clickable: game.status !== 'FUT' }" @click="openGame(game)">
            <div class="game-teams">
              <div class="team-line">
                <img :src="game.awayTeam.logo" class="ticker-logo" :alt="game.awayTeam.abbrev" loading="lazy" />
                <span class="ticker-abbrev">{{ game.awayTeam.abbrev }}</span>
                <span v-if="game.status !== 'FUT'" class="ticker-score" :class="{ winner: game.status === 'FINAL' && game.awayTeam.score > game.homeTeam.score }">{{ game.awayTeam.score }}</span>
              </div>
              <div class="team-line">
                <img :src="game.homeTeam.logo" class="ticker-logo" :alt="game.homeTeam.abbrev" loading="lazy" />
                <span class="ticker-abbrev">{{ game.homeTeam.abbrev }}</span>
                <span v-if="game.status !== 'FUT'" class="ticker-score" :class="{ winner: game.status === 'FINAL' && game.homeTeam.score > game.awayTeam.score }">{{ game.homeTeam.score }}</span>
              </div>
            </div>
            <div class="game-status">
              <span v-if="game.status === 'LIVE'" class="status-live status-live-stacked">
                <span class="status-period">{{ game.inIntermission ? game.periodDescriptor + ' INT' : game.periodDescriptor }}</span>
                <span class="status-clock">{{ game.clock }}</span>
              </span>
              <span v-else-if="game.status === 'FINAL'" class="status-final">
                {{ game.periodDescriptor === 'OT' || game.periodDescriptor === 'SO' ? 'F/' + game.periodDescriptor : 'Final' }}
              </span>
              <span v-else class="status-future">
                {{ game.startTimeLocal }}
              </span>
            </div>
          </div>
        </template>
      </div>

      <button class="arrow arrow-right" @click="scrollRight" aria-label="Scroll right">&rsaquo;</button>
    </div>

    <GameDetailModal
      :game-id="selectedGameId"
      :visible="showGameDetail"
      @close="closeGame"
    />
  </div>
</template>

<style scoped>
.score-ticker {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 150;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}

.ticker-toggle {
  position: absolute;
  bottom: 100%;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  padding: 4px 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.2s;
  font-family: inherit;
  margin-bottom: -1px;
}

.ticker-toggle:hover {
  color: var(--text-primary);
}

.toggle-icon {
  font-size: 0.6rem;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4caf50;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ticker-bar {
  display: flex;
  align-items: center;
  height: 52px;
}

.arrow {
  flex-shrink: 0;
  width: 32px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  font-size: 1.4rem;
  font-family: inherit;
  transition: color 0.2s, background 0.2s;
  user-select: none;
}

.arrow:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.arrow-left {
  border-right: 1px solid var(--border);
}

.arrow-right {
  border-left: 1px solid var(--border);
}

.ticker-track {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  height: 52px;
  white-space: nowrap;
  scrollbar-width: none;
}

.ticker-track::-webkit-scrollbar {
  display: none;
}

.day-separator {
  padding: 0 16px;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-left: 2px solid var(--border);
  line-height: 52px;
  flex-shrink: 0;
}

.no-games {
  padding: 0 16px;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
  line-height: 52px;
  flex-shrink: 0;
}

.game-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 14px;
  border-left: 1px solid var(--border);
  height: 52px;
  flex-shrink: 0;
  transition: background 0.2s;
}

.game-item.clickable {
  cursor: pointer;
}

.game-item.clickable:hover {
  background: var(--bg-card);
}

.game-teams {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.team-line {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ticker-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.ticker-abbrev {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  width: 28px;
}

.ticker-score {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  width: 16px;
  text-align: right;
}

.ticker-score.winner {
  color: var(--accent);
}

.game-status {
  font-size: 0.65rem;
  text-align: center;
  min-width: 40px;
}

.status-live {
  color: var(--text-secondary);
  font-weight: 700;
}

.status-live-stacked {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.status-clock {
  font-size: 0.6rem;
}

.status-final {
  color: var(--text-muted);
  font-weight: 500;
}

.status-future {
  color: var(--text-secondary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .ticker-toggle {
    right: 10px;
  }
  .game-item {
    padding: 4px 10px;
  }
}
</style>
