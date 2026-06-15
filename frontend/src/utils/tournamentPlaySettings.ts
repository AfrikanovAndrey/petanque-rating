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
