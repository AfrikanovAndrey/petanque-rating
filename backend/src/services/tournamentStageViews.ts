import { TournamentGroupMatchModel } from "../models/TournamentGroupMatchModel";
import { TournamentCupMatchModel } from "../models/TournamentCupMatchModel";
import { TournamentSwissMatchModel } from "../models/TournamentSwissMatchModel";
import { buildGroupStageViews } from "./groupStageService";
import {
  buildSwissStageView,
  type SwissMatchView,
} from "./swissStageService";
import type { RegisteredTeamRow } from "../models/TournamentRegistrationModel";
import type { TournamentCupMatchRow } from "../models/TournamentCupMatchModel";
import {
  TournamentPlayFormat,
  type Tournament,
} from "../types";
import type { CupBracketCode } from "./cupStageService";

export type CupStageViewPayload = {
  cup: CupBracketCode;
  matches: Array<{
    id: number;
    round_number: number;
    match_index: number;
    team_a_id: number | null;
    team_b_id: number | null;
    team_a_players: string[];
    team_b_players: string[];
    score_a: number | null;
    score_b: number | null;
    court: number | null;
    is_third_place: boolean;
  }>;
};

export function buildCupStageViewsFromRows(
  matches: TournamentCupMatchRow[],
  teams: RegisteredTeamRow[],
): CupStageViewPayload[] {
  const teamById = new Map(teams.map((t) => [t.team_id, t]));
  const byCup = new Map<CupBracketCode, TournamentCupMatchRow[]>();
  for (const m of matches) {
    const cup = m.cup as CupBracketCode;
    if (!byCup.has(cup)) {
      byCup.set(cup, []);
    }
    byCup.get(cup)!.push(m);
  }
  const order: CupBracketCode[] = ["AB", "A", "B", "C", "D"];
  return order
    .filter((cup) => byCup.has(cup))
    .map((cup) => ({
      cup,
      matches: (byCup.get(cup) ?? []).map((m) => ({
        id: m.id,
        round_number: m.round_number,
        match_index: m.match_index,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        team_a_players: m.team_a_id
          ? teamById.get(m.team_a_id)?.players ?? []
          : [],
        team_b_players: m.team_b_id
          ? teamById.get(m.team_b_id)?.players ?? []
          : [],
        score_a: m.score_a,
        score_b: m.score_b,
        court: m.court,
        is_third_place: m.is_third_place,
      })),
    }));
}

function swissRowsToViews(
  rows: Awaited<ReturnType<typeof TournamentSwissMatchModel.listByTournament>>,
): SwissMatchView[] {
  return rows.map((m) => ({
    id: m.id,
    round_number: m.round_number,
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    score_a: m.score_a,
    score_b: m.score_b,
    is_bye: m.is_bye,
    court: m.court,
  }));
}

/**
 * Снимок групп / швейцарки / кубков, если в БД есть матчи этапа.
 * Для ручной загрузки результатов матчей обычно нет — вернёт пустые значения.
 */
export async function loadPlayStageSnapshot(
  tournament: Tournament,
  teams: RegisteredTeamRow[],
): Promise<{
  groups: ReturnType<typeof buildGroupStageViews>;
  swiss: ReturnType<typeof buildSwissStageView> | null;
  cups: CupStageViewPayload[];
}> {
  const tournamentId = tournament.id;
  let groups: ReturnType<typeof buildGroupStageViews> = [];
  let swiss: ReturnType<typeof buildSwissStageView> | null = null;
  let cups: CupStageViewPayload[] = [];

  if (
    tournament.play_format === TournamentPlayFormat.GROUPS &&
    tournament.group_draw &&
    tournament.group_draw.length > 0
  ) {
    const matches =
      await TournamentGroupMatchModel.listByTournament(tournamentId);
    if (matches.length > 0) {
      groups = buildGroupStageViews(tournament.group_draw, teams, matches);
    }
  }

  if (
    tournament.play_format === TournamentPlayFormat.SWISS &&
    tournament.swiss_seed?.length &&
    tournament.swiss_rounds
  ) {
    const swissMatches =
      await TournamentSwissMatchModel.listByTournament(tournamentId);
    if (swissMatches.length > 0) {
      swiss = buildSwissStageView(
        tournament.swiss_seed,
        teams,
        swissRowsToViews(swissMatches),
        tournament.swiss_rounds,
        tournament.tiebreaker_order,
      );
    }
  }

  const cupMatches =
    await TournamentCupMatchModel.listByTournament(tournamentId);
  if (cupMatches.length > 0) {
    cups = buildCupStageViewsFromRows(cupMatches, teams);
  }

  return { groups, swiss, cups };
}
