import {
  collectPlayedPairs,
  computeSwissStandings,
  pairNextRoundByScoreGroups,
  pairRound1HalfMethod,
  seedTeamsByRating,
  type SwissMatchScores,
  type SwissSeedEntry,
} from "../swissStageService";

function seedsFromIds(ids: number[]): SwissSeedEntry[] {
  return ids.map((team_id, i) => ({
    team_id,
    seed: i + 1,
    rating: 100 - i,
    random_tie: 50,
  }));
}

describe("seedTeamsByRating", () => {
  it("сортирует по рейтингу DESC, при равенстве — по random_tie", () => {
    const seq = [10, 90, 40];
    let i = 0;
    const seeded = seedTeamsByRating(
      [
        { team_id: 1, rating: 100 },
        { team_id: 2, rating: 100 },
        { team_id: 3, rating: 50 },
      ],
      () => seq[i++],
    );
    expect(seeded.map((s) => s.team_id)).toEqual([2, 1, 3]);
    expect(seeded[0].random_tie).toBe(90);
    expect(seeded[1].random_tie).toBe(10);
  });
});

describe("pairRound1HalfMethod", () => {
  it("для 40 команд: 1–21 … 20–40", () => {
    const seeds = seedsFromIds(Array.from({ length: 40 }, (_, i) => i + 1));
    const fixtures = pairRound1HalfMethod(seeds);
    expect(fixtures.filter((f) => !f.is_bye)).toHaveLength(20);
    expect(fixtures.filter((f) => f.is_bye)).toHaveLength(0);
    expect(fixtures[0]).toMatchObject({
      team_a_id: 1,
      team_b_id: 21,
    });
    expect(fixtures[19]).toMatchObject({
      team_a_id: 20,
      team_b_id: 40,
    });
  });

  it("для 5 команд: 1–3, 2–4, bye 5", () => {
    const seeds = seedsFromIds([11, 22, 33, 44, 55]);
    const fixtures = pairRound1HalfMethod(seeds);
    const pairs = fixtures.filter((f) => !f.is_bye);
    const byes = fixtures.filter((f) => f.is_bye);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ team_a_id: 11, team_b_id: 33 });
    expect(pairs[1]).toMatchObject({ team_a_id: 22, team_b_id: 44 });
    expect(byes).toHaveLength(1);
    expect(byes[0].team_a_id).toBe(55);
    expect(byes[0].score_a).toBe(13);
  });
});

describe("pairNextRoundByScoreGroups", () => {
  it("сводит команды с одинаковым числом побед и избегает rematch", () => {
    const seeds = seedsFromIds([1, 2, 3, 4]);
    const round1: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 3,
        score_a: 13,
        score_b: 5,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 2,
        team_b_id: 4,
        score_a: 13,
        score_b: 7,
        is_bye: false,
      },
    ];
    // победы: 1,2 → 1; 3,4 → 0. Пары: 1–2 и 3–4 (не rematch 1–3 / 2–4)
    const round2 = pairNextRoundByScoreGroups(seeds, round1, 2);
    const pairs = round2
      .filter((f) => !f.is_bye)
      .map((f) => [f.team_a_id, f.team_b_id!].sort((a, b) => a - b).join("-"));
    expect(pairs.sort()).toEqual(["1-2", "3-4"]);
    const played = collectPlayedPairs([...round1, ...round2.map((f) => ({
      team_a_id: f.team_a_id,
      team_b_id: f.team_b_id,
      score_a: f.score_a ?? null,
      score_b: f.score_b ?? null,
      is_bye: f.is_bye,
      round_number: f.round_number,
    }))]);
    expect(played.size).toBe(4);
  });

  it("при нечётной score-группе слабейший идёт к лучшему нижестоящей", () => {
    const seeds = seedsFromIds([1, 2, 3, 4, 5]);
    // Тур 1: 1–3, 2–4, bye 5 → wins: 1,2,5 = 1; 3,4 = 0
    const round1: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 3,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 2,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 5,
        team_b_id: null,
        score_a: 13,
        score_b: 0,
        is_bye: true,
      },
    ];
    // пул wins=1: 1,2,5 (нечёт) → floater 5 к пулу 0: 3,4 → пул: 5,3,4
    // пары: 1–2 и среди 5,3,4 один bye или 3 пары? 5+3+4 = 3 нечёт → bye слабому
    // после floater: pool1=[1,2], pool0=[5,3,4]
    // pool0 нечёт → bye у 4 (худший сид), пары 5–3
    const round2 = pairNextRoundByScoreGroups(seeds, round1, 2);
    const real = round2.filter((f) => !f.is_bye);
    const byes = round2.filter((f) => f.is_bye);
    expect(real.some((f) =>
      (f.team_a_id === 1 && f.team_b_id === 2) ||
      (f.team_a_id === 2 && f.team_b_id === 1),
    )).toBe(true);
    expect(byes).toHaveLength(1);
    expect(byes[0].team_a_id).toBe(4);
  });
});

describe("computeSwissStandings", () => {
  it("ранжирует по победам и разнице", () => {
    const seeds = seedsFromIds([1, 2, 3, 4]);
    const matches: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 3,
        score_a: 13,
        score_b: 5,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 2,
        team_b_id: 4,
        score_a: 13,
        score_b: 10,
        is_bye: false,
      },
    ];
    const standings = computeSwissStandings(seeds, matches);
    expect(standings[0].team_id).toBe(1);
    expect(standings[1].team_id).toBe(2);
    expect(standings.map((s) => s.place)).toEqual([1, 2, 3, 4]);
  });
});
