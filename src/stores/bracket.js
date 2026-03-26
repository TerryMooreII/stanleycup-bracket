import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useBracketStore = defineStore('bracket', () => {
  const season = ref(null)
  const teams = ref([])
  const rounds = ref([])
  const matchups = ref([])
  const picks = ref([])
  const loading = ref(false)

  async function fetchActiveSeason() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single()
    season.value = data
  }

  async function fetchTeams() {
    const { data } = await supabase.from('teams').select('*').order('abbreviation')
    teams.value = data || []
  }

  async function fetchRounds() {
    if (!season.value) return
    const { data } = await supabase
      .from('rounds')
      .select('*')
      .eq('season_id', season.value.id)
      .order('round_number')
    rounds.value = data || []
  }

  async function fetchMatchups() {
    const roundIds = rounds.value.map(r => r.id)
    if (roundIds.length === 0) {
      matchups.value = []
      return
    }
    const { data } = await supabase
      .from('matchups')
      .select('*, team_home:teams!matchups_team_home_id_fkey(*), team_away:teams!matchups_team_away_id_fkey(*), winner:teams!matchups_winner_id_fkey(*)')
      .in('round_id', roundIds)
      .order('bracket_position')
    matchups.value = data || []
  }

  async function fetchPicks(userId) {
    if (!userId) return
    const { data } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
    picks.value = data || []
  }

  async function fetchAll(userId) {
    loading.value = true
    try {
      await fetchActiveSeason()
      await Promise.all([fetchTeams(), fetchRounds()])
      await Promise.all([fetchMatchups(), fetchPicks(userId)])
    } catch (e) {
      console.error('Bracket fetch error:', e)
    } finally {
      loading.value = false
    }
  }

  async function makePick(matchupId, teamId, userId, tiebreakerGoals = null) {
    const existing = picks.value.find(p => p.matchup_id === matchupId)
    if (existing) {
      if (existing.team_id === teamId && tiebreakerGoals === null) {
        // Remove pick
        await supabase.from('picks').delete().eq('id', existing.id)
        picks.value = picks.value.filter(p => p.id !== existing.id)
        return
      }
      // Update pick
      const updates = { team_id: teamId, updated_at: new Date().toISOString() }
      if (tiebreakerGoals !== null) updates.tiebreaker_goals = tiebreakerGoals
      const { data, error } = await supabase
        .from('picks')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      const idx = picks.value.findIndex(p => p.id === existing.id)
      picks.value[idx] = data
    } else {
      // Insert pick
      const { data, error } = await supabase
        .from('picks')
        .insert({ user_id: userId, matchup_id: matchupId, team_id: teamId, tiebreaker_goals: tiebreakerGoals })
        .select()
        .single()
      if (error) throw error
      picks.value.push(data)
    }
  }

  function getPickForMatchup(matchupId) {
    return picks.value.find(p => p.matchup_id === matchupId)
  }

  function getMatchupsForRound(roundId, conference) {
    return matchups.value.filter(m => m.round_id === roundId && m.conference === conference)
  }

  function getActiveRound() {
    return rounds.value.find(r => r.is_active)
  }

  function isDeadlinePassed(roundId) {
    const round = rounds.value.find(r => r.id === roundId)
    if (!round?.pick_deadline) return false
    return new Date(round.pick_deadline) < new Date()
  }

  // Admin functions
  async function createMatchup(matchupData) {
    const { data, error } = await supabase
      .from('matchups')
      .insert(matchupData)
      .select('*, team_home:teams!matchups_team_home_id_fkey(*), team_away:teams!matchups_team_away_id_fkey(*)')
      .single()
    if (error) throw error
    matchups.value.push(data)
    return data
  }

  async function updateMatchup(id, updates) {
    const { data, error } = await supabase
      .from('matchups')
      .update(updates)
      .eq('id', id)
      .select('*, team_home:teams!matchups_team_home_id_fkey(*), team_away:teams!matchups_team_away_id_fkey(*), winner:teams!matchups_winner_id_fkey(*)')
      .single()
    if (error) throw error
    const idx = matchups.value.findIndex(m => m.id === id)
    if (idx !== -1) matchups.value[idx] = data
    return data
  }

  async function deleteMatchup(id) {
    const { error } = await supabase.from('matchups').delete().eq('id', id)
    if (error) throw error
    matchups.value = matchups.value.filter(m => m.id !== id)
  }

  async function updateRound(id, updates) {
    const { data, error } = await supabase
      .from('rounds')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const idx = rounds.value.findIndex(r => r.id === id)
    if (idx !== -1) rounds.value[idx] = data
    return data
  }

  async function createSeason(year) {
    // Deactivate current season
    if (season.value) {
      await supabase.from('seasons').update({ is_active: false }).eq('id', season.value.id)
    }
    // Create new season
    const { data: newSeason, error: sErr } = await supabase
      .from('seasons')
      .insert({ year, is_active: true })
      .select()
      .single()
    if (sErr) throw sErr
    // Create 4 rounds for the new season
    const roundDefs = [
      { round_number: 1, name: 'Round 1' },
      { round_number: 2, name: 'Round 2' },
      { round_number: 3, name: 'Conference Finals' },
      { round_number: 4, name: 'Stanley Cup Final' }
    ]
    const { error: rErr } = await supabase
      .from('rounds')
      .insert(roundDefs.map(r => ({ ...r, season_id: newSeason.id, is_active: false })))
    if (rErr) throw rErr
    // Refresh store
    season.value = newSeason
    await Promise.all([fetchRounds(), fetchMatchups(), fetchPicks(null)])
    return newSeason
  }

  return {
    season, teams, rounds, matchups, picks, loading,
    fetchActiveSeason, fetchTeams, fetchRounds, fetchMatchups, fetchPicks, fetchAll,
    makePick, getPickForMatchup, getMatchupsForRound, getActiveRound, isDeadlinePassed,
    createMatchup, updateMatchup, deleteMatchup, updateRound, createSeason
  }
})
