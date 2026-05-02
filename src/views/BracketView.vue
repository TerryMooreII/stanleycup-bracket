<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useBracketStore } from '../stores/bracket'
import { useRoute } from 'vue-router'
import MatchupCard from '../components/MatchupCard.vue'
import EmptyMatchupCard from '../components/EmptyMatchupCard.vue'
import MatchupResearchModal from '../components/MatchupResearchModal.vue'
import ZamboniLoader from '../components/ui/ZamboniLoader.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import cupLogo from '../assets/stanleycup.png'

const auth = useAuthStore()
const bracket = useBracketStore()
const route = useRoute()

// Help modal
const showHelp = ref(false)

// Research modal state
const showResearch = ref(false)
const researchMatchup = ref(null)

function handleResearch(matchup) {
  researchMatchup.value = matchup
  showResearch.value = true
}

function closeResearch() {
  showResearch.value = false
}

// Tiebreaker state for the final round
const showTiebreaker = ref(false)
const tiebreakerMatchupId = ref(null)
const tiebreakerTeamId = ref(null)
const tiebreakerGoals = ref('')
const tiebreakerError = ref('')
const takenGoals = ref([])

import { supabase } from '../lib/supabase'

async function fetchTakenGoals(matchupId) {
  const { data } = await supabase
    .from('picks')
    .select('tiebreaker_goals, user_id')
    .eq('matchup_id', matchupId)
    .not('tiebreaker_goals', 'is', null)
  // Exclude current user's own pick
  takenGoals.value = (data || [])
    .filter(p => p.user_id !== auth.user?.id)
    .map(p => p.tiebreaker_goals)
}

async function loadSeason() {
  const year = Number(route.params.year)
  await bracket.fetchAll(auth.user?.id, year || null)
}

onMounted(loadSeason)
watch(() => route.params.year, loadSeason)

const rounds = computed(() => bracket.rounds)

function getRoundMatchups(roundNumber, conference) {
  const round = rounds.value.find(r => r.round_number === roundNumber)
  if (!round) return []
  return bracket.getMatchupsForRound(round.id, conference)
}

function getExpectedMatchups(roundNumber) {
  if (roundNumber === 1) return 4
  if (roundNumber === 2) return 2
  if (roundNumber === 3) return 1
  if (roundNumber === 4) return 1
  return 0
}

function getRoundSlots(roundNumber, conference) {
  const expected = getExpectedMatchups(roundNumber)
  const slots = new Array(expected).fill(null)
  for (const m of getRoundMatchups(roundNumber, conference)) {
    const pos = m.bracket_position
    if (pos >= 1 && pos <= expected && slots[pos - 1] === null) {
      slots[pos - 1] = m
    } else {
      const emptyIdx = slots.findIndex(s => s === null)
      if (emptyIdx !== -1) slots[emptyIdx] = m
    }
  }
  return slots
}

function canPickRound(roundNumber) {
  if (!auth.isLoggedIn) return false
  if (!bracket.isViewingCurrentSeason) return false
  const round = rounds.value.find(r => r.round_number === roundNumber)
  if (!round || !round.is_active) return false
  return !bracket.isDeadlinePassed(round.id)
}

function canPickMatchup(matchup) {
  if (!matchup) return false
  if (matchup.is_locked) return false
  const round = rounds.value.find(r => r.id === matchup.round_id)
  if (!round) return false
  return canPickRound(round.round_number)
}

function showLockIcon(matchup) {
  if (!matchup?.is_locked) return false
  return !bracket.isDeadlinePassed(matchup.round_id)
}

function getDeadline(roundNumber) {
  const round = rounds.value.find(r => r.round_number === roundNumber)
  if (!round?.pick_deadline) return null
  return new Date(round.pick_deadline)
}

function formatDeadline(date) {
  if (!date) return ''
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true
  })
}

function isFinalMatchup(matchupId) {
  const matchup = bracket.matchups.find(m => m.id === matchupId)
  if (!matchup) return false
  const round = bracket.rounds.find(r => r.id === matchup.round_id)
  return round?.round_number === 4
}

async function handlePick(matchupId, teamId) {
  try {
    if (isFinalMatchup(matchupId)) {
      // Check if clicking the same team to deselect
      const existing = bracket.getPickForMatchup(matchupId)
      if (existing?.team_id === teamId) {
        await bracket.makePick(matchupId, teamId, auth.user.id)
        return
      }
      // Show tiebreaker modal
      tiebreakerMatchupId.value = matchupId
      tiebreakerTeamId.value = teamId
      tiebreakerGoals.value = existing?.tiebreaker_goals || ''
      tiebreakerError.value = ''
      await fetchTakenGoals(matchupId)
      showTiebreaker.value = true
      return
    }
    await bracket.makePick(matchupId, teamId, auth.user.id)
  } catch (e) {
    alert(e.message)
  }
}

async function submitTiebreaker() {
  const goals = parseInt(tiebreakerGoals.value)
  if (isNaN(goals) || goals < 1) {
    tiebreakerError.value = 'Please enter a valid number of goals'
    return
  }
  if (takenGoals.value.includes(goals)) {
    tiebreakerError.value = `${goals} is already taken. Please choose a different number.`
    return
  }
  tiebreakerError.value = ''
  try {
    await bracket.makePick(tiebreakerMatchupId.value, tiebreakerTeamId.value, auth.user.id, goals)
    showTiebreaker.value = false
  } catch (e) {
    if (e.message?.includes('unique') || e.code === '23505') {
      tiebreakerError.value = `${goals} was just taken by another user. Please choose a different number.`
      await fetchTakenGoals(tiebreakerMatchupId.value)
    } else {
      tiebreakerError.value = e.message
    }
  }
}

function cancelTiebreaker() {
  showTiebreaker.value = false
}

function getRoundLabel(roundNumber) {
  if (roundNumber === 1) return 'R1'
  if (roundNumber === 2) return 'R2'
  if (roundNumber === 3) return 'CF'
  if (roundNumber === 4) return 'SCF'
  return ''
}
</script>

<template>
  <div class="bracket-container">
    <ZamboniLoader v-if="bracket.loading" message="Loading bracket..." />

    <template v-else>
      <!-- Pick deadline banner -->
      <div v-for="round in rounds" :key="'deadline-' + round.id">
        <div v-if="round.is_active && getDeadline(round.round_number) && !bracket.isDeadlinePassed(round.id)" class="deadline-banner">
          <span class="deadline-label">{{ round.name }} picks due:</span>
          <span class="deadline-time">{{ formatDeadline(getDeadline(round.round_number)) }}</span>
        </div>
      </div>

      <div v-if="!auth.isLoggedIn" class="login-prompt">
        <router-link to="/login">Sign in</router-link> to make your picks!
      </div>

      <button class="help-btn" @click="showHelp = true" title="Pick legend">?</button>

      <!-- Help modal -->
      <BaseModal v-model:modelValue="showHelp" title="Pick Legend" size="sm">
        <div class="help-example">
          <div class="help-label">Your pick (no result yet)</div>
          <div class="help-matchup">
            <div class="help-team selected-example">COL</div>
            <div class="help-team">NSH</div>
          </div>
        </div>

        <div class="help-example">
          <div class="help-label">Correct pick</div>
          <div class="help-matchup">
            <div class="help-team correct-example">COL</div>
            <div class="help-team loser-example">NSH</div>
          </div>
        </div>

        <div class="help-example">
          <div class="help-label">Wrong pick</div>
          <div class="help-matchup">
            <div class="help-team wrong-example">COL</div>
            <div class="help-team winner-example">NSH</div>
          </div>
        </div>
      </BaseModal>

      <!-- Desktop bracket layout -->
      <div class="bracket-grid">
        <!-- Western Conference -->
        <div class="conference western">
          <!-- Round 1 West -->
          <div class="round round-1">
            <div class="round-label">{{ getRoundLabel(1) }}</div>
            <div class="round-matchups">
              <template v-for="(matchup, i) in getRoundSlots(1, 'Western')" :key="matchup ? matchup.id : 'empty-w1-' + i">
                <MatchupCard
                  v-if="matchup"
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
                <EmptyMatchupCard v-else />
              </template>
            </div>
          </div>

          <!-- Round 2 West -->
          <div class="round round-2">
            <div class="round-label">{{ getRoundLabel(2) }}</div>
            <div class="round-matchups">
              <template v-for="(matchup, i) in getRoundSlots(2, 'Western')" :key="matchup ? matchup.id : 'empty-w2-' + i">
                <MatchupCard
                  v-if="matchup"
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
                <EmptyMatchupCard v-else />
              </template>
            </div>
          </div>

          <!-- Conference Final West -->
          <div class="round round-cf">
            <div class="round-label">CF</div>
            <div class="round-matchups cf-matchups">
              <div class="cf-label">WESTERN<br/><span>CONFERENCE FINAL</span></div>
              <template v-for="matchup in getRoundMatchups(3, 'Western')" :key="matchup.id">
                <MatchupCard
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
              </template>
              <EmptyMatchupCard
                v-if="getRoundMatchups(3, 'Western').length === 0"
              />
            </div>
          </div>
        </div>

        <!-- Stanley Cup Final -->
        <div class="cup-center">
          <img :src="cupLogo" alt="Stanley Cup" class="scf-logo" />
          <div class="scf-label">STANLEY CUP<br/><span>FINAL</span></div>
          <div v-if="getRoundMatchups(4, 'Western').length > 0 || getRoundMatchups(4, 'Eastern').length > 0" class="final-matchup">
            <template v-for="matchup in [...getRoundMatchups(4, 'Western'), ...getRoundMatchups(4, 'Eastern')]" :key="matchup.id">
              <MatchupCard
                :matchup="matchup"
                :pick="bracket.getPickForMatchup(matchup.id)"
                :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                @pick="handlePick"
              />
            </template>
          </div>
          <EmptyMatchupCard v-else :logo="cupLogo" />
        </div>

        <!-- Eastern Conference -->
        <div class="conference eastern">
          <!-- Conference Final East -->
          <div class="round round-cf">
            <div class="round-label">CF</div>
            <div class="round-matchups cf-matchups">
              <div class="cf-label">EASTERN<br/><span>CONFERENCE FINAL</span></div>
              <template v-for="matchup in getRoundMatchups(3, 'Eastern')" :key="matchup.id">
                <MatchupCard
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
              </template>
              <EmptyMatchupCard
                v-if="getRoundMatchups(3, 'Eastern').length === 0"
              />
            </div>
          </div>

          <!-- Round 2 East -->
          <div class="round round-2">
            <div class="round-label">{{ getRoundLabel(2) }}</div>
            <div class="round-matchups">
              <template v-for="(matchup, i) in getRoundSlots(2, 'Eastern')" :key="matchup ? matchup.id : 'empty-e2-' + i">
                <MatchupCard
                  v-if="matchup"
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
                <EmptyMatchupCard v-else />
              </template>
            </div>
          </div>

          <!-- Round 1 East -->
          <div class="round round-1">
            <div class="round-label">{{ getRoundLabel(1) }}</div>
            <div class="round-matchups">
              <template v-for="(matchup, i) in getRoundSlots(1, 'Eastern')" :key="matchup ? matchup.id : 'empty-e1-' + i">
                <MatchupCard
                  v-if="matchup"
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
                <EmptyMatchupCard v-else />
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile bracket layout -->
      <div class="bracket-mobile">
        <div v-for="roundNum in [1, 2, 3, 4]" :key="'mobile-' + roundNum" class="mobile-round">
          <h3 class="mobile-round-title">
            {{ roundNum === 4 ? 'Stanley Cup Final' : roundNum === 3 ? 'Conference Finals' : 'Round ' + roundNum }}
          </h3>

          <div v-if="roundNum <= 3" class="mobile-conference">
            <h4 class="conf-label">Western</h4>
            <div class="mobile-matchups">
              <template v-for="(matchup, i) in getRoundSlots(roundNum, 'Western')" :key="matchup ? matchup.id : 'empty-mw-' + roundNum + '-' + i">
                <MatchupCard
                  v-if="matchup"
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
                <EmptyMatchupCard v-else />
              </template>
            </div>

            <h4 class="conf-label">Eastern</h4>
            <div class="mobile-matchups">
              <template v-for="(matchup, i) in getRoundSlots(roundNum, 'Eastern')" :key="matchup ? matchup.id : 'empty-me-' + roundNum + '-' + i">
                <MatchupCard
                  v-if="matchup"
                  :matchup="matchup"
                  :pick="bracket.getPickForMatchup(matchup.id)"
                  :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                  @pick="handlePick"
                  @research="handleResearch"
                />
                <EmptyMatchupCard v-else />
              </template>
            </div>
          </div>

          <div v-else class="mobile-matchups">
            <template v-for="matchup in [...getRoundMatchups(4, 'Western'), ...getRoundMatchups(4, 'Eastern')]" :key="matchup.id">
              <MatchupCard
                :matchup="matchup"
                :pick="bracket.getPickForMatchup(matchup.id)"
                :can-pick="canPickMatchup(matchup)" :locked="showLockIcon(matchup)"
                @pick="handlePick"
              />
            </template>
            <EmptyMatchupCard v-if="getRoundMatchups(4, 'Western').length === 0 && getRoundMatchups(4, 'Eastern').length === 0" />
          </div>
        </div>
      </div>
      <!-- Research modal -->
      <MatchupResearchModal
        :matchup="researchMatchup"
        :visible="showResearch"
        @close="closeResearch"
      />

      <!-- Tiebreaker modal -->
      <BaseModal v-model:modelValue="showTiebreaker" title="Stanley Cup Final Tiebreaker" size="sm" @close="cancelTiebreaker">
        <p class="modal-desc">Predict the total number of goals scored in the entire Final series. In case of a tie on the leaderboard, the closest prediction without going over wins.</p>
        <div class="modal-field">
          <label>Total Goals in Series</label>
          <input
            type="number"
            v-model.number="tiebreakerGoals"
            min="1"
            placeholder="e.g. 35"
            @keyup.enter="submitTiebreaker"
            autofocus
          />
        </div>
        <div v-if="tiebreakerError" class="modal-error">{{ tiebreakerError }}</div>
        <div v-if="takenGoals.length > 0" class="taken-goals">
          <span class="taken-label">Already taken:</span>
          <span class="taken-numbers">{{ takenGoals.sort((a, b) => a - b).join(', ') }}</span>
        </div>
        <template #footer>
          <BaseButton variant="secondary" @click="cancelTiebreaker">Cancel</BaseButton>
          <BaseButton variant="primary" @click="submitTiebreaker">Confirm Pick</BaseButton>
        </template>
      </BaseModal>
    </template>
  </div>
</template>

<style scoped>
.bracket-container {
  padding: 10px 0;
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.login-prompt {
  text-align: center;
  padding: 12px 20px;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.deadline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.deadline-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.deadline-time {
  color: var(--accent);
  font-weight: 700;
}

.deadline-passed {
  background: var(--danger);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Help button */
.help-btn {
  position: fixed;
  bottom: 70px;
  right: 20px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, border-color 0.2s;
  font-family: inherit;
}

.help-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

/* Help modal inner */
.help-example {
  margin-bottom: 14px;
}

.help-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.help-matchup {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.help-team {
  padding: 8px 12px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  border-left: 3px solid transparent;
}

.help-team + .help-team {
  border-top: 1px solid var(--border);
}

.help-team.selected-example {
  background: rgba(66, 165, 245, 0.15);
  border-left-color: #42a5f5;
}

.help-team.correct-example {
  background: rgba(76, 175, 80, 0.15);
  border-left-color: #42a5f5;
}

.help-team.wrong-example {
  background: rgba(244, 67, 54, 0.15);
  border-left-color: #42a5f5;
}

.help-team.winner-example {
  background: rgba(76, 175, 80, 0.1);
}

.help-team.loser-example {
  opacity: 0.5;
}

/* Desktop bracket */
.bracket-grid {
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 680px;
  width: 100%;
}

.conference {
  flex: 1 1 0;
  display: flex;
  min-width: 0;
}

.western {
  flex-direction: row;
  justify-content: flex-end;
}

.eastern {
  flex-direction: row;
  justify-content: flex-start;
}

.round {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  min-width: 0;
}

/* Space between R1 and R2 */
.western .round-1 { margin-right: 20px; }
.western .round-2 { margin-left: 20px; }
.eastern .round-1 { margin-left: 20px; }
.eastern .round-2 { margin-right: 20px; }

.round-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.round-matchups {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  flex: 1;
  gap: 16px;
  align-items: center;
}

.cf-matchups {
  justify-content: center;
  margin-top: -40px;
}

.cf-label {
  font-weight: 800;
  font-size: 1rem;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.3;
  letter-spacing: 1px;
}

.cf-label span {
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

/* Cup center */
.cup-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  flex-shrink: 0;
  margin-bottom: 110px
}

.scf-logo {
  width: 60px;
  height: auto;
  object-fit: contain;
  margin-bottom: 8px;
}

.scf-label {
  font-weight: 800;
  font-size: 1rem;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.3;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.scf-label span {
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.cup-trophy {
  text-align: center;
  margin-bottom: 20px;
}

.cup-img {
  width: 140px;
  height: auto;
  object-fit: contain;
}

.cup-year {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 4px;
}

/* Mobile layout */
.bracket-mobile {
  display: none;
}

.mobile-round {
  margin-bottom: 24px;
}

.mobile-round-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.conf-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 12px 0 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.mobile-matchups {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.mobile-matchups .matchup-card,
.mobile-matchups .empty-matchup {
  flex: 1 1 calc(50% - 5px);
  min-width: 160px;
}

/* Tiebreaker modal inner */
.modal-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-field label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.modal-field input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 1.1rem;
  text-align: center;
  font-weight: 700;
}

.modal-field input:focus {
  border-color: var(--accent);
  outline: none;
}

.modal-error {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 12px;
}

.taken-goals {
  margin-top: 12px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.taken-label {
  margin-right: 6px;
}

.taken-numbers {
  color: var(--text-secondary);
  font-weight: 600;
}

@media (max-width: 1100px) {
  .bracket-grid {
    display: none;
  }
  .bracket-mobile {
    display: block;
  }
}
</style>
