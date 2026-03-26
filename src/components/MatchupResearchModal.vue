<script setup>
import { ref, watch } from 'vue'
import { useResearchStore } from '../stores/research'

const props = defineProps({
  matchup: { type: Object, default: null },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const research = useResearchStore()
const data = ref(null)

function getLogoUrl(abbreviation) {
  return `https://assets.nhle.com/logos/nhl/svg/${abbreviation}_dark.svg`
}

watch(() => props.visible, async (show) => {
  if (show && props.matchup) {
    const homeAbbrev = props.matchup.team_home.abbreviation
    const awayAbbrev = props.matchup.team_away.abbreviation
    data.value = null
    data.value = await research.fetchMatchupResearch(homeAbbrev, awayAbbrev)
  }
})
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="research-modal">
      <button class="modal-close" @click="emit('close')">&times;</button>

      <div v-if="matchup" class="modal-header">
        <div class="header-team">
          <img :src="getLogoUrl(matchup.team_home.abbreviation)" :alt="matchup.team_home.abbreviation" class="header-logo" />
          <div class="header-team-info">
            <span class="header-abbrev">{{ matchup.team_home.abbreviation }}</span>
            <span v-if="data?.homeStanding" class="header-record">{{ data.homeStanding.record }} ({{ data.homeStanding.points }} pts)</span>
          </div>
        </div>
        <span class="header-vs">VS</span>
        <div class="header-team">
          <img :src="getLogoUrl(matchup.team_away.abbreviation)" :alt="matchup.team_away.abbreviation" class="header-logo" />
          <div class="header-team-info">
            <span class="header-abbrev">{{ matchup.team_away.abbreviation }}</span>
            <span v-if="data?.awayStanding" class="header-record">{{ data.awayStanding.record }} ({{ data.awayStanding.points }} pts)</span>
          </div>
        </div>
      </div>

      <div v-if="research.loading" class="loading-state">
        <div class="spinner"></div>
        <span>Loading research data...</span>
      </div>

      <div v-else-if="research.error" class="error-state">
        <p>{{ research.error }}</p>
        <button class="btn-retry" @click="data = null; research.fetchMatchupResearch(matchup.team_home.abbreviation, matchup.team_away.abbreviation).then(r => data = r)">Retry</button>
      </div>

      <div v-else-if="data" class="modal-body">
        <!-- Head to Head -->
        <section class="research-section">
          <h4 class="section-title">Season Series</h4>
          <div v-if="data.h2hGames.length > 0" class="h2h-summary">
            {{ matchup.team_home.abbreviation }} {{ data.h2hSummary.homeWins }}-{{ data.h2hSummary.awayWins }}<span v-if="data.h2hSummary.otLosses > 0">-{{ data.h2hSummary.otLosses }}</span> {{ matchup.team_away.abbreviation }}
          </div>
          <div v-if="data.h2hGames.length > 0" class="h2h-table">
            <div class="h2h-row h2h-header">
              <span class="h2h-date">Date</span>
              <span class="h2h-away">Away</span>
              <span class="h2h-score">Score</span>
              <span class="h2h-home">Home</span>
              <span class="h2h-extra"></span>
            </div>
            <div v-for="game in data.h2hGames" :key="game.rawDate" class="h2h-row">
              <span class="h2h-date">{{ game.date }}</span>
              <span class="h2h-away" :class="{ 'team-won': !game.homeWin }">{{ game.awayTeam }}</span>
              <span class="h2h-score">{{ game.awayScore }} - {{ game.homeScore }}</span>
              <span class="h2h-home" :class="{ 'team-won': game.homeWin }">{{ game.homeTeam }}</span>
              <span class="h2h-extra">{{ game.otso || '' }}</span>
            </div>
          </div>
          <div v-else class="no-data">No regular season matchups found</div>
        </section>

        <!-- Last 10 Games -->
        <section class="research-section">
          <h4 class="section-title">Last 10 Games</h4>
          <div class="last10-grid">
            <div class="last10-panel" v-for="team in [
              { abbrev: matchup.team_home.abbreviation, data: data.homeLast10 },
              { abbrev: matchup.team_away.abbreviation, data: data.awayLast10 }
            ]" :key="team.abbrev">
              <div class="last10-header">
                <img :src="getLogoUrl(team.abbrev)" :alt="team.abbrev" class="last10-logo" />
                <span class="last10-abbrev">{{ team.abbrev }}</span>
                <span class="last10-record">{{ team.data.record }}</span>
                <span class="last10-streak">{{ team.data.streak }}</span>
              </div>
              <div class="last10-games">
                <div v-for="game in team.data.games" :key="game.date + game.opponent" class="last10-row">
                  <span class="l10-date">{{ game.date }}</span>
                  <span class="l10-opp">{{ game.opponent }}</span>
                  <span class="l10-result" :class="{ win: game.result === 'W', loss: game.result === 'L', otl: game.result === 'OTL' }">{{ game.result }}</span>
                  <span class="l10-score">{{ game.score }}</span>
                  <span class="l10-extra">{{ game.otso || '' }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
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

.research-modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 620px;
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

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.header-team {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.header-team-info {
  display: flex;
  flex-direction: column;
}

.header-abbrev {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.header-record {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.header-vs {
  font-weight: 800;
  font-size: 0.8rem;
  color: var(--text-muted);
  letter-spacing: 2px;
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

/* Sections */
.research-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.no-data {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-style: italic;
}

/* H2H */
.h2h-summary {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  text-align: center;
}

.h2h-table {
  font-size: 0.8rem;
}

.h2h-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.h2h-header {
  font-weight: 700;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.h2h-date {
  width: 70px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.h2h-away, .h2h-home {
  width: 50px;
  text-align: center;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.h2h-score {
  flex: 1;
  text-align: center;
  font-weight: 700;
  color: var(--text-primary);
}

.h2h-extra {
  width: 30px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.7rem;
  flex-shrink: 0;
}

.team-won {
  color: var(--success) !important;
}

/* Last 10 */
.last10-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.last10-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.last10-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.last10-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.last10-abbrev {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.last10-record {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-left: auto;
}

.last10-streak {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
}

.last10-games {
  font-size: 0.75rem;
}

.last10-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.l10-date {
  width: 52px;
  color: var(--text-muted);
  flex-shrink: 0;
  font-size: 0.7rem;
}

.l10-opp {
  width: 32px;
  color: var(--text-secondary);
  font-weight: 600;
  flex-shrink: 0;
}

.l10-result {
  width: 28px;
  text-align: center;
  font-weight: 700;
  flex-shrink: 0;
}

.l10-result.win {
  color: var(--success);
}

.l10-result.loss {
  color: var(--danger);
}

.l10-result.otl {
  color: var(--text-secondary);
}

.l10-score {
  flex: 1;
  text-align: right;
  color: var(--text-secondary);
}

.l10-extra {
  width: 22px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.65rem;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .research-modal {
    padding: 16px;
    max-height: 90vh;
  }

  .header-logo {
    width: 36px;
    height: 36px;
  }

  .modal-header {
    gap: 12px;
  }

  .last10-grid {
    grid-template-columns: 1fr;
  }
}
</style>
