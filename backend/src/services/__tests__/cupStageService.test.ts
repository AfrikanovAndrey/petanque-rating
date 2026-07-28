import {
  allocateCups,
  buildAbResultQualified,
  generateBracketFixtures,
  pairFirstRound,
  rankTeamsFromGroups,
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

describe("pairFirstRound", () => {
  it("максимально сводит первые со вторыми и избегает одной группы", () => {
    const teams = [
      team(11, 1, 1),
      team(21, 2, 1),
      team(31, 3, 1),
      team(41, 4, 1),
      team(51, 5, 1),
      team(12, 1, 2),
      team(22, 2, 2),
      team(32, 3, 2),
    ];
    const pairs = pairFirstRound(teams);
    expect(pairs).toHaveLength(4);
    const p1vsp2 = pairs.filter(
      ([a, b]) =>
        (a.place === 1 && b.place === 2) || (a.place === 2 && b.place === 1),
    );
    expect(p1vsp2.length).toBeGreaterThanOrEqual(3);
    for (const [a, b] of pairs) {
      expect(a.group_number).not.toBe(b.group_number);
    }
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
    expect(fixtures.filter((f) => f.round_number === 1)).toHaveLength(4);
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
