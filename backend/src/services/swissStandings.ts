import {
  TiebreakerCriterion,
  TournamentSwissMatch,
  TournamentSwissStanding,
} from "../types";
import { normalizeSwissByeScores } from "./swissConstants";

type TeamStats = {
  team_id: number;
  wins: number;
  loses: number;
  points_for: number;
  points_against: number;
  opponents: number[];
  defeated_opponents: number[];
  round_wins: number[];
};

function getMatchScores(match: TournamentSwissMatch): {
  score_a: number;
  score_b: number;
  winner_team_id: number | null;
} {
  if (match.is_bye) {
    const normalized = normalizeSwissByeScores(match.score_a, match.score_b);
    return {
      score_a: normalized.score_a,
      score_b: normalized.score_b,
      winner_team_id: match.team_a_id,
    };
  }

  if (match.score_a == null || match.score_b == null) {
    return {
      score_a: match.score_a ?? 0,
      score_b: match.score_b ?? 0,
      winner_team_id: match.winner_team_id,
    };
  }

  return {
    score_a: match.score_a,
    score_b: match.score_b,
    winner_team_id: match.winner_team_id,
  };
}

function compareByTiebreakers(
  a: TournamentSwissStanding,
  b: TournamentSwissStanding,
  order: TiebreakerCriterion[],
): number {
  for (const criterion of order) {
    const valueA =
      criterion === TiebreakerCriterion.BUCHHOLZ
        ? a.buchholz ?? 0
        : criterion === TiebreakerCriterion.DOUBLE_BUCHHOLZ
          ? a.double_buchholz ?? 0
          : criterion === TiebreakerCriterion.BERGER
            ? a.berger ?? 0
            : criterion === TiebreakerCriterion.PROGRESS
              ? a.progress ?? 0
              : a.point_diff;
    const valueB =
      criterion === TiebreakerCriterion.BUCHHOLZ
        ? b.buchholz ?? 0
        : criterion === TiebreakerCriterion.DOUBLE_BUCHHOLZ
          ? b.double_buchholz ?? 0
          : criterion === TiebreakerCriterion.BERGER
            ? b.berger ?? 0
            : criterion === TiebreakerCriterion.PROGRESS
              ? b.progress ?? 0
              : b.point_diff;

    if (valueA !== valueB) {
      return valueB - valueA;
    }
  }

  return a.team_id - b.team_id;
}

export function calculateSwissStandings(
  teamIds: number[],
  matches: TournamentSwissMatch[],
  tiebreakerOrder: TiebreakerCriterion[],
): Omit<TournamentSwissStanding, "id" | "tournament_id" | "team_players">[] {
  const stats = new Map<number, TeamStats>();

  for (const teamId of teamIds) {
    stats.set(teamId, {
      team_id: teamId,
      wins: 0,
      loses: 0,
      points_for: 0,
      points_against: 0,
      opponents: [],
      defeated_opponents: [],
      round_wins: [],
    });
  }

  const rounds = [...new Set(matches.map((match) => match.round_number))].sort(
    (a, b) => a - b,
  );

  for (const roundNumber of rounds) {
    const roundMatches = matches.filter(
      (match) => match.round_number === roundNumber,
    );

    for (const teamId of teamIds) {
      const teamStats = stats.get(teamId)!;
      const teamMatch = roundMatches.find(
        (match) =>
          match.team_a_id === teamId ||
          match.team_b_id === teamId ||
          (match.is_bye && match.team_a_id === teamId),
      );

      if (!teamMatch) {
        teamStats.round_wins.push(0);
        continue;
      }

      const parsed = getMatchScores(teamMatch);
      const isTeamA = teamMatch.team_a_id === teamId;
      const pointsFor = isTeamA ? parsed.score_a : parsed.score_b;
      const pointsAgainst = isTeamA ? parsed.score_b : parsed.score_a;
      const won = parsed.winner_team_id === teamId;

      teamStats.points_for += pointsFor;
      teamStats.points_against += pointsAgainst;

      if (won) {
        teamStats.wins += 1;
        teamStats.round_wins.push(1);
      } else if (parsed.winner_team_id != null) {
        teamStats.loses += 1;
        teamStats.round_wins.push(0);
      } else {
        teamStats.round_wins.push(0);
      }

      if (!teamMatch.is_bye && teamMatch.team_b_id != null) {
        const opponentId =
          teamMatch.team_a_id === teamId
            ? teamMatch.team_b_id
            : teamMatch.team_a_id;
        teamStats.opponents.push(opponentId);
        if (won) {
          teamStats.defeated_opponents.push(opponentId);
        }
      }
    }
  }

  const preliminary = teamIds.map((teamId) => {
    const teamStats = stats.get(teamId)!;
    const opponentsWins = teamStats.opponents.map(
      (opponentId) => stats.get(opponentId)?.wins ?? 0,
    );
    const buchholz = opponentsWins.reduce((sum, value) => sum + value, 0);
    const doubleBuchholz = teamStats.opponents.reduce((sum, opponentId) => {
      const opponent = stats.get(opponentId);
      if (!opponent) {
        return sum;
      }
      return (
        sum +
        opponent.opponents.reduce(
          (innerSum, nestedOpponentId) =>
            innerSum + (stats.get(nestedOpponentId)?.wins ?? 0),
          0,
        )
      );
    }, 0);
    const berger = teamStats.defeated_opponents.reduce(
      (sum, opponentId) => sum + (stats.get(opponentId)?.wins ?? 0),
      0,
    );
    const progress = teamStats.round_wins.reduce((sum, _, index) => {
      const partial = teamStats.round_wins
        .slice(0, index + 1)
        .reduce((acc, value) => acc + value, 0);
      return sum + partial;
    }, 0);

    return {
      team_id: teamId,
      wins: teamStats.wins,
      loses: teamStats.loses,
      points_for: teamStats.points_for,
      points_against: teamStats.points_against,
      buchholz,
      double_buchholz: doubleBuchholz,
      berger,
      progress,
      point_diff: teamStats.points_for - teamStats.points_against,
      rank_position: null as number | null,
    };
  });

  const ranked = [...preliminary].sort((a, b) => {
    if (a.wins !== b.wins) {
      return b.wins - a.wins;
    }
    return compareByTiebreakers(
      a as TournamentSwissStanding,
      b as TournamentSwissStanding,
      tiebreakerOrder,
    );
  });

  return ranked.map((row, index) => ({
    ...row,
    rank_position: index + 1,
  }));
}

export function rankTeamIdsForPairing(
  teamIds: number[],
  standings: Omit<
    TournamentSwissStanding,
    "id" | "tournament_id" | "team_players"
  >[],
): number[] {
  const rankByTeam = new Map(
    standings.map((row) => [row.team_id, row.rank_position ?? 9999]),
  );

  return [...teamIds].sort(
    (a, b) => (rankByTeam.get(a) ?? 9999) - (rankByTeam.get(b) ?? 9999),
  );
}
