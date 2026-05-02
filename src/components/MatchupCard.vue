<script setup>
import { computed } from 'vue'
import { getLogoUrl } from '../lib/logos'

const props = defineProps({
  matchup: { type: Object, required: true },
  pick: { type: Object, default: null },
  canPick: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  locked: { type: Boolean, default: false }
})

const emit = defineEmits(['pick', 'research'])

const homeSelected = computed(() => props.pick?.team_id === props.matchup.team_home_id)
const awaySelected = computed(() => props.pick?.team_id === props.matchup.team_away_id)
const homeWon = computed(() => props.matchup.winner_id === props.matchup.team_home_id)
const awayWon = computed(() => props.matchup.winner_id === props.matchup.team_away_id)
const hasWinner = computed(() => props.matchup.winner_id != null)
const homeWrongPick = computed(() => homeSelected.value && hasWinner.value && !homeWon.value)
const awayWrongPick = computed(() => awaySelected.value && hasWinner.value && !awayWon.value)

function selectTeam(teamId) {
  if (props.canPick) {
    emit('pick', props.matchup.id, teamId)
  }
}

</script>

<template>
  <div class="matchup-card" :class="{ compact, locked }">
    <div v-if="locked" class="lock-badge" title="This series is locked">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    </div>
    <button
      v-if="canPick && matchup.team_home && matchup.team_away"
      class="research-btn"
      @click.stop="emit('research', matchup)"
      title="Research matchup"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="research-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </button>
    <div
      class="team-row"
      :class="{
        selected: homeSelected,
        'wrong-pick': homeWrongPick,
        winner: homeWon,
        loser: awayWon && !homeWon,
        pickable: canPick
      }"
      @click="selectTeam(matchup.team_home_id)"
    >
      <div class="team-info">
        <img
          :src="getLogoUrl(matchup.team_home.abbreviation)"
          :alt="matchup.team_home.abbreviation"
          class="team-logo"
          @error="$event.target.style.display='none'"
        />
        <div class="team-details">
          <span class="team-abbr">{{ matchup.team_home.abbreviation }}</span>
          <span v-if="matchup.seed_home" class="team-seed">({{ matchup.seed_home }})</span>
        </div>
      </div>
      <span class="series-wins">{{ matchup.series_home_wins }}</span>
    </div>

    <div
      class="team-row"
      :class="{
        selected: awaySelected,
        'wrong-pick': awayWrongPick,
        winner: awayWon,
        loser: homeWon && !awayWon,
        pickable: canPick
      }"
      @click="selectTeam(matchup.team_away_id)"
    >
      <div class="team-info">
        <img
          :src="getLogoUrl(matchup.team_away.abbreviation)"
          :alt="matchup.team_away.abbreviation"
          class="team-logo"
          @error="$event.target.style.display='none'"
        />
        <div class="team-details">
          <span class="team-abbr">{{ matchup.team_away.abbreviation }}</span>
          <span v-if="matchup.seed_away" class="team-seed">({{ matchup.seed_away }})</span>
        </div>
      </div>
      <span class="series-wins">{{ matchup.series_away_wins }}</span>
    </div>
  </div>
</template>

<style scoped>
.matchup-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: visible;
  width: 200px;
  flex-shrink: 0;
  position: relative;
}

.research-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 10;
  transition: color 0.2s, border-color 0.2s;
}

.research-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.research-icon {
  width: 12px;
  height: 12px;
}

.lock-badge {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.lock-icon {
  width: 12px;
  height: 12px;
}

.matchup-card.locked .team-row {
  cursor: not-allowed;
}

.matchup-card.compact {
  width: 170px;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0px 13px 0px 2px;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.team-row:first-child {
  border-bottom: 1px solid var(--border);
}

.team-row.pickable {
  cursor: pointer;
}

.team-row.pickable:hover {
  background: var(--bg-card-hover);
}

.team-row.selected {
  background: rgba(66, 165, 245, 0.15);
  border-left-color: #42a5f5;
}

.team-row.selected.winner {
  background: rgba(76, 175, 80, 0.15);
  border-left-color: #42a5f5;
}

.team-row.selected.wrong-pick {
  background: rgba(244, 67, 54, 0.15);
  border-left-color: #42a5f5;
}

.team-row.winner {
  background: rgba(76, 175, 80, 0.1);
}

.team-row.loser {
  opacity: 0.5;
}

.team-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.compact .team-logo {
  width: 44px;
  height: 44px;
}

.team-details {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.team-abbr {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.compact .team-abbr {
  font-size: 0.85rem;
}

.team-seed {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.series-wins {
  font-weight: 800;
  font-size: 1.2rem;
  color: var(--text-primary);
  min-width: 20px;
  text-align: center;
}

.compact .series-wins {
  font-size: 1rem;
}
</style>
