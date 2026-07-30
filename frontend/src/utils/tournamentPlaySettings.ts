import {
  TiebreakerCriterion,
  TournamentPlayFormat,
} from "../types";

export const ALL_TIEBREAKER_CRITERIA: TiebreakerCriterion[] = [
  TiebreakerCriterion.BUCHHOLZ,
  TiebreakerCriterion.DOUBLE_BUCHHOLZ,
  TiebreakerCriterion.BERGER,
  TiebreakerCriterion.PROGRESS,
  TiebreakerCriterion.POINT_DIFF,
];

export const DEFAULT_TIEBREAKER_ORDER: TiebreakerCriterion[] = [
  ...ALL_TIEBREAKER_CRITERIA,
];

export function getTiebreakerLabel(criterion: TiebreakerCriterion): string {
  switch (criterion) {
    case TiebreakerCriterion.BUCHHOLZ:
      return "Коэффициент Бухгольца";
    case TiebreakerCriterion.DOUBLE_BUCHHOLZ:
      return "Коэффициент двойной Бухгольца";
    case TiebreakerCriterion.BERGER:
      return "Коэффициент Бергера";
    case TiebreakerCriterion.PROGRESS:
      return "Коэффициент прогресса";
    case TiebreakerCriterion.POINT_DIFF:
      return "Разница очков в партиях";
    default:
      return criterion;
  }
}

/** Короткие подписи для заголовков таблицы итогов. */
export function getTiebreakerShortLabel(criterion: TiebreakerCriterion): string {
  switch (criterion) {
    case TiebreakerCriterion.BUCHHOLZ:
      return "Бухгольц";
    case TiebreakerCriterion.DOUBLE_BUCHHOLZ:
      return "Дв. Бухгольц";
    case TiebreakerCriterion.BERGER:
      return "Бергер";
    case TiebreakerCriterion.PROGRESS:
      return "Прогресс";
    case TiebreakerCriterion.POINT_DIFF:
      return "Разн. очков";
    default:
      return criterion;
  }
}

/** Технический участник швейцарки при нечётном числе команд. */
export const SWISS_FREE_TEAM_ID = -1;
export const SWISS_FREE_TEAM_NAME = "Свободен";

export function isSwissFreeTeamId(teamId: number): boolean {
  return teamId === SWISS_FREE_TEAM_ID;
}

/**
 * Порядок строк «Итоги швейцарки»:
 * победы DESC → коэффициенты из настроек турнира DESC → сид ASC.
 */
export function compareSwissStandings(
  a: {
    wins: number;
    seed: number;
    tiebreakers?: Partial<Record<TiebreakerCriterion, number>>;
  },
  b: {
    wins: number;
    seed: number;
    tiebreakers?: Partial<Record<TiebreakerCriterion, number>>;
  },
  tiebreakerOrder: TiebreakerCriterion[],
): number {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  for (const criterion of tiebreakerOrder) {
    const av = a.tiebreakers?.[criterion] ?? 0;
    const bv = b.tiebreakers?.[criterion] ?? 0;
    if (bv !== av) {
      return bv - av;
    }
  }
  return a.seed - b.seed;
}

export function getPlayFormatLabel(format: TournamentPlayFormat): string {
  switch (format) {
    case TournamentPlayFormat.GROUPS:
      return "Группы";
    case TournamentPlayFormat.SWISS:
      return "Швейцарская система";
    default:
      return format;
  }
}

export function getGroupLetter(groupNumber: number): string {
  const index = groupNumber - 1;
  if (index < 0) {
    return String(groupNumber);
  }
  const first = String.fromCharCode(65 + (index % 26));
  const suffix = index >= 26 ? String(Math.floor(index / 26)) : "";
  return `${first}${suffix}`;
}
