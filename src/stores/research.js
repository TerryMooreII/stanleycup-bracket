import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nhlUrl } from '../lib/nhlApi'

function getCurrentSeason() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  // NHL season spans two calendar years; if before September, season started previous year
  const startYear = month >= 9 ? year : year - 1
  return `${startYear}${startYear + 1}`
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getGameResult(game, teamAbbrev) {
  const isHome = game.homeTeam?.abbrev === teamAbbrev
  const teamScore = isHome ? game.homeTeam?.score : game.awayTeam?.score
  const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score
  const won = teamScore > oppScore
  const otso = game.periodDescriptor?.periodType === 'OT' || game.periodDescriptor?.periodType === 'SO'
  return { won, otso, teamScore, oppScore }
}

export const useResearchStore = defineStore('research', () => {
  const loading = ref(false)
  const error = ref(null)
  const cache = ref({})

  async function fetchMatchupResearch(homeAbbrev, awayAbbrev) {
    const key = `${homeAbbrev}-${awayAbbrev}`
    if (cache.value[key]) return cache.value[key]

    loading.value = true
    error.value = null

    try {
      const season = getCurrentSeason()

      const [homeSchedRes, awaySchedRes, standingsRes] = await Promise.allSettled([
        fetch(nhlUrl(`/v1/club-schedule-season/${homeAbbrev}/${season}`)),
        fetch(nhlUrl(`/v1/club-schedule-season/${awayAbbrev}/${season}`)),
        fetch(nhlUrl('/v1/standings/now'))
      ])

      // Parse responses
      const homeSched = homeSchedRes.status === 'fulfilled' && homeSchedRes.value.ok
        ? await homeSchedRes.value.json() : null
      const awaySched = awaySchedRes.status === 'fulfilled' && awaySchedRes.value.ok
        ? await awaySchedRes.value.json() : null
      const standings = standingsRes.status === 'fulfilled' && standingsRes.value.ok
        ? await standingsRes.value.json() : null

      // Head-to-head: from home team's schedule, find regular season games vs away team
      const h2hGames = []
      if (homeSched?.games) {
        for (const game of homeSched.games) {
          if (game.gameType !== 2) continue // regular season only
          const state = game.gameState?.toUpperCase()
          if (state !== 'OFF' && state !== 'FINAL') continue
          const oppAbbrev = game.homeTeam?.abbrev === homeAbbrev
            ? game.awayTeam?.abbrev
            : game.homeTeam?.abbrev
          if (oppAbbrev === awayAbbrev) {
            const { won, otso } = getGameResult(game, homeAbbrev)
            h2hGames.push({
              date: formatDate(game.gameDate),
              rawDate: game.gameDate,
              homeTeam: game.homeTeam?.abbrev,
              awayTeam: game.awayTeam?.abbrev,
              homeScore: game.homeTeam?.score,
              awayScore: game.awayTeam?.score,
              otso: otso ? (game.periodDescriptor?.periodType || '') : null,
              homeWin: game.homeTeam?.score > game.awayTeam?.score
            })
          }
        }
      }
      h2hGames.sort((a, b) => a.rawDate.localeCompare(b.rawDate))

      // H2H summary
      let homeWins = 0, awayWins = 0, otLosses = 0
      for (const g of h2hGames) {
        const homeTeamWonGame = (g.homeTeam === homeAbbrev && g.homeWin) ||
                                (g.awayTeam === homeAbbrev && !g.homeWin)
        if (homeTeamWonGame) {
          homeWins++
        } else if (g.otso) {
          otLosses++
        } else {
          awayWins++
        }
      }

      // Last 10 for each team
      function getLast10(schedData, teamAbbrev) {
        if (!schedData?.games) return { games: [], record: '', streak: '' }
        const finished = schedData.games
          .filter(g => {
            const state = g.gameState?.toUpperCase()
            return g.gameType === 2 && (state === 'OFF' || state === 'FINAL')
          })
          .sort((a, b) => b.gameDate.localeCompare(a.gameDate))
          .slice(0, 10)

        let wins = 0, losses = 0, otl = 0
        let streakType = null, streakCount = 0

        const games = finished.map((game, i) => {
          const isHome = game.homeTeam?.abbrev === teamAbbrev
          const opponent = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev
          const { won, otso, teamScore, oppScore } = getGameResult(game, teamAbbrev)

          if (won) wins++
          else if (otso) otl++
          else losses++

          // Streak (from most recent)
          if (i === 0) {
            streakType = won ? 'W' : 'L'
            streakCount = 1
          } else if ((won && streakType === 'W') || (!won && streakType === 'L')) {
            streakCount++
          }
          // else streak broken, stop counting (already captured)

          return {
            date: formatDate(game.gameDate),
            opponent,
            result: won ? 'W' : (otso ? 'OTL' : 'L'),
            score: `${teamScore}-${oppScore}`,
            otso: otso ? game.periodDescriptor?.periodType : null
          }
        })

        return {
          games,
          record: `${wins}-${losses}-${otl}`,
          streak: `${streakType}${streakCount}`
        }
      }

      const homeLast10 = getLast10(homeSched, homeAbbrev)
      const awayLast10 = getLast10(awaySched, awayAbbrev)

      // Standings info
      function extractStanding(teamData) {
        if (!teamData) return null
        const t = teamData
        return {
          record: `${t.wins}-${t.losses}-${t.otLosses}`,
          points: t.points,
          pointPct: t.pointPctg ? (t.pointPctg * 100).toFixed(1) + '%' : '',
          homeRecord: `${t.homeWins}-${t.homeLosses}-${t.homeOtLosses}`,
          roadRecord: `${t.roadWins}-${t.roadLosses}-${t.roadOtLosses}`,
          goalsFor: t.goalFor,
          goalsAgainst: t.goalAgainst,
          goalDifferential: t.goalDifferential,
          l10Record: `${t.l10Wins}-${t.l10Losses}-${t.l10OtLosses}`,
          streak: `${t.streakCode || ''}${t.streakCount || 0}`,
          leagueRank: t.leagueSequence,
          conferenceRank: t.conferenceSequence,
          divisionRank: t.divisionSequence,
          divisionName: t.divisionAbbrev
        }
      }

      let homeStanding = null, awayStanding = null
      if (standings?.standings) {
        for (const team of standings.standings) {
          if (team.teamAbbrev?.default === homeAbbrev) {
            homeStanding = extractStanding(team)
          }
          if (team.teamAbbrev?.default === awayAbbrev) {
            awayStanding = extractStanding(team)
          }
        }
      }

      const result = {
        h2hGames,
        h2hSummary: { homeWins, awayWins, otLosses },
        homeLast10,
        awayLast10,
        homeStanding,
        awayStanding
      }

      cache.value[key] = result
      return result
    } catch (e) {
      error.value = 'Failed to load research data'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    cache,
    fetchMatchupResearch
  }
})
