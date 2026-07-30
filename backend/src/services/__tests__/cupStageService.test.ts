import {
  allocateCups,
  buildAbResultQualified,
  buildAllCupFixtures,
  generateBracketFixtures,
  pairSeededBracket,
  rankTeamsFromGroups,
  rankTeamsFromSwiss,
  resolveCupThirdPlace,
  standardBracketSeedOrder,
  type CupStageConfig,
  type QualifiedTeam,
} from "../cupStageService";

function team(
  id: number,
  group: number,
  place: number,
  wins = 2,
  diff = 10,
  pf = 26,
): QualifiedTeam {
  return {
    team_id: id,
    group_number: group,
    place,
    wins,
    point_diff: diff,
    points_for: pf,
  };
}

describe("rankTeamsFromGroups", () => {
  it("берёт 5 первых и 3 лучших вторых для квоты 8", () => {
    const teams: QualifiedTeam[] = [
      team(11, 1, 1, 3, 20),
      team(12, 1, 2, 2, 5),
      team(13, 1, 3, 1, 0),
      team(21, 2, 1, 3, 18),
      team(22, 2, 2, 2, 12),
      team(31, 3, 1, 2, 8),
      team(32, 3, 2, 2, 15),
      team(41, 4, 1, 3, 22),
      team(42, 4, 2, 1, 2),
      team(51, 5, 1, 3, 16),
      team(52, 5, 2, 2, 14),
    ];
    const ranked = rankTeamsFromGroups(teams);
    const top8 = ranked.slice(0, 8);
    expect(top8.filter((t) => t.place === 1)).toHaveLength(5);
    expect(top8.filter((t) => t.place === 2)).toHaveLength(3);
    // лучшие вторые: 32 (diff15), 52 (14), 22 (12)
    expect(top8.filter((t) => t.place === 2).map((t) => t.team_id)).toEqual([
      32, 52, 22,
    ]);
  });
});

describe("rankTeamsFromSwiss", () => {
  it("упорядочивает по месту итогов швейцарки", () => {
    const ranked = rankTeamsFromSwiss([
      { team_id: 3, place: 2, wins: 2, point_diff: 5, points_for: 20 },
      { team_id: 1, place: 1, wins: 3, point_diff: 10, points_for: 30 },
      { team_id: 2, place: 3, wins: 1, point_diff: -2, points_for: 15 },
    ]);
    expect(ranked.map((t) => t.team_id)).toEqual([1, 3, 2]);
    expect(ranked[0].group_number).toBe(0);
  });
});

describe("pairSeededBracket", () => {
  it("для 8: ветки 1–8, 4–5 и 2–7, 3–6", () => {
    expect(standardBracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const teams = Array.from({ length: 8 }, (_, i) =>
      team(i + 1, 1, i + 1),
    );
    const pairs = pairSeededBracket(teams);
    expect(pairs.map(([a, b]) => [a.team_id, b.team_id])).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });

  it("для 4: 1–4 и 2–3", () => {
    expect(standardBracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    const teams = Array.from({ length: 4 }, (_, i) =>
      team(i + 1, 1, i + 1),
    );
    const pairs = pairSeededBracket(teams);
    expect(pairs.map(([a, b]) => [a.team_id, b.team_id])).toEqual([
      [1, 4],
      [2, 3],
    ]);
  });

  it("для 16: 1/8 сводит так, что 1/4 = 1–8, 4–5 | 2–7, 3–6", () => {
    expect(standardBracketSeedOrder(16)).toEqual([
      1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11,
    ]);
    const teams = Array.from({ length: 16 }, (_, i) =>
      team(i + 1, 1, i + 1),
    );
    const pairs = pairSeededBracket(teams);
    expect(pairs.map(([a, b]) => [a.team_id, b.team_id])).toEqual([
      [1, 16],
      [8, 9],
      [4, 13],
      [5, 12],
      [2, 15],
      [7, 10],
      [3, 14],
      [6, 11],
    ]);

    const fixtures = generateBracketFixtures("A", teams, 1, {
      thirdPlace: false,
    });
    const r1 = fixtures
      .filter((f) => f.round_number === 1)
      .sort((a, b) => a.match_index - b.match_index);
    // Соседние матчи 1/8 кормят один четвертьфинал → при победах сидов
    // в 1/4: 1–8, 4–5, 2–7, 3–6
    const qfFeed = r1.map((f) => ({
      pair: [f.team_a_id, f.team_b_id],
      qf: f.next_match_index,
      slot: f.next_slot,
    }));
    expect(qfFeed).toEqual([
      { pair: [1, 16], qf: 0, slot: "a" },
      { pair: [8, 9], qf: 0, slot: "b" },
      { pair: [4, 13], qf: 1, slot: "a" },
      { pair: [5, 12], qf: 1, slot: "b" },
      { pair: [2, 15], qf: 2, slot: "a" },
      { pair: [7, 10], qf: 2, slot: "b" },
      { pair: [3, 14], qf: 3, slot: "a" },
      { pair: [6, 11], qf: 3, slot: "b" },
    ]);
    const qf = fixtures
      .filter((f) => f.round_number === 2)
      .sort((a, b) => a.match_index - b.match_index);
    expect(qf.map((f) => f.next_match_index)).toEqual([0, 0, 1, 1]);
  });
});

describe("allocateCups + AB", () => {
  it("при AB забирает 16 в стык, остаток в C/D", () => {
    const ranked = Array.from({ length: 24 }, (_, i) =>
      team(i + 1, (i % 6) + 1, i < 6 ? 1 : i < 12 ? 2 : 3),
    );
    const config: CupStageConfig = {
      a: 8,
      b: 8,
      c: 4,
      d: 0,
      ab_playoff: true,
    };
    const alloc = allocateCups(rankTeamsFromGroups(ranked), config);
    expect(alloc.ab).toHaveLength(16);
    expect(alloc.A).toHaveLength(0);
    expect(alloc.C).toHaveLength(4);
  });
});

describe("generateBracketFixtures", () => {
  it("для 8 команд: 7 матчей сетки + матч за 3 место", () => {
    const teams = [
      team(1, 1, 1),
      team(2, 2, 1),
      team(3, 3, 1),
      team(4, 4, 1),
      team(5, 1, 2),
      team(6, 2, 2),
      team(7, 3, 2),
      team(8, 4, 2),
    ];
    const fixtures = generateBracketFixtures("A", teams, 1);
    expect(fixtures.filter((f) => !f.is_third_place)).toHaveLength(7);
    expect(fixtures.filter((f) => f.is_third_place)).toHaveLength(1);
    const r1 = fixtures
      .filter((f) => f.round_number === 1)
      .sort((a, b) => a.match_index - b.match_index);
    expect(r1).toHaveLength(4);
    expect(r1.map((f) => [f.team_a_id, f.team_b_id])).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
    // Ветки: (1–8, 4–5) → полуфинал 0; (2–7, 3–6) → полуфинал 1
    expect(r1[0].next_match_index).toBe(0);
    expect(r1[1].next_match_index).toBe(0);
    expect(r1[2].next_match_index).toBe(1);
    expect(r1[3].next_match_index).toBe(1);
    const semis = fixtures.filter(
      (f) => !f.is_third_place && f.round_number === 2,
    );
    expect(semis).toHaveLength(2);
    expect(semis.every((f) => f.loser_next_match_round === 3)).toBe(true);
  });

  it("для 4 команд: проигравшие полуфинала (R1) идут в матч за 3 место", () => {
    const teams = [
      team(1, 1, 1),
      team(2, 2, 1),
      team(3, 1, 2),
      team(4, 2, 2),
    ];
    const fixtures = generateBracketFixtures("B", teams, 1);
    const r1 = fixtures.filter((f) => !f.is_third_place && f.round_number === 1);
    expect(r1).toHaveLength(2);
    expect(r1[0].loser_next_match_round).toBe(2);
    expect(r1[0].loser_next_slot).toBe("a");
    expect(r1[1].loser_next_match_round).toBe(2);
    expect(r1[1].loser_next_slot).toBe("b");
    expect(fixtures.filter((f) => f.is_third_place)).toHaveLength(1);
  });

  it("без thirdPlace не создаёт матч за 3 место и не ведёт проигравших SF", () => {
    const teams = [
      team(1, 1, 1),
      team(2, 2, 1),
      team(3, 3, 1),
      team(4, 4, 1),
      team(5, 1, 2),
      team(6, 2, 2),
      team(7, 3, 2),
      team(8, 4, 2),
    ];
    const fixtures = generateBracketFixtures("A", teams, 1, {
      thirdPlace: false,
    });
    expect(fixtures.filter((f) => !f.is_third_place)).toHaveLength(7);
    expect(fixtures.filter((f) => f.is_third_place)).toHaveLength(0);
    const semis = fixtures.filter(
      (f) => !f.is_third_place && f.round_number === 2,
    );
    expect(semis.every((f) => f.loser_next_match_round == null)).toBe(true);
  });
});

describe("resolveCupThirdPlace", () => {
  it("для объекта: A всегда true, B/C/D по флагам", () => {
    const config: CupStageConfig = {
      a: 8,
      b: 4,
      c: 4,
      d: 0,
      ab_playoff: false,
      third_place: { A: false, B: false, C: true, D: false },
    };
    expect(resolveCupThirdPlace(config, "A")).toBe(true);
    expect(resolveCupThirdPlace(config, "B")).toBe(false);
    expect(resolveCupThirdPlace(config, "C")).toBe(true);
    expect(resolveCupThirdPlace(config, "D")).toBe(false);
  });

  it("legacy boolean применяется ко всем кубкам", () => {
    const off: CupStageConfig = {
      a: 8,
      b: 4,
      c: 0,
      d: 0,
      ab_playoff: false,
      third_place: false,
    };
    expect(resolveCupThirdPlace(off, "A")).toBe(false);
    expect(resolveCupThirdPlace(off, "B")).toBe(false);
  });
});

describe("buildAllCupFixtures per-cup third place", () => {
  it("создаёт матч за 3-е в A и C, но не в B", () => {
    const ranked = Array.from({ length: 16 }, (_, i) =>
      team(i + 1, (i % 4) + 1, Math.floor(i / 4) + 1),
    );
    const config: CupStageConfig = {
      a: 8,
      b: 4,
      c: 4,
      d: 0,
      ab_playoff: false,
      third_place: { A: true, B: false, C: true, D: false },
    };
    const alloc = allocateCups(rankTeamsFromGroups(ranked), config);
    const fixtures = buildAllCupFixtures(alloc, config);
    const thirdByCup = (cup: string) =>
      fixtures.filter((f) => f.cup === cup && f.is_third_place).length;
    expect(thirdByCup("A")).toBe(1);
    expect(thirdByCup("B")).toBe(0);
    expect(thirdByCup("C")).toBe(1);
  });
});

describe("buildAbResultQualified", () => {
  it("делит победителей и проигравших по порядку матчей", () => {
    const original = [
      team(1, 1, 1),
      team(2, 2, 2),
      team(3, 3, 1),
      team(4, 4, 2),
    ];
    // только 2 матча для упрощения логики функции — она не проверяет 8
    const { winners, losers } = buildAbResultQualified(
      [
        {
          match_index: 0,
          team_a_id: 1,
          team_b_id: 2,
          score_a: 13,
          score_b: 5,
        },
        {
          match_index: 1,
          team_a_id: 3,
          team_b_id: 4,
          score_a: 7,
          score_b: 13,
        },
      ],
      original,
    );
    expect(winners.map((t) => t.team_id)).toEqual([1, 4]);
    expect(losers.map((t) => t.team_id)).toEqual([2, 3]);
  });
});
