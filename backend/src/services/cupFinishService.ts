import { Cup, CupPosition } from "../types";
import type { TournamentCupMatchRow } from "../models/TournamentCupMatchModel";

export type CupPlacement = {
  cup: Cup;
  position: CupPosition;
};

const PLAYOFF_CUPS: Cup[] = ["A", "B", "C", "D"];

/** Все матчи кубков заполнены счетами (включая слоты с обеими командами). */
export function areCupMatchesComplete(
  matches: TournamentCupMatchRow[],
): boolean {
  if (matches.length === 0) {
    return false;
  }
  for (const m of matches) {
    if (m.team_a_id == null || m.team_b_id == null) {
      return false;
    }
    if (m.score_a == null || m.score_b == null) {
      return false;
    }
  }
  const hasAb = matches.some((m) => m.cup === "AB");
  if (hasAb) {
    const hasA = matches.some((m) => m.cup === "A");
    const hasB = matches.some((m) => m.cup === "B");
    if (!hasA || !hasB) {
      return false;
    }
  }
  return true;
}

function cupSizeFromMatches(cupMatches: TournamentCupMatchRow[]): number {
  const round1 = cupMatches.filter(
    (m) => !m.is_third_place && m.round_number === 1,
  );
  return round1.length * 2;
}

/** Позиция проигравшего в раунде (до финала / матча за 3-е). */
export function loserPositionForEliminationRound(
  cupSize: number,
  roundNumber: number,
): CupPosition {
  const eliminatedAt = cupSize / 2 ** (roundNumber - 1);
  if (eliminatedAt >= 16) {
    return CupPosition.ROUND_OF_16;
  }
  if (eliminatedAt >= 8) {
    return CupPosition.ROUND_OF_8;
  }
  return CupPosition.ROUND_OF_4;
}

/**
 * Места команд по сыгранной сетке одного кубка (A/B/C/D).
 * Матчи AB не обрабатываются — составы A/B появляются после стыка.
 */
export function derivePlacementsForCup(
  cupMatches: TournamentCupMatchRow[],
): Map<number, CupPosition> {
  const placements = new Map<number, CupPosition>();
  if (cupMatches.length === 0) {
    return placements;
  }

  const size = cupSizeFromMatches(cupMatches);
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`Некорректный размер сетки кубка: ${size}`);
  }
  const totalRounds = Math.log2(size);
  const hasThird = cupMatches.some((m) => m.is_third_place);

  for (const m of cupMatches) {
    if (
      m.team_a_id == null ||
      m.team_b_id == null ||
      m.score_a == null ||
      m.score_b == null
    ) {
      continue;
    }
    const winnerId = m.score_a > m.score_b ? m.team_a_id : m.team_b_id;
    const loserId = m.score_a > m.score_b ? m.team_b_id : m.team_a_id;

    if (m.is_third_place) {
      placements.set(winnerId, CupPosition.THIRD_PLACE);
      placements.set(loserId, CupPosition.ROUND_OF_4);
      continue;
    }

    if (m.round_number === totalRounds) {
      placements.set(winnerId, CupPosition.WINNER);
      placements.set(loserId, CupPosition.RUNNER_UP);
      continue;
    }

    // Полуфинал при наличии матча за 3-е: места 3/4 выставит матч за 3-е
    if (hasThird && m.round_number === totalRounds - 1) {
      continue;
    }

    placements.set(
      loserId,
      loserPositionForEliminationRound(size, m.round_number),
    );
  }

  return placements;
}

/** Места по всем кубкам A–D. */
export function deriveCupPlacements(
  matches: TournamentCupMatchRow[],
): Map<number, CupPlacement> {
  const result = new Map<number, CupPlacement>();
  for (const cup of PLAYOFF_CUPS) {
    const cupMatches = matches.filter((m) => m.cup === cup);
    if (cupMatches.length === 0) {
      continue;
    }
    const placements = derivePlacementsForCup(cupMatches);
    for (const [teamId, position] of placements) {
      result.set(teamId, { cup, position });
    }
  }
  return result;
}

/**
 * Бонусы побед/поражений за место в кубке — как при разборе Excel
 * (`TournamentController.modifyTeamResultsWithCupResults`).
 */
export function cupWinsLosesModifiers(
  cupSize: number,
  position: CupPosition,
): { winsModifier: number; losesModifier: number } {
  const sizeCase = cupSize / 4;
  let winsModifier = 0;
  let losesModifier = 0;

  if (sizeCase === 1) {
    switch (position) {
      case CupPosition.WINNER:
        winsModifier = 2;
        losesModifier = 0;
        break;
      case CupPosition.RUNNER_UP:
        winsModifier = 1;
        losesModifier = 1;
        break;
      case CupPosition.THIRD_PLACE:
        winsModifier = 1;
        losesModifier = 1;
        break;
      case CupPosition.ROUND_OF_4:
        winsModifier = 0;
        losesModifier = 2;
        break;
      default:
        break;
    }
  } else if (sizeCase === 2) {
    switch (position) {
      case CupPosition.WINNER:
        winsModifier = 3;
        losesModifier = 0;
        break;
      case CupPosition.RUNNER_UP:
        winsModifier = 2;
        losesModifier = 1;
        break;
      case CupPosition.THIRD_PLACE:
        winsModifier = 2;
        losesModifier = 1;
        break;
      case CupPosition.ROUND_OF_4:
        winsModifier = 1;
        losesModifier = 1;
        break;
      case CupPosition.ROUND_OF_8:
        winsModifier = 0;
        losesModifier = 1;
        break;
      default:
        break;
    }
  } else if (sizeCase === 4) {
    switch (position) {
      case CupPosition.WINNER:
        winsModifier = 4;
        losesModifier = 0;
        break;
      case CupPosition.RUNNER_UP:
        winsModifier = 3;
        losesModifier = 1;
        break;
      case CupPosition.THIRD_PLACE:
        winsModifier = 3;
        losesModifier = 1;
        break;
      case CupPosition.ROUND_OF_4:
        winsModifier = 2;
        losesModifier = 1;
        break;
      case CupPosition.ROUND_OF_8:
        winsModifier = 1;
        losesModifier = 1;
        break;
      case CupPosition.ROUND_OF_16:
        winsModifier = 0;
        losesModifier = 1;
        break;
      default:
        break;
    }
  }

  return { winsModifier, losesModifier };
}

export function cupSizeForTeam(
  matches: TournamentCupMatchRow[],
  cup: Cup,
): number {
  return cupSizeFromMatches(matches.filter((m) => m.cup === cup));
}
