import { TournamentRegisteredTeam, TournamentType } from "../types";

/**
 * Личные рейтинги для сида швейцарки: DESC.
 * В триплете в сумму/сравнение входят не более трёх лучших.
 * Логика совпадает с backend `playerRatingsForSwissSeed`.
 */
export function playerRatingsForSwissSeed(
  playerPoints: number[],
  tournamentType: TournamentType
): number[] {
  const sorted = [...playerPoints].sort((a, b) => b - a);
  if (tournamentType === TournamentType.TRIPLETTE && sorted.length > 3) {
    return sorted.slice(0, 3);
  }
  return sorted;
}

export function teamRatingFromPlayerPoints(
  playerPoints: number[],
  tournamentType: TournamentType
): number {
  return playerRatingsForSwissSeed(playerPoints, tournamentType).reduce(
    (sum, value) => sum + value,
    0
  );
}

/**
 * Сравнение личных рейтингов при равной сумме: первый игрок DESC,
 * затем второй и т.д. Короткий состав дополняется нулями.
 */
export function comparePlayerRatingsForSeed(
  a: number[] | undefined,
  b: number[] | undefined
): number {
  const sa = [...(a ?? [])].sort((x, y) => y - x);
  const sb = [...(b ?? [])].sort((x, y) => y - x);
  const n = Math.max(sa.length, sb.length);
  for (let i = 0; i < n; i++) {
    const va = sa[i] ?? 0;
    const vb = sb[i] ?? 0;
    if (va !== vb) {
      return vb - va;
    }
  }
  return 0;
}

export function playerPointsForRegisteredTeam(
  team: TournamentRegisteredTeam,
  ratingByPlayerId: Map<number, number>,
  ratingByPlayerName: Map<string, number>
): number[] {
  return team.players.map((name, index) => {
    const playerId = team.player_ids[index];
    if (
      Number.isInteger(playerId) &&
      playerId > 0 &&
      ratingByPlayerId.has(playerId)
    ) {
      return ratingByPlayerId.get(playerId) ?? 0;
    }
    return ratingByPlayerName.get(name) ?? 0;
  });
}

export type SwissSeedSortTeam = {
  team_id: number;
  player_points: number[];
};

/**
 * Порядок сидов: сумма DESC → личные рейтинги DESC → жребий
 * (включая полностью нулевой рейтинг).
 */
export function sortTeamIdsBySwissRating(
  teams: SwissSeedSortTeam[],
  tournamentType: TournamentType,
  randomFn: () => number = () => Math.floor(Math.random() * 100)
): number[] {
  const withKeys = teams.map((team) => {
    const playerRatings = playerRatingsForSwissSeed(
      team.player_points,
      tournamentType
    );
    return {
      team_id: team.team_id,
      rating: playerRatings.reduce((sum, value) => sum + value, 0),
      player_ratings: playerRatings,
      random_tie: randomFn(),
    };
  });
  withKeys.sort((a, b) => {
    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }
    const byPlayers = comparePlayerRatingsForSeed(
      a.player_ratings,
      b.player_ratings
    );
    if (byPlayers !== 0) {
      return byPlayers;
    }
    if (b.random_tie !== a.random_tie) {
      return b.random_tie - a.random_tie;
    }
    return a.team_id - b.team_id;
  });
  return withKeys.map((team) => team.team_id);
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
