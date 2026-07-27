import { TournamentGroupDrawGroup } from "../types";

export type GroupMatchFixture = {
  group_number: number;
  round_number: number;
  team_a_id: number;
  team_b_id: number;
  court: number;
};

export type GroupStandingRow = {
  team_id: number;
  wins: number;
  point_diff: number;
  place: number;
  played: number;
};

export type GroupMatchScores = {
  team_a_id: number;
  team_b_id: number;
  score_a: number | null;
  score_b: number | null;
};

export type GroupStageMatchView = {
  id: number;
  group_number: number;
  round_number: number;
  team_a_id: number;
  team_b_id: number;
  score_a: number | null;
  score_b: number | null;
  court: number | null;
};

export type GroupStageTeamView = {
  team_id: number;
  players: string[];
  wins: number;
  point_diff: number;
  place: number;
  played: number;
};

export type GroupStageView = {
  group_number: number;
  teams: GroupStageTeamView[];
  standings: GroupStandingRow[];
  matches: Omit<GroupStageMatchView, "group_number">[];
};

/** Собрать представление групп для API (таблица + матчи). */
export function buildGroupStageViews(
  groupDraw: TournamentGroupDrawGroup[],
  teams: { team_id: number; players: string[] }[],
  matches: GroupStageMatchView[],
): GroupStageView[] {
  const teamById = new Map(teams.map((t) => [t.team_id, t]));

  return groupDraw.map((group) => {
    const groupMatches = matches.filter(
      (m) => m.group_number === group.group_number,
    );
    const standings = computeGroupStandings(
      group.team_ids,
      groupMatches.map((m) => ({
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        score_a: m.score_a,
        score_b: m.score_b,
      })),
    );
    const standingByTeam = new Map(standings.map((s) => [s.team_id, s]));

    const groupTeams = group.team_ids.map((teamId) => {
      const team = teamById.get(teamId);
      const standing = standingByTeam.get(teamId);
      return {
        team_id: teamId,
        players: team?.players ?? [],
        wins: standing?.wins ?? 0,
        point_diff: standing?.point_diff ?? 0,
        place: standing?.place ?? 0,
        played: standing?.played ?? 0,
      };
    });

    return {
      group_number: group.group_number,
      teams: groupTeams,
      standings,
      matches: groupMatches.map((m) => ({
        id: m.id,
        round_number: m.round_number,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        score_a: m.score_a,
        score_b: m.score_b,
        court: m.court,
      })),
    };
  });
}

/**
 * Круговой график (circle method). При нечётном числе команд — bye (без матча).
 * Дорожки нумеруются подряд внутри группы, начиная с 1.
 */
export function generateRoundRobinFixtures(
  groupNumber: number,
  teamIds: number[],
  courtStart: number = 1,
): GroupMatchFixture[] {
  if (teamIds.length < 2) {
    return [];
  }

  const teams = [...teamIds];
  const hasBye = teams.length % 2 === 1;
  if (hasBye) {
    teams.push(-1); // bye sentinel
  }

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const rotation = [...teams];
  const fixtures: GroupMatchFixture[] = [];
  let court = courtStart;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === -1 || b === -1) {
        continue;
      }
      // Чередуем «дома/в гостях» по турам для стабильности отображения
      const home = round % 2 === 0 ? a : b;
      const away = round % 2 === 0 ? b : a;
      fixtures.push({
        group_number: groupNumber,
        round_number: round + 1,
        team_a_id: home,
        team_b_id: away,
        court: court++,
      });
    }

    // Фиксируем первый элемент, вращаем остальные
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  return fixtures;
}

/** Фикстуры для всех групп жеребьёвки; дорожки сквозные по турниру. */
export function generateAllGroupFixtures(
  groupDraw: TournamentGroupDrawGroup[],
): GroupMatchFixture[] {
  const all: GroupMatchFixture[] = [];
  let nextCourt = 1;
  for (const group of groupDraw) {
    const fixtures = generateRoundRobinFixtures(
      group.group_number,
      group.team_ids,
      nextCourt,
    );
    all.push(...fixtures);
    if (fixtures.length > 0) {
      nextCourt = Math.max(...fixtures.map((f) => f.court)) + 1;
    }
  }
  return all;
}

/**
 * Таблица группы. Критерии места (последовательно):
 * 1) количество побед;
 * 2) личные встречи (для 2 команд) / те же критерии по играм между равными (для 3+);
 * 3) общая разница шаров;
 * 4) общее число выигранных шаров.
 * При равенстве нескольких команд показатели 1–4 считаются только по матчам между ними.
 */
export function computeGroupStandings(
  teamIds: number[],
  matches: GroupMatchScores[],
): GroupStandingRow[] {
  const overallStats = accumulateStats(teamIds, matches, false);
  const ordered = rankTeams(teamIds, matches);

  return ordered.map((teamId, index) => {
    const s = overallStats.get(teamId)!;
    return {
      team_id: teamId,
      wins: s.wins,
      point_diff: s.point_diff,
      played: s.played,
      place: index + 1,
    };
  });
}

type TeamAccumStats = {
  wins: number;
  point_diff: number;
  points_for: number;
  played: number;
};

function emptyStats(): TeamAccumStats {
  return { wins: 0, point_diff: 0, points_for: 0, played: 0 };
}

function accumulateStats(
  teamIds: number[],
  matches: GroupMatchScores[],
  amongOnly: boolean = true,
): Map<number, TeamAccumStats> {
  const stats = new Map<number, TeamAccumStats>();
  for (const id of teamIds) {
    stats.set(id, emptyStats());
  }
  const idSet = new Set(teamIds);
  for (const match of matches) {
    if (match.score_a == null || match.score_b == null) {
      continue;
    }
    const aIn = idSet.has(match.team_a_id);
    const bIn = idSet.has(match.team_b_id);
    if (amongOnly) {
      if (!aIn || !bIn) {
        continue;
      }
    } else if (!aIn && !bIn) {
      continue;
    }

    if (aIn) {
      const a = stats.get(match.team_a_id)!;
      a.played += 1;
      a.points_for += match.score_a;
      a.point_diff += match.score_a - match.score_b;
      if (match.score_a > match.score_b) {
        a.wins += 1;
      }
    }
    if (bIn) {
      const b = stats.get(match.team_b_id)!;
      b.played += 1;
      b.points_for += match.score_b;
      b.point_diff += match.score_b - match.score_a;
      if (match.score_b > match.score_a) {
        b.wins += 1;
      }
    }
  }
  return stats;
}

function matchesAmong(
  teamIds: number[],
  matches: GroupMatchScores[],
): GroupMatchScores[] {
  const idSet = new Set(teamIds);
  return matches.filter(
    (m) => idSet.has(m.team_a_id) && idSet.has(m.team_b_id),
  );
}

/** Победитель личной встречи или null, если матча нет / нет счёта. */
function headToHeadWinner(
  teamA: number,
  teamB: number,
  matches: GroupMatchScores[],
): number | null {
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) {
      continue;
    }
    if (m.team_a_id === teamA && m.team_b_id === teamB) {
      if (m.score_a === m.score_b) {
        return null;
      }
      return m.score_a > m.score_b ? teamA : teamB;
    }
    if (m.team_a_id === teamB && m.team_b_id === teamA) {
      if (m.score_a === m.score_b) {
        return null;
      }
      return m.score_a > m.score_b ? teamB : teamA;
    }
  }
  return null;
}

function compareByDiffAndPointsFor(
  a: TeamAccumStats,
  b: TeamAccumStats,
): number {
  if (b.point_diff !== a.point_diff) {
    return b.point_diff - a.point_diff;
  }
  if (b.points_for !== a.points_for) {
    return b.points_for - a.points_for;
  }
  return 0;
}

/**
 * Упорядочивает команды по правилам группы.
 * `scopeMatches` — матчи, по которым считаются текущие показатели
 * (для подгруппы равных — только их взаимные игры).
 * `allMatches` — все матчи группы для финальных «общих» критериев.
 */
function rankTeams(
  teamIds: number[],
  allMatches: GroupMatchScores[],
  scopeMatches: GroupMatchScores[] = allMatches,
): number[] {
  if (teamIds.length <= 1) {
    return [...teamIds];
  }

  const stats = accumulateStats(teamIds, matchesAmong(teamIds, scopeMatches));
  const byWinsDesc = [...teamIds].sort((idA, idB) => {
    const wa = stats.get(idA)!.wins;
    const wb = stats.get(idB)!.wins;
    if (wb !== wa) {
      return wb - wa;
    }
    return idA - idB;
  });

  const result: number[] = [];
  let i = 0;
  while (i < byWinsDesc.length) {
    let j = i + 1;
    while (
      j < byWinsDesc.length &&
      stats.get(byWinsDesc[j])!.wins === stats.get(byWinsDesc[i])!.wins
    ) {
      j++;
    }
    const tied = byWinsDesc.slice(i, j);
    if (tied.length === 1) {
      result.push(tied[0]);
    } else {
      result.push(...breakTie(tied, allMatches, scopeMatches));
    }
    i = j;
  }
  return result;
}

function breakTie(
  tied: number[],
  allMatches: GroupMatchScores[],
  scopeMatches: GroupMatchScores[],
): number[] {
  if (tied.length <= 1) {
    return [...tied];
  }

  const mutual = matchesAmong(tied, scopeMatches);

  // 2 команды с равными победами — личная встреча
  if (tied.length === 2) {
    const winner = headToHeadWinner(tied[0], tied[1], mutual);
    if (winner != null) {
      const loser = winner === tied[0] ? tied[1] : tied[0];
      return [winner, loser];
    }
  }

  // 3+ (или 2 без H2H): те же показатели только по играм между ними
  const miniStats = accumulateStats(tied, mutual);
  const miniWins = tied.map((id) => miniStats.get(id)!.wins);
  const hasDifferentMiniWins = miniWins.some((w) => w !== miniWins[0]);

  if (tied.length >= 3 && hasDifferentMiniWins) {
    // Рекурсия по мини-таблице (победы → H2H → … внутри подгруппы)
    return rankTeams(tied, allMatches, mutual);
  }

  if (tied.length >= 3 && !hasDifferentMiniWins) {
    // Победы в мини равны — разбиваем по разнице / шарам в мини-таблицах,
    // затем при полном равенстве — по общим показателям всей группы.
    return breakTieByDiffAndBalls(tied, miniStats, allMatches);
  }

  // 2 команды без личной встречи — общие критерии по всем играм группы
  const overall = accumulateStats(tied, allMatches, false);
  return breakTieByDiffAndBalls(tied, overall, allMatches);
}

function breakTieByDiffAndBalls(
  tied: number[],
  primaryStats: Map<number, TeamAccumStats>,
  allMatches: GroupMatchScores[],
): number[] {
  const overall = accumulateStats(tied, allMatches, false);
  return [...tied].sort((idA, idB) => {
    const primary = compareByDiffAndPointsFor(
      primaryStats.get(idA)!,
      primaryStats.get(idB)!,
    );
    if (primary !== 0) {
      return primary;
    }
    const overallCmp = compareByDiffAndPointsFor(
      overall.get(idA)!,
      overall.get(idB)!,
    );
    if (overallCmp !== 0) {
      return overallCmp;
    }
    return idA - idB;
  });
}


/** Ячейка кросс-таблицы: счёт с точки зрения rowTeam. */
export function getCrossTableCell(
  rowTeamId: number,
  colTeamId: number,
  matches: GroupMatchScores[],
): { score_for: number; score_against: number; diff: number } | null {
  if (rowTeamId === colTeamId) {
    return null;
  }
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) {
      continue;
    }
    if (m.team_a_id === rowTeamId && m.team_b_id === colTeamId) {
      return {
        score_for: m.score_a,
        score_against: m.score_b,
        diff: m.score_a - m.score_b,
      };
    }
    if (m.team_b_id === rowTeamId && m.team_a_id === colTeamId) {
      return {
        score_for: m.score_b,
        score_against: m.score_a,
        diff: m.score_b - m.score_a,
      };
    }
  }
  return null;
}

export function validateMatchScores(
  scoreA: unknown,
  scoreB: unknown,
): { score_a: number; score_b: number } | string {
  const a =
    typeof scoreA === "number" ? scoreA : parseInt(String(scoreA), 10);
  const b =
    typeof scoreB === "number" ? scoreB : parseInt(String(scoreB), 10);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return "Счёт должен быть целым числом от 0 до 13";
  }
  if (a > 13 || b > 13) {
    return "Счёт не может быть больше 13";
  }
  if (a === b) {
    return "В петанке партия не может закончиться ничьей";
  }
  return { score_a: a, score_b: b };
}
