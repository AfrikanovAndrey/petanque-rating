import {
  buildSwissStageView,
  collectPlayedPairs,
  computeSwissStandings,
  pairNextRoundByScoreGroups,
  pairRound1HalfMethod,
  seedTeamsByRating,
  type SwissMatchScores,
  type SwissMatchView,
  type SwissSeedEntry,
} from "../swissStageService";
import { TiebreakerCriterion } from "../../types";

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

  it("для 5 команд: добавляет «Свободен», пары 1–4, 2–5, 3–Свободен 13:7", () => {
    const seeds = seedsFromIds([11, 22, 33, 44, 55]);
    const fixtures = pairRound1HalfMethod(seeds);
    const pairs = fixtures.filter((f) => !f.is_bye);
    const free = fixtures.filter((f) => f.is_bye);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({ team_a_id: 11, team_b_id: 44 });
    expect(pairs[1]).toMatchObject({ team_a_id: 22, team_b_id: 55 });
    expect(free).toHaveLength(1);
    expect(free[0].team_a_id).toBe(33);
    expect(free[0].team_b_id).toBeNull();
    expect(free[0].score_a).toBe(13);
    expect(free[0].score_b).toBe(7);
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

  it("Direct pairing: верхняя половина группы против нижней по сиду", () => {
    const seeds = seedsFromIds([1, 2, 3, 4, 5, 6, 7, 8]);
    // Все 8 «победили» (условно один тур с разными соперниками) —
    // в одном score-group Direct: 1–5, 2–6, 3–7, 4–8
    const round1: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 3,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 5,
        team_b_id: 6,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 7,
        team_b_id: 8,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
    ];
    // wins=1: 1,3,5,7 — Direct: 1–5, 3–7
    // wins=0: 2,4,6,8 — Direct: 2–6, 4–8
    const round2 = pairNextRoundByScoreGroups(seeds, round1, 2);
    const pairs = round2
      .filter((f) => !f.is_bye)
      .map((f) => [f.team_a_id, f.team_b_id!].sort((a, b) => a - b).join("-"))
      .sort();
    expect(pairs).toEqual(["1-5", "2-6", "3-7", "4-8"]);
  });

  it("нечётная score-группа: floater ↔ лучший нижней; Direct + «Свободен»", () => {
    const seeds = seedsFromIds([1, 2, 3, 4, 5]);
    // Тур 1 (с «Свободен»): 1–4, 2–5, 3–Свободен → wins: 1,2,3=1; 4,5,FREE=0
    const round1: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 2,
        team_b_id: 5,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 3,
        team_b_id: null,
        score_a: 13,
        score_b: 7,
        is_bye: true,
      },
    ];
    // wins=1: 1,2,3 → floater 3 ↔ лучший wins=0 (4)
    // wins=1 Direct: 1–2; wins=0: [5,FREE] → 5–Свободен
    const round2 = pairNextRoundByScoreGroups(seeds, round1, 2);
    const real = round2
      .filter((f) => !f.is_bye)
      .map((f) => [f.team_a_id, f.team_b_id!].sort((a, b) => a - b).join("-"))
      .sort();
    const free = round2.filter((f) => f.is_bye);
    expect(real).toEqual(["1-2", "3-4"]);
    expect(free).toHaveLength(1);
    expect(free[0].team_a_id).toBe(5);
    expect(free[0].score_a).toBe(13);
    expect(free[0].score_b).toBe(7);
  });

  it("floater не вливается в нижнюю группу: 3↔4, Direct 1–2 и 5–6", () => {
    const seeds = seedsFromIds([1, 2, 3, 4, 5, 6]);
    const round1: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 2,
        team_b_id: 5,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 3,
        team_b_id: 6,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
    ];
    // wins=1: 1,2,3 (нечёт) → floater 3 ↔ 4; Direct 1–2
    // wins=0: 5,6 → Direct 5–6
    // (старая логика давала бы 3 внизу и пары вроде 3–5)
    const round2 = pairNextRoundByScoreGroups(seeds, round1, 2);
    const pairs = round2
      .filter((f) => !f.is_bye)
      .map((f) => [f.team_a_id, f.team_b_id!].sort((a, b) => a - b).join("-"))
      .sort();
    expect(pairs).toEqual(["1-2", "3-4", "5-6"]);
  });

  it("если floater уже играл с лучшим нижней — берёт следующего", () => {
    const seeds = seedsFromIds([1, 2, 3, 4, 5, 6]);
    const round1: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 5,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 2,
        team_b_id: 6,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 3,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
    ];
    // wins=1: 1,2,3; wins=0: 4,5,6
    // floater 3 уже играл с 4 → пара 3–5; Direct 1–2 и 4–6
    const round2 = pairNextRoundByScoreGroups(seeds, round1, 2);
    const pairs = round2
      .filter((f) => !f.is_bye)
      .map((f) => [f.team_a_id, f.team_b_id!].sort((a, b) => a - b).join("-"))
      .sort();
    expect(pairs).toEqual(["1-2", "3-5", "4-6"]);
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
    const standings = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.POINT_DIFF,
    ]);
    expect(standings[0].team_id).toBe(1);
    expect(standings[1].team_id).toBe(2);
    expect(standings.map((s) => s.place)).toEqual([1, 2, 3, 4]);
    expect(standings[0].tiebreakers.POINT_DIFF).toBe(8);
  });

  it("считает Бухгольц как сумму побед оппонентов", () => {
    const seeds = seedsFromIds([1, 2, 3, 4]);
    // 1 beat 3, 2 beat 4 → wins: 1=1,2=1,3=0,4=0
    // Buchholz(1)=wins(3)=0, Buchholz(2)=0
    // Round 2: 1 beat 2, 3 beat 4 → wins: 1=2,2=1,3=1,4=0
    // Buchholz(1)=wins(3)+wins(2)=1+1=2
    // Buchholz(2)=wins(4)+wins(1)=0+2=2
    // Buchholz(3)=wins(1)+wins(4)=2+0=2
    const matches: SwissMatchScores[] = [
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
        round_number: 2,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 5,
        is_bye: false,
      },
      {
        round_number: 2,
        team_a_id: 3,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
    ];
    const standings = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.BUCHHOLZ,
    ]);
    const byId = new Map(standings.map((s) => [s.team_id, s]));
    expect(byId.get(1)!.tiebreakers.BUCHHOLZ).toBe(2);
    expect(byId.get(2)!.tiebreakers.BUCHHOLZ).toBe(2);
    expect(byId.get(3)!.tiebreakers.BUCHHOLZ).toBe(2);
    expect(byId.get(4)!.tiebreakers.BUCHHOLZ).toBe(2);
  });

  it("матч со «Свободен»: 1 победа, разница +6, Бухгольц 0", () => {
    const seeds = seedsFromIds([1, 2, 3]);
    // Тур 1: 1–2, 3–Свободен → wins: 1=1, 2=0, 3=1, FREE=0
    const matches: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 5,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 3,
        team_b_id: null,
        score_a: 13,
        score_b: 7,
        is_bye: true,
      },
    ];
    const standings = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.BUCHHOLZ,
      TiebreakerCriterion.POINT_DIFF,
    ]);
    const byId = new Map(standings.map((s) => [s.team_id, s]));
    expect(byId.get(3)!.wins).toBe(1);
    expect(byId.get(3)!.point_diff).toBe(6);
    expect(byId.get(3)!.tiebreakers.BUCHHOLZ).toBe(0);
    expect(byId.has(-1)).toBe(true);
    expect(byId.get(-1)!.wins).toBe(0);
    expect(byId.get(-1)!.point_diff).toBe(-6);
  });

  it("Бергер: сумма побед обыгранных соперников, поражения с множителем 0", () => {
    const seeds = seedsFromIds([1, 2, 3, 4]);
    // R1: 1 beat 3, 2 beat 4 → wins 1=1,2=1,3=0,4=0
    // R2: 1 beat 2, 4 beat 3 → wins 1=2,2=1,3=0,4=1
    // Berger(1) = wins(3)+wins(2) = 0+1 = 1  (обыграл обоих)
    // Berger(2) = wins(4) = 1                 (обыграл 4; проиграл 1 → 0)
    // Berger(3) = 0                           (два поражения)
    // Berger(4) = wins(3) = 0                 (обыграл 3; проиграл 2 → 0)
    const matches: SwissMatchScores[] = [
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
        round_number: 2,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 5,
        is_bye: false,
      },
      {
        round_number: 2,
        team_a_id: 4,
        team_b_id: 3,
        score_a: 13,
        score_b: 2,
        is_bye: false,
      },
    ];
    const standings = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.BERGER,
    ]);
    const byId = new Map(standings.map((s) => [s.team_id, s]));
    expect(byId.get(1)!.tiebreakers.BERGER).toBe(1);
    expect(byId.get(2)!.tiebreakers.BERGER).toBe(1);
    expect(byId.get(3)!.tiebreakers.BERGER).toBe(0);
    expect(byId.get(4)!.tiebreakers.BERGER).toBe(0);
  });

  it("места: победы, затем коэффициенты в заданном порядке, затем сид", () => {
    const seeds = seedsFromIds([1, 2, 3, 4]);
    // R1: 1 beats 3 13-0, 2 beats 4 13-10
    // wins: 1=1, 2=1, 3=0, 4=0
    // point_diff: 1=+13, 2=+3, 3=-13, 4=-3
    // buchholz: 1=0, 2=0, 3=1, 4=1
    const matches: SwissMatchScores[] = [
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
        score_b: 10,
        is_bye: false,
      },
    ];

    const byPointDiff = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.POINT_DIFF,
      TiebreakerCriterion.BUCHHOLZ,
    ]);
    expect(byPointDiff.map((s) => s.team_id)).toEqual([1, 2, 4, 3]);

    const byBuchholzThenDiff = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.BUCHHOLZ,
      TiebreakerCriterion.POINT_DIFF,
    ]);
    // У победителей bh равны → решает POINT_DIFF: 1, 2
    // У проигравших bh равны → POINT_DIFF: 4, 3
    expect(byBuchholzThenDiff.map((s) => s.team_id)).toEqual([1, 2, 4, 3]);

    // Победы всегда важнее любого коэффициента: команда с 0 побед
    // и большим Бухгольцем ниже команды с 1 победой.
    const withExtraWins = computeSwissStandings(
      seeds,
      [
        ...matches,
        {
          round_number: 2,
          team_a_id: 1,
          team_b_id: 2,
          score_a: 13,
          score_b: 5,
          is_bye: false,
        },
        {
          round_number: 2,
          team_a_id: 3,
          team_b_id: 4,
          score_a: 13,
          score_b: 0,
          is_bye: false,
        },
      ],
      [TiebreakerCriterion.BUCHHOLZ, TiebreakerCriterion.POINT_DIFF],
    );
    // wins: 1=2, 3=1, 2=1, 4=0 — команда 1 первая несмотря на прочие коэфф.
    expect(withExtraWins[0].team_id).toBe(1);
    expect(withExtraWins[0].wins).toBe(2);
    expect(withExtraWins.map((s) => s.wins)).toEqual([2, 1, 1, 0]);
  });

  it("при равных победах и коэфф. порядок мест следует порядку показателей", () => {
    // Две команды с 1 победой: у 10 лучше Бухгольц, у 20 лучше разница.
    const seeds: SwissSeedEntry[] = [
      { team_id: 10, seed: 1, rating: 100, random_tie: 50 },
      { team_id: 20, seed: 2, rating: 90, random_tie: 50 },
      { team_id: 30, seed: 3, rating: 80, random_tie: 50 },
      { team_id: 40, seed: 4, rating: 70, random_tie: 50 },
    ];
    // R1: 10–30 13-10, 20–40 13-0
    // wins 10=1,20=1; diff 10=+3,20=+13; bh 10=wins(30)=0, 20=wins(40)=0
    // R2: 30–40 13-0 → wins 30=1,40=0
    // После R2: wins 10=1,20=1,30=1,40=0
    // bh(10)=wins(30)=1, bh(20)=wins(40)=0
    // diff(10)=+3, diff(20)=+13
    const matches: SwissMatchScores[] = [
      {
        round_number: 1,
        team_a_id: 10,
        team_b_id: 30,
        score_a: 13,
        score_b: 10,
        is_bye: false,
      },
      {
        round_number: 1,
        team_a_id: 20,
        team_b_id: 40,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
      {
        round_number: 2,
        team_a_id: 30,
        team_b_id: 40,
        score_a: 13,
        score_b: 0,
        is_bye: false,
      },
    ];

    const buchholzFirst = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.BUCHHOLZ,
      TiebreakerCriterion.POINT_DIFF,
    ]);
    // Среди трёх с 1 победой: 10 (bh=1) выше 20 и 30 (bh=0);
    // между 20 и 30 (bh=0): diff 20=+13 > 30=+3 (после R2: 30 beat 40, diff = -3+13=+10 wait)
    // Recalc diffs after R2:
    // 10: +3 (only R1)
    // 20: +13
    // 30: -3 (R1) +13 (R2) = +10
    // 40: -13 -13 = -26
    // bh: 10=wins(30)=1; 20=wins(40)=0; 30=wins(10)+wins(40)=1+0=1
    // So bh: 10=1, 30=1, 20=0 → then among 10 and 30 by POINT_DIFF: 30=+10 > 10=+3
    expect(
      buchholzFirst.filter((s) => s.wins === 1).map((s) => s.team_id),
    ).toEqual([30, 10, 20]);

    const pointDiffFirst = computeSwissStandings(seeds, matches, [
      TiebreakerCriterion.POINT_DIFF,
      TiebreakerCriterion.BUCHHOLZ,
    ]);
    // Among wins=1: 20 (+13), 30 (+10), 10 (+3)
    expect(
      pointDiffFirst.filter((s) => s.wins === 1).map((s) => s.team_id),
    ).toEqual([20, 30, 10]);
  });
});

describe("buildSwissStageView", () => {
  it("не учитывает партии незавершённого тура в итогах", () => {
    const seeds = seedsFromIds([1, 2, 3, 4]);
    const teams = seeds.map((s) => ({
      team_id: s.team_id,
      players: [`T${s.team_id}`],
    }));
    // Тур 1 полностью сыгран: 1 и 2 победили
    // Тур 2 начат, но одна партия без счёта — итоги должны остаться после тура 1
    const matches: SwissMatchView[] = [
      {
        id: 1,
        round_number: 1,
        team_a_id: 1,
        team_b_id: 3,
        score_a: 13,
        score_b: 0,
        is_bye: false,
        court: 1,
      },
      {
        id: 2,
        round_number: 1,
        team_a_id: 2,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
        is_bye: false,
        court: 2,
      },
      {
        id: 3,
        round_number: 2,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 5,
        is_bye: false,
        court: 1,
      },
      {
        id: 4,
        round_number: 2,
        team_a_id: 3,
        team_b_id: 4,
        score_a: null,
        score_b: null,
        is_bye: false,
        court: 2,
      },
    ];
    const view = buildSwissStageView(seeds, teams, matches, 3, [
      TiebreakerCriterion.POINT_DIFF,
    ]);
    expect(view.completed_rounds).toBe(1);
    const byId = new Map(view.standings.map((s) => [s.team_id, s]));
    expect(byId.get(1)!.wins).toBe(1);
    expect(byId.get(2)!.wins).toBe(1);
    expect(byId.get(3)!.wins).toBe(0);
    expect(byId.get(4)!.wins).toBe(0);
  });
});
