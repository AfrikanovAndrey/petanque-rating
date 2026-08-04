import { TiebreakerCriterion, TournamentType } from "../types";

/** Технический участник «Свободен» (только в swiss_seed / отображении; в матчах — is_bye). */
export const SWISS_FREE_TEAM_ID = -1;
export const SWISS_FREE_TEAM_NAME = "Свободен";
/** Автопобеда над «Свободен». */
export const SWISS_FREE_SCORE_FOR = 13;
export const SWISS_FREE_SCORE_AGAINST = 7;

export function isSwissFreeTeamId(teamId: number | null | undefined): boolean {
  return teamId === SWISS_FREE_TEAM_ID;
}

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
  /** Для матча со «Свободен» сразу фиксируем автопобеду 13:7 */
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

export type SwissTiebreakerValues = Partial<
  Record<TiebreakerCriterion, number>
>;

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
  tiebreakers: SwissTiebreakerValues;
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
  tiebreakers: SwissTiebreakerValues;
};

export type SwissStageView = {
  swiss_rounds: number;
  completed_rounds: number;
  tiebreaker_order: TiebreakerCriterion[];
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
      (teamId <= 0 && teamId !== SWISS_FREE_TEAM_ID) ||
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
 * При нечётном числе команд добавляет технического участника «Свободен» последним сидом.
 */
export function appendSwissFreeSeedIfOdd(
  seeds: SwissSeedEntry[],
): SwissSeedEntry[] {
  if (seeds.length === 0 || seeds.length % 2 === 0) {
    return seeds;
  }
  if (seeds.some((s) => isSwissFreeTeamId(s.team_id))) {
    return seeds;
  }
  const maxSeed = Math.max(...seeds.map((s) => s.seed));
  return [
    ...seeds,
    {
      team_id: SWISS_FREE_TEAM_ID,
      seed: maxSeed + 1,
      rating: 0,
      random_tie: 0,
    },
  ];
}

/** Матч против «Свободен»: автопобеда 13:7 (team_b_id=null из‑за FK). */
function freeMatchFixture(
  roundNumber: number,
  realTeamId: number,
): SwissMatchFixture {
  return {
    round_number: roundNumber,
    team_a_id: realTeamId,
    team_b_id: null,
    is_bye: true,
    court: null,
    score_a: SWISS_FREE_SCORE_FOR,
    score_b: SWISS_FREE_SCORE_AGAINST,
  };
}

/**
 * Тур 1 — half-метод: i ↔ i+half.
 * При нечётном N сначала добавляется «Свободен» (последний сид);
 * пара с ним — автопобеда 13:7.
 */
export function pairRound1HalfMethod(
  seeds: SwissSeedEntry[],
  courtStart: number = 1,
): SwissMatchFixture[] {
  const ordered = appendSwissFreeSeedIfOdd(
    [...seeds].sort((a, b) => a.seed - b.seed),
  );
  const n = ordered.length;
  if (n < 2) {
    if (n === 1) {
      return [freeMatchFixture(1, ordered[0].team_id)];
    }
    return [];
  }

  const fixtures: SwissMatchFixture[] = [];
  let court = courtStart;
  const pairCount = Math.floor(n / 2);
  const half = pairCount;

  for (let i = 0; i < pairCount; i++) {
    const a = ordered[i];
    const b = ordered[i + half];
    if (isSwissFreeTeamId(a.team_id) || isSwissFreeTeamId(b.team_id)) {
      const real = isSwissFreeTeamId(a.team_id) ? b : a;
      fixtures.push(freeMatchFixture(1, real.team_id));
      continue;
    }
    fixtures.push({
      round_number: 1,
      team_a_id: a.team_id,
      team_b_id: b.team_id,
      is_bye: false,
      court: court++,
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
      played.add(pairKey(m.team_a_id, SWISS_FREE_TEAM_ID));
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
      // Автопобеда над «Свободен» всегда 13:7 (в т.ч. старые записи с 13:0).
      const scoreFor = SWISS_FREE_SCORE_FOR;
      const scoreAgainst = SWISS_FREE_SCORE_AGAINST;
      a.wins += 1;
      a.played += 1;
      a.points_for += scoreFor;
      a.point_diff += scoreFor - scoreAgainst;
      const free = stats.get(SWISS_FREE_TEAM_ID);
      if (free) {
        free.played += 1;
        free.points_for += scoreAgainst;
        free.point_diff += scoreAgainst - scoreFor;
      }
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

function canPair(
  a: PairCandidate,
  b: PairCandidate,
  played: Set<string>,
): boolean {
  if (isSwissFreeTeamId(a.team_id) && isSwissFreeTeamId(b.team_id)) {
    return false;
  }
  if (isSwissFreeTeamId(a.team_id) || isSwissFreeTeamId(b.team_id)) {
    const real = isSwissFreeTeamId(a.team_id) ? b : a;
    return !played.has(pairKey(real.team_id, SWISS_FREE_TEAM_ID));
  }
  return !played.has(pairKey(a.team_id, b.team_id));
}

/**
 * Direct pairing внутри группы с одинаковым числом побед:
 * участники упорядочены по сиду, верхняя половина играет с нижней по порядку
 * (1↔k+1, 2↔k+2, …). При уже сыгранных парах — сдвиг нижней половины;
 * если не удалось — backtracking с предпочтением соперников из нижней половины.
 */
function pairDirectWithinPool(
  pool: PairCandidate[],
  played: Set<string>,
): Array<[PairCandidate, PairCandidate]> | null {
  if (pool.length === 0) {
    return [];
  }
  if (pool.length % 2 !== 0) {
    return null;
  }

  const ordered = [...pool].sort((a, b) => a.seed - b.seed);
  const half = ordered.length / 2;

  for (let offset = 0; offset < half; offset++) {
    const pairs: Array<[PairCandidate, PairCandidate]> = [];
    let ok = true;
    for (let i = 0; i < half; i++) {
      const a = ordered[i];
      const b = ordered[half + ((i + offset) % half)];
      if (!canPair(a, b, played)) {
        ok = false;
        break;
      }
      pairs.push([a, b]);
    }
    if (ok) {
      return pairs;
    }
  }

  return pairWithinPoolBacktrack(ordered, played);
}

/**
 * Backtracking: для каждого сверху предпочитаем соперника из нижней половины
 * (ближе к Direct), затем остальных.
 */
function pairWithinPoolBacktrack(
  ordered: PairCandidate[],
  played: Set<string>,
): Array<[PairCandidate, PairCandidate]> | null {
  const remaining = [...ordered];
  const pairs: Array<[PairCandidate, PairCandidate]> = [];
  const half = ordered.length / 2;

  function partnerOrder(a: PairCandidate, rest: PairCandidate[]): PairCandidate[] {
    const idealIndex = ordered.findIndex((t) => t.team_id === a.team_id);
    const idealPartner =
      idealIndex >= 0 && idealIndex < half
        ? ordered[idealIndex + half]
        : idealIndex >= half
          ? ordered[idealIndex - half]
          : null;
    return [...rest].sort((x, y) => {
      const ix = idealPartner && x.team_id === idealPartner.team_id ? 0 : 1;
      const iy = idealPartner && y.team_id === idealPartner.team_id ? 0 : 1;
      if (ix !== iy) {
        return ix - iy;
      }
      return x.seed - y.seed;
    });
  }

  function solve(): boolean {
    if (remaining.length === 0) {
      return true;
    }
    const a = remaining[0];
    const candidates = partnerOrder(a, remaining.slice(1));
    for (const b of candidates) {
      if (!canPair(a, b, played)) {
        continue;
      }
      const bi = remaining.findIndex((t) => t.team_id === b.team_id);
      remaining.splice(bi, 1);
      remaining.shift();
      pairs.push([a, b]);
      if (solve()) {
        return true;
      }
      pairs.pop();
      remaining.unshift(a);
      remaining.splice(bi, 0, b);
    }
    return false;
  }

  return solve() ? pairs : null;
}

function pushPairedFixture(
  fixtures: SwissMatchFixture[],
  played: Set<string>,
  roundNumber: number,
  a: PairCandidate,
  b: PairCandidate,
  courtRef: { court: number },
): void {
  if (isSwissFreeTeamId(a.team_id) || isSwissFreeTeamId(b.team_id)) {
    const real = isSwissFreeTeamId(a.team_id) ? b : a;
    fixtures.push(freeMatchFixture(roundNumber, real.team_id));
    played.add(pairKey(real.team_id, SWISS_FREE_TEAM_ID));
    return;
  }
  const higher = a.seed <= b.seed ? a : b;
  const lower = a.seed <= b.seed ? b : a;
  fixtures.push({
    round_number: roundNumber,
    team_a_id: higher.team_id,
    team_b_id: lower.team_id,
    is_bye: false,
    court: courtRef.court++,
  });
  played.add(pairKey(a.team_id, b.team_id));
}

/**
 * Туры 2+: группы по победам, внутри — Direct pairing по сиду.
 * Нечётная группа — худший по сиду («floater») играет с лучшим
 * нижестоящей группы отдельной парой (не вливается в её Direct).
 * Пара со «Свободен» — автопобеда 13:7.
 */
export function pairNextRoundByScoreGroups(
  seeds: SwissSeedEntry[],
  matchesSoFar: SwissMatchScores[],
  roundNumber: number,
  courtStart: number = 1,
): SwissMatchFixture[] {
  const allSeeds = appendSwissFreeSeedIfOdd(seeds);
  const stats = computeWinsByTeam(allSeeds, matchesSoFar);
  const played = collectPlayedPairs(matchesSoFar);

  const candidates: PairCandidate[] = allSeeds.map((s) => ({
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

  let freeOpponent: PairCandidate | null = null;
  const floatPairs: Array<[PairCandidate, PairCandidate]> = [];

  // Нечётный пул: худший из лучших ↔ лучший из худших (отдельная пара)
  for (let i = 0; i < pools.length; i++) {
    if (pools[i].length % 2 === 0) {
      continue;
    }
    if (i + 1 < pools.length) {
      const floater = pools[i][pools[i].length - 1];
      const lower = pools[i + 1];
      let partnerIndex = -1;
      for (let j = 0; j < lower.length; j++) {
        if (canPair(floater, lower[j], played)) {
          partnerIndex = j;
          break;
        }
      }
      if (partnerIndex < 0) {
        throw new Error(
          `Не удалось найти соперника для floater (team ${floater.team_id}) в нижестоящей группе тура ${roundNumber}`,
        );
      }
      pools[i].pop();
      const partner = lower.splice(partnerIndex, 1)[0];
      floatPairs.push([floater, partner]);
      if (isSwissFreeTeamId(floater.team_id) || isSwissFreeTeamId(partner.team_id)) {
        const real = isSwissFreeTeamId(floater.team_id) ? partner : floater;
        played.add(pairKey(real.team_id, SWISS_FREE_TEAM_ID));
      } else {
        played.add(pairKey(floater.team_id, partner.team_id));
      }
      continue;
    }
    // Последний пул нечётный — соперник «Свободен» (не сам «Свободен»)
    const byeCandidates = [...pools[i]]
      .filter((t) => !isSwissFreeTeamId(t.team_id))
      .sort((a, b) => b.seed - a.seed);
    freeOpponent =
      byeCandidates.find(
        (t) => !played.has(pairKey(t.team_id, SWISS_FREE_TEAM_ID)),
      ) ??
      byeCandidates[0] ??
      null;
    if (freeOpponent) {
      pools[i] = pools[i].filter((t) => t.team_id !== freeOpponent!.team_id);
    }
  }

  const fixtures: SwissMatchFixture[] = [];
  const courtRef = { court: courtStart };

  for (const [a, b] of floatPairs) {
    pushPairedFixture(fixtures, played, roundNumber, a, b, courtRef);
  }

  for (const pool of pools) {
    if (pool.length === 0) {
      continue;
    }
    const pairs = pairDirectWithinPool(pool, played);
    if (!pairs) {
      throw new Error(
        `Не удалось составить пары тура ${roundNumber} без повторов`,
      );
    }
    for (const [a, b] of pairs) {
      pushPairedFixture(fixtures, played, roundNumber, a, b, courtRef);
    }
  }

  if (freeOpponent) {
    fixtures.push(freeMatchFixture(roundNumber, freeOpponent.team_id));
    played.add(pairKey(freeOpponent.team_id, SWISS_FREE_TEAM_ID));
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

type PlayedEncounter = {
  opponentId: number;
  /**
   * Множитель для коэффициента Бергера:
   * 1 — победа над этим соперником,
   * 0 — поражение (или ничья).
   */
  bergerWeight: number;
  round_number: number;
};

function collectEncounters(
  matches: SwissMatchScores[],
): Map<number, PlayedEncounter[]> {
  const byTeam = new Map<number, PlayedEncounter[]>();
  const push = (teamId: number, enc: PlayedEncounter) => {
    if (!byTeam.has(teamId)) {
      byTeam.set(teamId, []);
    }
    byTeam.get(teamId)!.push(enc);
  };

  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) {
      continue;
    }
    if (m.is_bye || m.team_b_id == null) {
      // Матч со «Свободен»: учитываем как встречу с техническим участником
      push(m.team_a_id, {
        opponentId: SWISS_FREE_TEAM_ID,
        bergerWeight: 1,
        round_number: m.round_number,
      });
      push(SWISS_FREE_TEAM_ID, {
        opponentId: m.team_a_id,
        bergerWeight: 0,
        round_number: m.round_number,
      });
      continue;
    }
    const weightA = m.score_a > m.score_b ? 1 : 0;
    const weightB = m.score_b > m.score_a ? 1 : 0;
    push(m.team_a_id, {
      opponentId: m.team_b_id,
      bergerWeight: weightA,
      round_number: m.round_number,
    });
    push(m.team_b_id, {
      opponentId: m.team_a_id,
      bergerWeight: weightB,
      round_number: m.round_number,
    });
  }
  return byTeam;
}

/**
 * Доп. показатели швейцарки.
 * Бухгольц = сумма побед всех оппонентов за турнир (у «Свободен» обычно 0).
 * Двойной Бухгольц = сумма Бухгольцев оппонентов.
 * Бергер = Σ (победы_соперника × множитель), где множитель = 1 при победе
 * над соперником и 0 при поражении ему (поражения не учитываются).
 * Прогресс = сумма «текущих побед» после каждого сыгранного тура.
 * Разница очков = point_diff.
 */
export function computeSwissTiebreakers(
  teamIds: number[],
  winsByTeam: Map<number, number>,
  pointDiffByTeam: Map<number, number>,
  matches: SwissMatchScores[],
  criteria: TiebreakerCriterion[],
): Map<number, SwissTiebreakerValues> {
  const needed = new Set(criteria);
  const encounters = collectEncounters(matches);
  const result = new Map<number, SwissTiebreakerValues>();
  for (const id of teamIds) {
    result.set(id, {});
  }
  if (needed.size === 0) {
    return result;
  }

  const buchholz = new Map<number, number>();
  if (
    needed.has(TiebreakerCriterion.BUCHHOLZ) ||
    needed.has(TiebreakerCriterion.DOUBLE_BUCHHOLZ) ||
    needed.has(TiebreakerCriterion.BERGER)
  ) {
    for (const id of teamIds) {
      const enc = encounters.get(id) ?? [];
      let sum = 0;
      for (const e of enc) {
        sum += winsByTeam.get(e.opponentId) ?? 0;
      }
      buchholz.set(id, sum);
    }
  }

  if (needed.has(TiebreakerCriterion.BUCHHOLZ)) {
    for (const id of teamIds) {
      result.get(id)![TiebreakerCriterion.BUCHHOLZ] = buchholz.get(id) ?? 0;
    }
  }

  if (needed.has(TiebreakerCriterion.DOUBLE_BUCHHOLZ)) {
    for (const id of teamIds) {
      const enc = encounters.get(id) ?? [];
      let sum = 0;
      for (const e of enc) {
        sum += buchholz.get(e.opponentId) ?? 0;
      }
      result.get(id)![TiebreakerCriterion.DOUBLE_BUCHHOLZ] = sum;
    }
  }

  if (needed.has(TiebreakerCriterion.BERGER)) {
    for (const id of teamIds) {
      const enc = encounters.get(id) ?? [];
      let sum = 0;
      for (const e of enc) {
        // Полная сумма побед соперников, которых обыграли;
        // при поражении множитель 0 — очки этих соперников не входят.
        sum += (winsByTeam.get(e.opponentId) ?? 0) * e.bergerWeight;
      }
      result.get(id)![TiebreakerCriterion.BERGER] = sum;
    }
  }

  if (needed.has(TiebreakerCriterion.PROGRESS)) {
    for (const id of teamIds) {
      // Bye тоже даёт победу в прогрессе
      const scored = matches
        .filter(
          (m) =>
            m.score_a != null &&
            m.score_b != null &&
            (m.team_a_id === id || m.team_b_id === id),
        )
        .sort((a, b) => a.round_number - b.round_number);
      let runningWins = 0;
      let progress = 0;
      for (const m of scored) {
        if (m.is_bye || m.team_b_id == null) {
          if (m.team_a_id === id) {
            runningWins += 1;
          }
        } else {
          const won =
            m.team_a_id === id ? m.score_a! > m.score_b! : m.score_b! > m.score_a!;
          if (won) {
            runningWins += 1;
          }
        }
        progress += runningWins;
      }
      result.get(id)![TiebreakerCriterion.PROGRESS] = progress;
    }
  }

  if (needed.has(TiebreakerCriterion.POINT_DIFF)) {
    for (const id of teamIds) {
      result.get(id)![TiebreakerCriterion.POINT_DIFF] =
        pointDiffByTeam.get(id) ?? 0;
    }
  }

  return result;
}

export function computeSwissStandings(
  seeds: SwissSeedEntry[],
  matches: SwissMatchScores[],
  tiebreakerOrder: TiebreakerCriterion[] = [],
): SwissStandingRow[] {
  const allSeeds = appendSwissFreeSeedIfOdd(seeds);
  const stats = computeWinsByTeam(allSeeds, matches);
  const winsByTeam = new Map<number, number>();
  const pointDiffByTeam = new Map<number, number>();
  for (const s of allSeeds) {
    const st = stats.get(s.team_id)!;
    winsByTeam.set(s.team_id, st.wins);
    pointDiffByTeam.set(s.team_id, st.point_diff);
  }

  const tiebreakers = computeSwissTiebreakers(
    allSeeds.map((s) => s.team_id),
    winsByTeam,
    pointDiffByTeam,
    matches,
    tiebreakerOrder,
  );

  const rows: SwissStandingRow[] = allSeeds.map((s) => {
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
      tiebreakers: tiebreakers.get(s.team_id) ?? {},
    };
  });

  // Места: 1) победы DESC, 2) доп. показатели в порядке настроек турнира DESC,
  // 3) стартовый сид ASC.
  rows.sort((a, b) => compareSwissStandingRows(a, b, tiebreakerOrder));

  rows.forEach((r, i) => {
    r.place = i + 1;
  });
  return rows;
}

/** Сравнение двух строк итогов швейцарки (для сортировки мест). */
export function compareSwissStandingRows(
  a: Pick<SwissStandingRow, "wins" | "seed" | "tiebreakers">,
  b: Pick<SwissStandingRow, "wins" | "seed" | "tiebreakers">,
  tiebreakerOrder: TiebreakerCriterion[],
): number {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  for (const criterion of tiebreakerOrder) {
    const av = a.tiebreakers[criterion] ?? 0;
    const bv = b.tiebreakers[criterion] ?? 0;
    if (bv !== av) {
      return bv - av;
    }
  }
  return a.seed - b.seed;
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
  tiebreakerOrder: TiebreakerCriterion[] | null | undefined = [],
): SwissStageView {
  const order = tiebreakerOrder ?? [];
  const allSeeds = appendSwissFreeSeedIfOdd(seeds);
  const teamById = new Map(teams.map((t) => [t.team_id, t]));
  if (allSeeds.some((s) => isSwissFreeTeamId(s.team_id))) {
    teamById.set(SWISS_FREE_TEAM_ID, {
      team_id: SWISS_FREE_TEAM_ID,
      players: [SWISS_FREE_TEAM_NAME],
    });
  }
  const scoreRows: SwissMatchScores[] = matches.map((m) => ({
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    score_a: m.is_bye ? SWISS_FREE_SCORE_FOR : m.score_a,
    score_b: m.is_bye ? SWISS_FREE_SCORE_AGAINST : m.score_b,
    is_bye: m.is_bye,
    round_number: m.round_number,
  }));
  const completed_rounds = countCompletedRounds(scoreRows, swissRounds);
  // Итоги обновляются только после полного завершения тура —
  // партии текущего незакрытого тура в таблицу не входят.
  const scoredForStandings = scoreRows.filter(
    (m) => m.round_number <= completed_rounds,
  );
  const standings = computeSwissStandings(allSeeds, scoredForStandings, order);

  return {
    swiss_rounds: swissRounds,
    completed_rounds,
    tiebreaker_order: order,
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
      tiebreakers: s.tiebreakers,
    })),
    // В ответе для is_bye всегда отдаём 13:7 (старые 13:0 нормализуем).
    matches: matches.map((m) =>
      m.is_bye
        ? {
            ...m,
            score_a: SWISS_FREE_SCORE_FOR,
            score_b: SWISS_FREE_SCORE_AGAINST,
          }
        : m,
    ),
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
