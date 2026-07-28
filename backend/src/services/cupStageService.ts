import { validateMatchScores } from "./groupStageService";
import type { CupStageConfig } from "../types";

export type CupBracketCode = "AB" | "A" | "B" | "C" | "D";

export type { CupStageConfig };

export type QualifiedTeam = {
  team_id: number;
  group_number: number;
  place: number;
  wins: number;
  point_diff: number;
  points_for: number;
};

export type CupMatchFixture = {
  cup: CupBracketCode;
  round_number: number;
  match_index: number;
  team_a_id: number | null;
  team_b_id: number | null;
  court: number | null;
  is_third_place: boolean;
  next_match_round: number | null;
  next_match_index: number | null;
  next_slot: "a" | "b" | null;
  loser_next_match_round: number | null;
  loser_next_match_index: number | null;
  loser_next_slot: "a" | "b" | null;
};

export const CUP_SIZE_OPTIONS = [2, 4, 8, 16] as const;

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

export function parseCupStageConfig(raw: unknown): CupStageConfig | null {
  if (raw == null) {
    return null;
  }
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const obj = value as Record<string, unknown>;
  const a = Number(obj.a);
  const b = Number(obj.b ?? 0);
  const c = Number(obj.c ?? 0);
  const d = Number(obj.d ?? 0);
  const ab = Boolean(obj.ab_playoff);
  if (!isPowerOfTwo(a)) {
    return null;
  }
  for (const size of [b, c, d]) {
    if (size !== 0 && !isPowerOfTwo(size)) {
      return null;
    }
  }
  if (ab && !(a === 8 && b === 8)) {
    return null;
  }
  const config: CupStageConfig = { a, b, c, d, ab_playoff: ab };
  if (obj.pools && typeof obj.pools === "object") {
    config.pools = obj.pools as CupStageConfig["pools"];
  }
  return config;
}

export function validateCupStageConfig(
  config: CupStageConfig,
  availableTeams: number,
): string | null {
  if (!isPowerOfTwo(config.a)) {
    return "Размер кубка A должен быть 2, 4, 8 или 16";
  }
  for (const [label, size] of [
    ["B", config.b],
    ["C", config.c],
    ["D", config.d],
  ] as const) {
    if (size !== 0 && !isPowerOfTwo(size)) {
      return `Размер кубка ${label} должен быть 2, 4, 8 или 16`;
    }
  }
  if (config.ab_playoff && !(config.a === 8 && config.b === 8)) {
    return "Стыковая игра AB доступна только при кубках A=8 и B=8";
  }
  const needed = config.ab_playoff
    ? 16 + config.c + config.d
    : config.a + config.b + config.c + config.d;
  if (needed > availableTeams) {
    return `Недостаточно команд: нужно ${needed}, доступно ${availableTeams}`;
  }
  if (needed < 2) {
    return "Укажите хотя бы кубок A";
  }
  return null;
}

function compareStrength(a: QualifiedTeam, b: QualifiedTeam): number {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  if (b.point_diff !== a.point_diff) {
    return b.point_diff - a.point_diff;
  }
  if (b.points_for !== a.points_for) {
    return b.points_for - a.points_for;
  }
  return a.team_id - b.team_id;
}

/** Лента квалификации: все 1-е, затем лучшие 2-е, … */
export function rankTeamsFromGroups(teams: QualifiedTeam[]): QualifiedTeam[] {
  const byPlace = new Map<number, QualifiedTeam[]>();
  for (const t of teams) {
    if (t.place <= 0) {
      continue;
    }
    if (!byPlace.has(t.place)) {
      byPlace.set(t.place, []);
    }
    byPlace.get(t.place)!.push(t);
  }
  const places = [...byPlace.keys()].sort((a, b) => a - b);
  const ranked: QualifiedTeam[] = [];
  for (const place of places) {
    const pool = byPlace.get(place)!;
    pool.sort(compareStrength);
    ranked.push(...pool);
  }
  return ranked;
}

export function allocateCups(
  ranked: QualifiedTeam[],
  config: CupStageConfig,
): {
  ab: QualifiedTeam[];
  A: QualifiedTeam[];
  B: QualifiedTeam[];
  C: QualifiedTeam[];
  D: QualifiedTeam[];
} {
  let offset = 0;
  const take = (n: number) => {
    const slice = ranked.slice(offset, offset + n);
    offset += n;
    return slice;
  };

  if (config.ab_playoff) {
    const ab = take(16);
    return {
      ab,
      A: [],
      B: [],
      C: take(config.c),
      D: take(config.d),
    };
  }
  return {
    ab: [],
    A: take(config.a),
    B: take(config.b),
    C: take(config.c),
    D: take(config.d),
  };
}

type Pair = [QualifiedTeam, QualifiedTeam];

/**
 * Пары 1-го раунда: максимум P1×P2, без повтора группы по возможности.
 */
export function pairFirstRound(teams: QualifiedTeam[]): Pair[] {
  if (teams.length < 2 || teams.length % 2 !== 0) {
    throw new Error("Для пар нужен чётный состав");
  }

  const remaining = [...teams].sort(compareStrength);
  const pairs: Pair[] = [];
  const targetPairs = teams.length / 2;

  while (pairs.length < targetPairs && remaining.length >= 2) {
    // Берём сильнейшего оставшегося из лучших мест
    remaining.sort((a, b) => {
      if (a.place !== b.place) {
        return a.place - b.place;
      }
      return compareStrength(a, b);
    });
    const first = remaining.shift()!;

    // Ищем соперника: предпочтительно другое место и другая группа
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let score = 0;
      // разнос мест (чем больше разница place — тем лучше для «1 vs 2»)
      score += Math.abs(cand.place - first.place) * 100;
      // предпочитаем более слабое место у соперника
      score += cand.place * 10;
      if (cand.group_number !== first.group_number) {
        score += 50;
      } else {
        score -= 200;
      }
      // чуть предпочитаем более слабого по силе
      score += -compareStrength(cand, first) * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const second = remaining.splice(bestIdx, 1)[0];
    // В паре «лучший» (меньше place / сильнее) слева
    if (
      first.place < second.place ||
      (first.place === second.place && compareStrength(first, second) < 0)
    ) {
      pairs.push([first, second]);
    } else {
      pairs.push([second, first]);
    }
  }

  return pairs;
}

function emptyFixture(
  partial: Partial<CupMatchFixture> &
    Pick<CupMatchFixture, "cup" | "round_number" | "match_index">,
): CupMatchFixture {
  return {
    team_a_id: null,
    team_b_id: null,
    court: null,
    is_third_place: false,
    next_match_round: null,
    next_match_index: null,
    next_slot: null,
    loser_next_match_round: null,
    loser_next_match_index: null,
    loser_next_slot: null,
    ...partial,
  };
}

/**
 * Раскладка пар по слотам R1: чередование половин сетки.
 */
export function orderPairsForBracket(pairs: Pair[]): Pair[] {
  if (pairs.length <= 1) {
    return pairs;
  }
  const ordered: Pair[] = new Array(pairs.length);
  let lo = 0;
  let hi = pairs.length - 1;
  let toggle = true;
  for (const pair of pairs) {
    if (toggle) {
      ordered[lo++] = pair;
    } else {
      ordered[hi--] = pair;
    }
    toggle = !toggle;
  }
  return ordered;
}

export function generateBracketFixtures(
  cup: CupBracketCode,
  teams: QualifiedTeam[],
  courtStart: number = 1,
): CupMatchFixture[] {
  if (!isPowerOfTwo(teams.length)) {
    throw new Error(`Размер сетки ${cup} должен быть степенью двойки`);
  }

  const size = teams.length;
  const rounds = Math.log2(size);
  const pairs = orderPairsForBracket(pairFirstRound(teams));
  const fixtures: CupMatchFixture[] = [];
  let court = courtStart;

  // Round 1
  // При size=4 первый раунд — полуфинал: проигравшие идут в матч за 3-е.
  const round1IsSemi = rounds === 2 && size >= 4;
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const nextRound = rounds === 1 ? null : 2;
    const nextIndex = rounds === 1 ? null : Math.floor(i / 2);
    const nextSlot: "a" | "b" | null =
      rounds === 1 ? null : i % 2 === 0 ? "a" : "b";
    fixtures.push(
      emptyFixture({
        cup,
        round_number: 1,
        match_index: i,
        team_a_id: a.team_id,
        team_b_id: b.team_id,
        court: court++,
        next_match_round: nextRound,
        next_match_index: nextIndex,
        next_slot: nextSlot,
        loser_next_match_round: round1IsSemi ? rounds : null,
        loser_next_match_index: round1IsSemi ? 0 : null,
        loser_next_slot: round1IsSemi ? (i % 2 === 0 ? "a" : "b") : null,
      }),
    );
  }

  // Later rounds (empty slots)
  for (let round = 2; round <= rounds; round++) {
    const matchCount = size / 2 ** round;
    const isSemi = round === rounds - 1 && size >= 4;
    const isFinal = round === rounds;
    for (let i = 0; i < matchCount; i++) {
      const hasNext = round < rounds;
      fixtures.push(
        emptyFixture({
          cup,
          round_number: round,
          match_index: i,
          court: court++,
          next_match_round: hasNext ? round + 1 : null,
          next_match_index: hasNext ? Math.floor(i / 2) : null,
          next_slot: hasNext ? (i % 2 === 0 ? "a" : "b") : null,
          // SF losers → 3rd place
          loser_next_match_round: isSemi ? rounds : null,
          loser_next_match_index: isSemi ? 0 : null,
          loser_next_slot: isSemi ? (i % 2 === 0 ? "a" : "b") : null,
          is_third_place: false,
        }),
      );
      void isFinal;
    }
  }

  if (size >= 4) {
    fixtures.push(
      emptyFixture({
        cup,
        round_number: rounds,
        match_index: 0,
        court: court++,
        is_third_place: true,
      }),
    );
  }

  return fixtures;
}

/** Однораундовая стыковая сетка AB (16 команд → 8 матчей). */
export function generateAbPlayoffFixtures(
  teams: QualifiedTeam[],
  courtStart: number = 1,
): CupMatchFixture[] {
  if (teams.length !== 16) {
    throw new Error("Стыковая игра AB требует ровно 16 команд");
  }
  const pairs = orderPairsForBracket(pairFirstRound(teams));
  let court = courtStart;
  return pairs.map(([a, b], i) =>
    emptyFixture({
      cup: "AB",
      round_number: 1,
      match_index: i,
      team_a_id: a.team_id,
      team_b_id: b.team_id,
      court: court++,
    }),
  );
}

export function buildAllCupFixtures(
  allocation: ReturnType<typeof allocateCups>,
  config: CupStageConfig,
): CupMatchFixture[] {
  const all: CupMatchFixture[] = [];
  let court = 1;

  if (config.ab_playoff) {
    const ab = generateAbPlayoffFixtures(allocation.ab, court);
    all.push(...ab);
    court += ab.length;
    // A/B генерируются после завершения AB
  } else {
    for (const [code, teams] of [
      ["A", allocation.A],
      ["B", allocation.B],
    ] as const) {
      if (teams.length === 0) {
        continue;
      }
      const fixtures = generateBracketFixtures(code, teams, court);
      all.push(...fixtures);
      court += fixtures.length;
    }
  }

  for (const [code, teams] of [
    ["C", allocation.C],
    ["D", allocation.D],
  ] as const) {
    if (teams.length === 0) {
      continue;
    }
    const fixtures = generateBracketFixtures(code, teams, court);
    all.push(...fixtures);
    court += fixtures.length;
  }

  return all;
}

/**
 * После завершения всех матчей AB: победители → A, проигравшие → B
 * (сохраняем порядок match_index для стабильного посева).
 */
export function buildAbResultQualified(
  abMatches: {
    match_index: number;
    team_a_id: number;
    team_b_id: number;
    score_a: number;
    score_b: number;
  }[],
  originalAbTeams: QualifiedTeam[],
): { winners: QualifiedTeam[]; losers: QualifiedTeam[] } {
  const byId = new Map(originalAbTeams.map((t) => [t.team_id, t]));
  const sorted = [...abMatches].sort((a, b) => a.match_index - b.match_index);
  const winners: QualifiedTeam[] = [];
  const losers: QualifiedTeam[] = [];
  for (const m of sorted) {
    const winnerId = m.score_a > m.score_b ? m.team_a_id : m.team_b_id;
    const loserId = m.score_a > m.score_b ? m.team_b_id : m.team_a_id;
    const w = byId.get(winnerId);
    const l = byId.get(loserId);
    if (!w || !l) {
      throw new Error("Не найдены команды стыкового матча");
    }
    winners.push(w);
    losers.push(l);
  }
  return { winners, losers };
}

export { validateMatchScores };
