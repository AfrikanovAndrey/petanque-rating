import {
  performGroupDraw,
  validatePlaySettings,
} from "../tournamentPlaySettings";
import {
  TiebreakerCriterion,
  TournamentPlayFormat,
} from "../../types";

describe("validatePlaySettings", () => {
  it("принимает групповой формат с размером 4–6", () => {
    expect(
      validatePlaySettings({
        play_format: TournamentPlayFormat.GROUPS,
        group_size: 5,
      }),
    ).toBeNull();
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
});
