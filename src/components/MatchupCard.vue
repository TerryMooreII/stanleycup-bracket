<script setup>
import { computed } from 'vue'

const props = defineProps({
  matchup: { type: Object, required: true },
  pick: { type: Object, default: null },
  canPick: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['pick'])

const homeSelected = computed(() => props.pick?.team_id === props.matchup.team_home_id)
const awaySelected = computed(() => props.pick?.team_id === props.matchup.team_away_id)
const homeWon = computed(() => props.matchup.winner_id === props.matchup.team_home_id)
const awayWon = computed(() => props.matchup.winner_id === props.matchup.team_away_id)

function selectTeam(teamId) {
  if (props.canPick) {
    emit('pick', props.matchup.id, teamId)
  }
}

function getLogoUrl(abbreviation) {
  return `https://assets.nhle.com/logos/nhl/svg/${abbreviation}_dark.svg`
}
</script>

<template>
  <div class="matchup-card" :class="{ compact }">
    <div
      class="team-row"
      :class="{
        selected: homeSelected,
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
  overflow: hidden;
  width: 200px;
  flex-shrink: 0;
}

.matchup-card.compact {
  width: 170px;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
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
  background: rgba(76, 175, 80, 0.15);
  border-left-color: var(--picked-border);
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
