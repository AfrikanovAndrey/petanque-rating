import {
  generateAllGroupFixtures,
  generateFrenchSystemFixtures,
  generateRoundRobinFixtures,
  computeFrenchGroupStandings,
  computeGroupStandings,
  getCrossTableCell,
} from "../groupStageService";

describe("generateRoundRobinFixtures", () => {
  it("для 4 команд: 3 тура, 6 матчей", () => {
    const fixtures = generateRoundRobinFixtures(1, [10, 20, 30, 40]);
    expect(fixtures).toHaveLength(6);
    expect(new Set(fixtures.map((f) => f.round_number)).size).toBe(3);
    const pairs = fixtures.map(
      (f) => [f.team_a_id, f.team_b_id].sort().join("-"),
    );
    expect(new Set(pairs).size).toBe(6);
  });

  it("для 5 команд: bye, 10 матчей, 5 туров", () => {
    const fixtures = generateRoundRobinFixtures(1, [1, 2, 3, 4, 5]);
    expect(fixtures).toHaveLength(10);
    expect(new Set(fixtures.map((f) => f.round_number)).size).toBe(5);
  });
});

describe("generateAllGroupFixtures", () => {
  it("нумерует дорожки сквозь группы", () => {
    const fixtures = generateAllGroupFixtures([
      { group_number: 1, team_ids: [1, 2, 3, 4] },
      { group_number: 2, team_ids: [5, 6, 7, 8] },
    ]);
    expect(fixtures[0].court).toBe(1);
    expect(Math.max(...fixtures.map((f) => f.court))).toBe(fixtures.length);
  });

  it("французская система: 5 матчей на группу из 4", () => {
    const fixtures = generateAllGroupFixtures(
      [
        { group_number: 1, team_ids: [1, 2, 3, 4] },
        { group_number: 2, team_ids: [5, 6, 7] },
      ],
      { frenchSystem: true },
    );
    const g1 = fixtures.filter((f) => f.group_number === 1);
    const g2 = fixtures.filter((f) => f.group_number === 2);
    expect(g1).toHaveLength(5);
    expect(g1.filter((f) => f.round_number === 1)).toHaveLength(2);
    expect(g1.filter((f) => f.round_number === 2)).toHaveLength(2);
    expect(g1.filter((f) => f.round_number === 3)).toHaveLength(1);
    expect(g1.filter((f) => f.round_number === 2)[0].team_a_id).toBeNull();
    expect(g2).toHaveLength(3);
  });
});

describe("generateFrenchSystemFixtures", () => {
  it("пары 1-го раунда по порядку жеребьёвки", () => {
    const fixtures = generateFrenchSystemFixtures(1, [10, 20, 30, 40]);
    const semis = fixtures.filter((f) => f.round_number === 1);
    expect(semis[0]).toMatchObject({
      team_a_id: 10,
      team_b_id: 20,
      next_slot: "a",
      loser_next_slot: "a",
      loser_next_match_index: 1,
    });
    expect(semis[1]).toMatchObject({
      team_a_id: 30,
      team_b_id: 40,
      next_slot: "b",
      loser_next_slot: "b",
      loser_next_match_index: 1,
    });
  });
});

describe("computeGroupStandings", () => {
  it("считает победы, разницу и места", () => {
    const standings = computeGroupStandings(
      [1, 2, 3],
      [
        { team_a_id: 1, team_b_id: 2, score_a: 13, score_b: 5 },
        { team_a_id: 1, team_b_id: 3, score_a: 13, score_b: 8 },
        { team_a_id: 2, team_b_id: 3, score_a: 13, score_b: 10 },
      ],
    );
    expect(standings[0]).toMatchObject({
      team_id: 1,
      wins: 2,
      place: 1,
    });
    expect(standings[1].team_id).toBe(2);
    expect(standings[2].team_id).toBe(3);
  });

  it("при равенстве побед у двоих ставит выше победителя личной встречи", () => {
    // У 1 и 2 по 1 победе, 3 без побед; 1 обыграл 2 → 1 выше при худшей общей разнице
    const standings = computeGroupStandings(
      [1, 2, 3],
      [
        { team_a_id: 1, team_b_id: 2, score_a: 13, score_b: 11 },
        { team_a_id: 2, team_b_id: 3, score_a: 13, score_b: 0 },
      ],
    );
    // wins: 1=1, 2=1, 3=0; H2H: 1>2
    expect(standings.map((s) => s.team_id)).toEqual([1, 2, 3]);
  });

  it("при равенстве побед у троих не подменяет мини-таблицу одной личной встречей", () => {
    // У всех по 1 победе; 1 обыграл 2, но по разнице шаров 2 лучше
    const standings = computeGroupStandings(
      [1, 2, 3],
      [
        { team_a_id: 1, team_b_id: 2, score_a: 13, score_b: 11 },
        { team_a_id: 1, team_b_id: 3, score_a: 5, score_b: 13 },
        { team_a_id: 2, team_b_id: 3, score_a: 13, score_b: 0 },
      ],
    );
    // diffs: 2=+11, 3=-5, 1=-6
    expect(standings.map((s) => s.team_id)).toEqual([2, 3, 1]);
  });

  it("для 3+ с равными победами использует мини-таблицу", () => {
    // Все по 1 победе в полной группе из 4? Проще: 3 команды, круг.
    // 1>2, 2>3, 3>1 — у всех 1 победа; места по разнице в мини (= общей)
    const standings = computeGroupStandings(
      [1, 2, 3],
      [
        { team_a_id: 1, team_b_id: 2, score_a: 13, score_b: 5 },
        { team_a_id: 2, team_b_id: 3, score_a: 13, score_b: 10 },
        { team_a_id: 3, team_b_id: 1, score_a: 13, score_b: 8 },
      ],
    );
    // diffs: 1: +8-5=+3, 2: -8+3=-5, 3: -3+5=+2 → 1, 3, 2
    expect(standings.map((s) => s.team_id)).toEqual([1, 3, 2]);
  });

  it("при равенстве побед у троих учитывает победы только между ними", () => {
    // Команда 4 вне спора (0 побед). У 1,2,3 по 2 победы каждая (обыграли 4 и по кругу).
    // Мини-таблица 1-2-3 решает места между ними.
    const standings = computeGroupStandings(
      [1, 2, 3, 4],
      [
        { team_a_id: 1, team_b_id: 4, score_a: 13, score_b: 0 },
        { team_a_id: 2, team_b_id: 4, score_a: 13, score_b: 0 },
        { team_a_id: 3, team_b_id: 4, score_a: 13, score_b: 0 },
        { team_a_id: 1, team_b_id: 2, score_a: 13, score_b: 5 },
        { team_a_id: 2, team_b_id: 3, score_a: 13, score_b: 10 },
        { team_a_id: 3, team_b_id: 1, score_a: 13, score_b: 8 },
      ],
    );
    // Overall wins: 1,2,3 → 2; 4 → 0
    // Mini among 1,2,3: same as circle above → 1, 3, 2 then 4
    expect(standings.map((s) => s.team_id)).toEqual([1, 3, 2, 4]);
    expect(standings[0].wins).toBe(2);
    expect(standings[3].team_id).toBe(4);
  });

  it("при полном равенстве побед и личных использует разницу и забитые", () => {
    // 1 и 2 не играли друг с другом; у обоих 1 победа
    const standings = computeGroupStandings(
      [1, 2, 3],
      [
        { team_a_id: 1, team_b_id: 3, score_a: 13, score_b: 10 },
        { team_a_id: 2, team_b_id: 3, score_a: 13, score_b: 5 },
      ],
    );
    // wins equal; no H2H; diff: 1=+3, 2=+8 → 2 выше; points_for also favors 2
    expect(standings.map((s) => s.team_id)).toEqual([2, 1, 3]);
  });

  it("при равной разнице выше команда с большим числом выигранных шаров", () => {
    const standings = computeGroupStandings(
      [1, 2, 3],
      [
        { team_a_id: 1, team_b_id: 3, score_a: 13, score_b: 8 },
        { team_a_id: 2, team_b_id: 3, score_a: 10, score_b: 5 },
      ],
    );
    // wins: 1 и 2 по 1; no H2H; diff оба +5; points_for: 1=13, 2=10 → 1 выше
    expect(standings.map((s) => s.team_id)).toEqual([1, 2, 3]);
  });
});

describe("getCrossTableCell", () => {
  it("возвращает счёт с точки зрения строки", () => {
    const matches = [
      { team_a_id: 1, team_b_id: 2, score_a: 8, score_b: 13 },
    ];
    expect(getCrossTableCell(1, 2, matches)).toEqual({
      score_for: 8,
      score_against: 13,
      diff: -5,
    });
    expect(getCrossTableCell(2, 1, matches)).toEqual({
      score_for: 13,
      score_against: 8,
      diff: 5,
    });
  });
});

describe("computeFrenchGroupStandings", () => {
  it("ставит места по верхнему, нижнему и решающему матчам", () => {
    const standings = computeFrenchGroupStandings(
      [1, 2, 3, 4],
      [
        {
          round_number: 1,
          team_a_id: 1,
          team_b_id: 2,
          score_a: 13,
          score_b: 0,
        },
        {
          round_number: 1,
          team_a_id: 3,
          team_b_id: 4,
          score_a: 5,
          score_b: 13,
        },
        {
          round_number: 2,
          match_index: 0,
          team_a_id: 1,
          team_b_id: 4,
          score_a: 13,
          score_b: 12,
        },
        {
          round_number: 2,
          match_index: 1,
          team_a_id: 2,
          team_b_id: 3,
          score_a: 13,
          score_b: 7,
        },
        {
          round_number: 3,
          match_index: 0,
          team_a_id: 4,
          team_b_id: 2,
          score_a: 13,
          score_b: 11,
        },
      ],
    );
    expect(standings.map((s) => s.team_id)).toEqual([1, 4, 2, 3]);
    expect(standings.map((s) => s.place)).toEqual([1, 2, 3, 4]);
  });

  it("не ставит места, пока не завершён 3-й тур", () => {
    const standings = computeFrenchGroupStandings(
      [1, 2, 3, 4],
      [
        {
          round_number: 1,
          team_a_id: 1,
          team_b_id: 2,
          score_a: 13,
          score_b: 5,
        },
        {
          round_number: 1,
          team_a_id: 3,
          team_b_id: 4,
          score_a: 13,
          score_b: 8,
        },
        {
          round_number: 2,
          match_index: 0,
          team_a_id: null,
          team_b_id: null,
          score_a: null,
          score_b: null,
        },
        {
          round_number: 2,
          match_index: 1,
          team_a_id: null,
          team_b_id: null,
          score_a: null,
          score_b: null,
        },
        {
          round_number: 3,
          match_index: 0,
          team_a_id: null,
          team_b_id: null,
          score_a: null,
          score_b: null,
        },
      ],
    );
    expect(standings.every((s) => s.place === 0)).toBe(true);
  });
});
