import {
  performGroupDraw,
  validateManualGroupDraw,
  validatePlaySettings,
} from "../tournamentPlaySettings";
import {
  TiebreakerCriterion,
  TournamentPlayFormat,
} from "../../types";

describe("validatePlaySettings", () => {
  it("принимает французскую систему только при размере 4", () => {
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.GROUPS,
        group_size: 4,
        french_system: true,
      }),
    ).toBeNull();
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.GROUPS,
        group_size: 5,
        french_system: true,
      }),
    ).not.toBeNull();
  });

  it("отклоняет групповой формат без размера", () => {
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.GROUPS,
        group_size: null,
      }),
    ).not.toBeNull();
  });

  it("принимает швейцарку с турами и полным списком показателей", () => {
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.SWISS,
        swiss_rounds: 5,
        tiebreaker_order: [
          TiebreakerCriterion.BUCHHOLZ,
          TiebreakerCriterion.DOUBLE_BUCHHOLZ,
          TiebreakerCriterion.BERGER,
          TiebreakerCriterion.PROGRESS,
          TiebreakerCriterion.POINT_DIFF,
        ],
      }),
    ).toBeNull();
  });

  it("принимает швейцарку без дополнительных показателей", () => {
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.SWISS,
        swiss_rounds: 5,
        tiebreaker_order: [],
      }),
    ).toBeNull();
  });

  it("принимает швейцарку с частичным списком показателей", () => {
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.SWISS,
        swiss_rounds: 5,
        tiebreaker_order: [
          TiebreakerCriterion.BUCHHOLZ,
          TiebreakerCriterion.POINT_DIFF,
        ],
      }),
    ).toBeNull();
  });
});

describe("performGroupDraw", () => {
  it("распределяет команды по группам не больше заданного размера", () => {
    const teamIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const groups = performGroupDraw(teamIds, 4);

    expect(groups.length).toBeGreaterThan(0);
    const assigned = groups.flatMap((group) => group.team_ids);
    expect(assigned.sort((a, b) => a - b)).toEqual(teamIds);
    for (const group of groups) {
      expect(group.team_ids.length).toBeLessThanOrEqual(4);
      expect(group.team_ids.length).toBeGreaterThan(0);
    }
  });

  it("выравнивает размеры групп (6 команд, max 4 → 3+3)", () => {
    const groups = performGroupDraw([1, 2, 3, 4, 5, 6], 4);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.team_ids.length).sort()).toEqual([3, 3]);
  });
});

describe("validateManualGroupDraw", () => {
  it("принимает полное равномерное распределение без дублей", () => {
    expect(
      validateManualGroupDraw(
        [
          { group_number: 1, team_ids: [1, 2, 3] },
          { group_number: 2, team_ids: [4, 5, 6] },
        ],
        [1, 2, 3, 4, 5, 6],
        4,
      ),
    ).toBeNull();
  });

  it("отклоняет неравномерное 4+2 при max 4 и 6 командах", () => {
    expect(
      validateManualGroupDraw(
        [
          { group_number: 1, team_ids: [1, 2, 3, 4] },
          { group_number: 2, team_ids: [5, 6] },
        ],
        [1, 2, 3, 4, 5, 6],
        4,
      ),
    ).not.toBeNull();
  });

  it("отклоняет незавершённое распределение", () => {
    expect(
      validateManualGroupDraw(
        [{ group_number: 1, team_ids: [1, 2, 3] }],
        [1, 2, 3, 4, 5, 6],
        4,
      ),
    ).not.toBeNull();
  });

  it("отклоняет дубли команд", () => {
    expect(
      validateManualGroupDraw(
        [
          { group_number: 1, team_ids: [1, 2, 3, 4] },
          { group_number: 2, team_ids: [5, 6, 1, 8] },
        ],
        [1, 2, 3, 4, 5, 6, 7, 8],
        4,
      ),
    ).not.toBeNull();
  });
});
