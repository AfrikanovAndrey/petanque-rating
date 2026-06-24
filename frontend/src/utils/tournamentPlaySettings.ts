import { TiebreakerCriterion } from "../types";

export const SWISS_BYE_SCORE = { a: 13, b: 7 };

export const ALL_TIEBREAKER_CRITERIA: TiebreakerCriterion[] = [
  TiebreakerCriterion.BUCHHOLZ,
  TiebreakerCriterion.DOUBLE_BUCHHOLZ,
  TiebreakerCriterion.BERGER,
  TiebreakerCriterion.PROGRESS,
  TiebreakerCriterion.POINT_DIFF,
];

const TIEBREAKER_LABELS: Record<TiebreakerCriterion, string> = {
  [TiebreakerCriterion.BUCHHOLZ]: "Бухгольц",
  [TiebreakerCriterion.DOUBLE_BUCHHOLZ]: "Двойной Бухгольц",
  [TiebreakerCriterion.BERGER]: "Бергер",
  [TiebreakerCriterion.PROGRESS]: "Прогресс",
  [TiebreakerCriterion.POINT_DIFF]: "Разница очков",
};

const ROUND_STATUS_LABELS = {
  PENDING: "Ожидает",
  IN_PROGRESS: "Идёт",
  COMPLETED: "Завершён",
} as const;

export function getTiebreakerLabel(criterion: TiebreakerCriterion): string {
  return TIEBREAKER_LABELS[criterion];
}

export function getSwissRoundStatusLabel(
  status: keyof typeof ROUND_STATUS_LABELS,
): string {
  return ROUND_STATUS_LABELS[status];
}

export function formatStandingPoints(standing: {
  points_for: unknown;
  points_against: unknown;
  point_diff: unknown;
}): string {
  const pointsFor = Number(standing.points_for);
  const pointsAgainst = Number(standing.points_against);
  const diff = Number(standing.point_diff);
  const forDisplay = Number.isFinite(pointsFor) ? pointsFor : 0;
  const againstDisplay = Number.isFinite(pointsAgainst) ? pointsAgainst : 0;
  const diffDisplay = Number.isFinite(diff)
    ? diff > 0
      ? `+${diff}`
      : String(diff)
    : "—";
  return `${forDisplay}:${againstDisplay} (${diffDisplay})`;
}

export function standingsTiebreakerColumns(
  order: TiebreakerCriterion[] | null | undefined,
  fallback: TiebreakerCriterion[] = [
    TiebreakerCriterion.BUCHHOLZ,
    TiebreakerCriterion.POINT_DIFF,
  ],
): TiebreakerCriterion[] {
  return (order ?? fallback).filter(
    (criterion) => criterion !== TiebreakerCriterion.POINT_DIFF,
  );
}
