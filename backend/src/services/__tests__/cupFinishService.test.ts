import {
  areCupMatchesComplete,
  cupSizeForTeam,
  cupWinsLosesModifiers,
  deriveCupPlacements,
  derivePlacementsForCup,
  loserPositionForEliminationRound,
} from "../cupFinishService";
import { CupPosition } from "../../types";
import type { TournamentCupMatchRow } from "../../models/TournamentCupMatchModel";

function match(
  partial: Partial<TournamentCupMatchRow> &
    Pick<
      TournamentCupMatchRow,
      | "cup"
      | "round_number"
      | "match_index"
      | "team_a_id"
      | "team_b_id"
      | "score_a"
      | "score_b"
    >,
): TournamentCupMatchRow {
  return {
    id: partial.id ?? 1,
    tournament_id: 1,
    is_third_place: false,
    court: 1,
    next_match_round: null,
    next_match_index: null,
    next_slot: null,
    loser_next_match_round: null,
    loser_next_match_index: null,
    loser_next_slot: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  };
}

describe("areCupMatchesComplete", () => {
  it("требует счета и обе команды", () => {
    expect(
      areCupMatchesComplete([
        match({
          cup: "A",
          round_number: 1,
          match_index: 0,
          team_a_id: 1,
          team_b_id: 2,
          score_a: 13,
          score_b: 5,
        }),
      ]),
    ).toBe(true);
    expect(
      areCupMatchesComplete([
        match({
          cup: "A",
          round_number: 1,
          match_index: 0,
          team_a_id: 1,
          team_b_id: null,
          score_a: null,
          score_b: null,
        }),
      ]),
    ).toBe(false);
  });

  it("при AB ждёт появления сеток A и B", () => {
    const abOnly = [
      match({
        cup: "AB",
        round_number: 1,
        match_index: 0,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 0,
      }),
    ];
    expect(areCupMatchesComplete(abOnly)).toBe(false);
  });
});

describe("derivePlacementsForCup", () => {
  it("для сетки на 4: победитель, финалист, 3 и 4 места", () => {
    const matches = [
      match({
        cup: "A",
        round_number: 1,
        match_index: 0,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 5,
        loser_next_match_round: 2,
        loser_next_match_index: 0,
        loser_next_slot: "a",
      }),
      match({
        cup: "A",
        round_number: 1,
        match_index: 1,
        team_a_id: 3,
        team_b_id: 4,
        score_a: 13,
        score_b: 7,
        loser_next_match_round: 2,
        loser_next_match_index: 0,
        loser_next_slot: "b",
      }),
      match({
        cup: "A",
        round_number: 2,
        match_index: 0,
        team_a_id: 1,
        team_b_id: 3,
        score_a: 13,
        score_b: 8,
      }),
      match({
        cup: "A",
        round_number: 2,
        match_index: 0,
        team_a_id: 2,
        team_b_id: 4,
        score_a: 13,
        score_b: 10,
        is_third_place: true,
      }),
    ];
    const placements = derivePlacementsForCup(matches);
    expect(placements.get(1)).toBe(CupPosition.WINNER);
    expect(placements.get(3)).toBe(CupPosition.RUNNER_UP);
    expect(placements.get(2)).toBe(CupPosition.THIRD_PLACE);
    expect(placements.get(4)).toBe(CupPosition.ROUND_OF_4);
  });
});

describe("loserPositionForEliminationRound", () => {
  it("для 16: 1/8 → 1/4 → 1/2", () => {
    expect(loserPositionForEliminationRound(16, 1)).toBe(
      CupPosition.ROUND_OF_16,
    );
    expect(loserPositionForEliminationRound(16, 2)).toBe(
      CupPosition.ROUND_OF_8,
    );
    expect(loserPositionForEliminationRound(16, 3)).toBe(
      CupPosition.ROUND_OF_4,
    );
  });
});

describe("deriveCupPlacements", () => {
  it("разносит команды по кубкам", () => {
    const matches = [
      match({
        cup: "A",
        round_number: 1,
        match_index: 0,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 0,
      }),
      match({
        cup: "B",
        round_number: 1,
        match_index: 0,
        team_a_id: 3,
        team_b_id: 4,
        score_a: 13,
        score_b: 1,
      }),
    ];
    const map = deriveCupPlacements(matches);
    expect(map.get(1)).toEqual({ cup: "A", position: CupPosition.WINNER });
    expect(map.get(2)).toEqual({
      cup: "A",
      position: CupPosition.RUNNER_UP,
    });
    expect(map.get(3)?.cup).toBe("B");
  });
});

describe("cupWinsLosesModifiers", () => {
  it("для кубка на 8: победитель +3", () => {
    expect(cupWinsLosesModifiers(8, CupPosition.WINNER)).toEqual({
      winsModifier: 3,
      losesModifier: 0,
    });
  });
});

describe("cupSizeForTeam", () => {
  it("считает размер по первому раунду", () => {
    const matches = [
      match({
        cup: "A",
        round_number: 1,
        match_index: 0,
        team_a_id: 1,
        team_b_id: 2,
        score_a: 13,
        score_b: 0,
      }),
      match({
        cup: "A",
        round_number: 1,
        match_index: 1,
        team_a_id: 3,
        team_b_id: 4,
        score_a: 13,
        score_b: 0,
      }),
    ];
    expect(cupSizeForTeam(matches, "A")).toBe(4);
  });
});
