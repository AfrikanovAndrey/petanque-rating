import { TournamentType } from "../types";

export type SwissSeedEntry = {
  team_id: number;
  seed: number;
  rating: number;
  random_tie: number;
};

export type SwissMatchFixture = {
  round_number: number;
  team_a_id: number;
  team_b_id: number | null;
  is_bye: boolean;
  court: number | null;
  /** Для bye сразу фиксируем автопобеду */
  score_a?: number | null;
  score_b?: number | null;
};

export type SwissMatchScores = {
  team_a_id: number;
  team_b_id: number | null;
  score_a: number | null;
  score_b: number | null;
  is_bye: boolean;
  round_number: number;
};

export type SwissStandingRow = {
  team_id: number;
  seed: number;
  rating: number;
  random_tie: number;
  wins: number;
  point_diff: number;
  points_for: number;
  played: number;
  place: number;
};

export type SwissMatchView = {
  id: number;
  round_number: number;
  team_a_id: number;
  team_b_id: number | null;
  score_a: number | null;
  score_b: number | null;
  is_bye: boolean;
  court: number | null;
};

export type SwissStageTeamView = {
  team_id: number;
  players: string[];
  seed: number;
  rating: number;
  random_tie: number;
  wins: number;
  point_diff: number;
  points_for: number;
  played: number;
  place: number;
};

export type SwissStageView = {
  swiss_rounds: number;
  completed_rounds: number;
  standings: SwissStageTeamView[];
  matches: SwissMatchView[];
};

export function parseSwissSeed(raw: unknown): SwissSeedEntry[] | null {
  if (raw == null) {
    return null;
  }
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const entries: SwissSeedEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    const teamId = Number(row.team_id);
    const seed = Number(row.seed);
    const rating = Number(row.rating);
    const randomTie = Number(row.random_tie);
    if (
      !Number.isInteger(teamId) ||
      teamId <= 0 ||
      !Number.isInteger(seed) ||
      seed <= 0 ||
      !Number.isFinite(rating) ||
      !Number.isInteger(randomTie) ||
      randomTie < 0 ||
      randomTie > 99
    ) {
      return null;
    }
    entries.push({
      team_id: teamId,
      seed,
      rating,
      random_tie: randomTie,
    });
  }
  return entries.sort((a, b) => a.seed - b.seed);
}

/** Сумма рейтингов игроков (как на странице регистрации). */
export function computeTeamRatingFromPlayerPoints(
  playerPoints: number[],
  tournamentType: TournamentType,
): number {
  const sorted = [...playerPoints].sort((a, b) => b - a);
  const values =
    tournamentType === TournamentType.TRIPLETTE && sorted.length > 3
      ? sorted.slice(0, 3)
      : sorted;
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Сид: rating DESC, при равенстве — random_tie DESC (больше «выигрывает» жребий).
 * random ∈ [0, 99]; передаётся снаружи для тестов.
 */
export function seedTeamsByRating(
  teams: Array<{ team_id: number; rating: number }>,
  randomFn: () => number = () => Math.floor(Math.random() * 100),
): SwissSeedEntry[] {
  const withRandom = teams.map((t) => ({
    team_id: t.team_id,
    rating: t.rating,
    random_tie: clampRandomTie(randomFn()),
  }));
  withRandom.sort((a, b) => {
    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }
    if (b.random_tie !== a.random_tie) {
      return b.random_tie - a.random_tie;
    }
    return a.team_id - b.team_id;
  });
  return withRandom.map((t, index) => ({
    team_id: t.team_id,
    seed: index + 1,
    rating: t.rating,
    random_tie: t.random_tie,
  }));
}

function clampRandomTie(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  const v = Math.floor(n);
  if (v < 0) {
    return 0;
  }
  if (v > 99) {
    return 99;
  }
  return v;
}

/**
 * Тур 1 — half-метод: i ↔ i+half, при нечётном N bye у последнего сида.
 * Пример N=5: 1–3, 2–4, bye 5.
 */
export function pairRound1HalfMethod(
  seeds: SwissSeedEntry[],
  courtStart: number = 1,
): SwissMatchFixture[] {
  const ordered = [...seeds].sort((a, b) => a.seed - b.seed);
  const n = ordered.length;
  if (n < 2) {
    if (n === 1) {
      return [
        {
          round_number: 1,
          team_a_id: ordered[0].team_id,
          team_b_id: null,
          is_bye: true,
          court: null,
          score_a: 13,
          score_b: 0,
        },
      ];
    }
    return [];
  }

  const fixtures: SwissMatchFixture[] = [];
  let court = courtStart;
  const odd = n % 2 === 1;
  const pairCount = Math.floor(n / 2);
  const half = pairCount;

  for (let i = 0; i < pairCount; i++) {
    const a = ordered[i];
    const b = ordered[i + half];
    fixtures.push({
      round_number: 1,
      team_a_id: a.team_id,
      team_b_id: b.team_id,
      is_bye: false,
      court: court++,
    });
  }

  if (odd) {
    const byeTeam = ordered[n - 1];
    fixtures.push({
      round_number: 1,
      team_a_id: byeTeam.team_id,
      team_b_id: null,
      is_bye: true,
      court: null,
      score_a: 13,
      score_b: 0,
    });
  }

  return fixtures;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function collectPlayedPairs(matches: SwissMatchScores[]): Set<string> {
  const played = new Set<string>();
  for (const m of matches) {
    if (m.is_bye || m.team_b_id == null) {
      continue;
    }
    played.add(pairKey(m.team_a_id, m.team_b_id));
  }
  return played;
}

export function computeWinsByTeam(
  seeds: SwissSeedEntry[],
  matches: SwissMatchScores[],
): Map<number, { wins: number; point_diff: number; points_for: number; played: number }> {
  const stats = new Map<
    number,
    { wins: number; point_diff: number; points_for: number; played: number }
  >();
  for (const s of seeds) {
    stats.set(s.team_id, {
      wins: 0,
      point_diff: 0,
      points_for: 0,
      played: 0,
    });
  }

  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) {
      continue;
    }
    const a = stats.get(m.team_a_id);
    if (!a) {
      continue;
    }
    if (m.is_bye || m.team_b_id == null) {
      a.wins += 1;
      a.played += 1;
      continue;
    }
    const b = stats.get(m.team_b_id);
    if (!b) {
      continue;
    }
    a.played += 1;
    b.played += 1;
    a.points_for += m.score_a;
    b.points_for += m.score_b;
    a.point_diff += m.score_a - m.score_b;
    b.point_diff += m.score_b - m.score_a;
    if (m.score_a > m.score_b) {
      a.wins += 1;
    } else {
      b.wins += 1;
    }
  }
  return stats;
}

type PairCandidate = { team_id: number; seed: number; wins: number };

/**
 * Паринг внутри пула: сверху вниз, соперник — первый с кем ещё не играли.
 * При неудаче — backtracking на уровне пула (перестановки соседних).
 */
function pairWithinPool(
  pool: PairCandidate[],
  played: Set<string>,
): Array<[PairCandidate, PairCandidate]> | null {
  if (pool.length === 0) {
    return [];
  }
  if (pool.length % 2 !== 0) {
    return null;
  }

  const remaining = [...pool];
  const pairs: Array<[PairCandidate, PairCandidate]> = [];

  function solve(): boolean {
    if (remaining.length === 0) {
      return true;
    }
    const a = remaining[0];
    for (let i = 1; i < remaining.length; i++) {
      const b = remaining[i];
      const key = pairKey(a.team_id, b.team_id);
      if (played.has(key)) {
        continue;
      }
      remaining.splice(i, 1);
      remaining.shift();
      pairs.push([a, b]);
      if (solve()) {
        return true;
      }
      pairs.pop();
      remaining.unshift(a);
      remaining.splice(i, 0, b);
    }
    return false;
  }

  return solve() ? pairs : null;
}

/**
 * Туры 2+: группы по победам, внутри — по сиду.
 * Нечётная группа — слабейший играет с лучшим из нижестоящей.
 * Одна и та же пара не встречается дважды.
 */
export function pairNextRoundByScoreGroups(
  seeds: SwissSeedEntry[],
  matchesSoFar: SwissMatchScores[],
  roundNumber: number,
  courtStart: number = 1,
): SwissMatchFixture[] {
  const stats = computeWinsByTeam(seeds, matchesSoFar);
  const played = collectPlayedPairs(matchesSoFar);

  const teamsHadBye = new Set<number>();
  for (const m of matchesSoFar) {
    if (m.is_bye) {
      teamsHadBye.add(m.team_a_id);
    }
  }

  const candidates: PairCandidate[] = seeds.map((s) => ({
    team_id: s.team_id,
    seed: s.seed,
    wins: stats.get(s.team_id)?.wins ?? 0,
  }));

  const winsLevels = [
    ...new Set(candidates.map((c) => c.wins)),
  ].sort((a, b) => b - a);

  const pools: PairCandidate[][] = winsLevels.map((w) =>
    candidates
      .filter((c) => c.wins === w)
      .sort((a, b) => a.seed - b.seed),
  );

  let byeTeam: PairCandidate | null = null;

  // Floaters: нечётный пул → слабейший к лучшему нижестоящего
  for (let i = 0; i < pools.length; i++) {
    if (pools[i].length % 2 === 0) {
      continue;
    }
    if (i + 1 < pools.length) {
      const floater = pools[i].pop()!;
      pools[i + 1].unshift(floater);
      continue;
    }
    // Последний пул нечётный — bye слабейшему (без повторного bye по возможности)
    const byeCandidates = [...pools[i]].sort((a, b) => b.seed - a.seed);
    byeTeam =
      byeCandidates.find((t) => !teamsHadBye.has(t.team_id)) ??
      byeCandidates[0];
    pools[i] = pools[i].filter((t) => t.team_id !== byeTeam!.team_id);
  }

  const fixtures: SwissMatchFixture[] = [];
  let court = courtStart;

  for (const pool of pools) {
    if (pool.length === 0) {
      continue;
    }
    const pairs = pairWithinPool(pool, played);
    if (!pairs) {
      throw new Error(
        `Не удалось составить пары тура ${roundNumber} без повторов`,
      );
    }
    for (const [a, b] of pairs) {
      const higher = a.seed <= b.seed ? a : b;
      const lower = a.seed <= b.seed ? b : a;
      fixtures.push({
        round_number: roundNumber,
        team_a_id: higher.team_id,
        team_b_id: lower.team_id,
        is_bye: false,
        court: court++,
      });
      played.add(pairKey(a.team_id, b.team_id));
    }
  }

  if (byeTeam) {
    fixtures.push({
      round_number: roundNumber,
      team_a_id: byeTeam.team_id,
      team_b_id: null,
      is_bye: true,
      court: null,
      score_a: 13,
      score_b: 0,
    });
  }

  return fixtures;
}

export function isRoundComplete(
  matches: SwissMatchScores[],
  roundNumber: number,
): boolean {
  const roundMatches = matches.filter((m) => m.round_number === roundNumber);
  if (roundMatches.length === 0) {
    return false;
  }
  return roundMatches.every(
    (m) => m.is_bye || (m.score_a != null && m.score_b != null),
  );
}

export function maxRoundNumber(matches: Array<{ round_number: number }>): number {
  if (matches.length === 0) {
    return 0;
  }
  return Math.max(...matches.map((m) => m.round_number));
}

export function computeSwissStandings(
  seeds: SwissSeedEntry[],
  matches: SwissMatchScores[],
): SwissStandingRow[] {
  const stats = computeWinsByTeam(seeds, matches);
  const rows: SwissStandingRow[] = seeds.map((s) => {
    const st = stats.get(s.team_id)!;
    return {
      team_id: s.team_id,
      seed: s.seed,
      rating: s.rating,
      random_tie: s.random_tie,
      wins: st.wins,
      point_diff: st.point_diff,
      points_for: st.points_for,
      played: st.played,
      place: 0,
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    if (b.point_diff !== a.point_diff) {
      return b.point_diff - a.point_diff;
    }
    if (b.points_for !== a.points_for) {
      return b.points_for - a.points_for;
    }
    return a.seed - b.seed;
  });

  rows.forEach((r, i) => {
    r.place = i + 1;
  });
  return rows;
}

export function countCompletedRounds(
  matches: SwissMatchScores[],
  swissRounds: number,
): number {
  let completed = 0;
  for (let r = 1; r <= swissRounds; r++) {
    if (isRoundComplete(matches, r)) {
      completed = r;
    } else {
      break;
    }
  }
  return completed;
}

export function buildSwissStageView(
  seeds: SwissSeedEntry[],
  teams: Array<{ team_id: number; players: string[] }>,
  matches: SwissMatchView[],
  swissRounds: number,
): SwissStageView {
  const teamById = new Map(teams.map((t) => [t.team_id, t]));
  const scoreRows: SwissMatchScores[] = matches.map((m) => ({
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    score_a: m.score_a,
    score_b: m.score_b,
    is_bye: m.is_bye,
    round_number: m.round_number,
  }));
  const standings = computeSwissStandings(seeds, scoreRows);
  const completed_rounds = countCompletedRounds(scoreRows, swissRounds);

  return {
    swiss_rounds: swissRounds,
    completed_rounds,
    standings: standings.map((s) => ({
      team_id: s.team_id,
      players: teamById.get(s.team_id)?.players ?? [],
      seed: s.seed,
      rating: s.rating,
      random_tie: s.random_tie,
      wins: s.wins,
      point_diff: s.point_diff,
      points_for: s.points_for,
      played: s.played,
      place: s.place,
    })),
    matches,
  };
}

/** Следующий свободный номер дорожки после уже созданных матчей. */
export function nextCourtStart(
  matches: Array<{ court: number | null }>,
): number {
  let max = 0;
  for (const m of matches) {
    if (m.court != null && m.court > max) {
      max = m.court;
    }
  }
  return max + 1;
}

export function seedByTeamId(seeds: SwissSeedEntry[]): Map<number, SwissSeedEntry> {
  return new Map(seeds.map((s) => [s.team_id, s]));
}
