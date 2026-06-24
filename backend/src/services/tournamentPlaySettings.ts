import {
  TiebreakerCriterion,
  TournamentPlayFormat,
  type TournamentPlaySettingsInput,
} from "../types";

export const ALL_TIEBREAKER_CRITERIA: TiebreakerCriterion[] = [
  TiebreakerCriterion.BUCHHOLZ,
  TiebreakerCriterion.DOUBLE_BUCHHOLZ,
  TiebreakerCriterion.BERGER,
  TiebreakerCriterion.PROGRESS,
  TiebreakerCriterion.POINT_DIFF,
];

export function getDefaultTiebreakerOrder(): TiebreakerCriterion[] {
  return [
    TiebreakerCriterion.BUCHHOLZ,
    TiebreakerCriterion.POINT_DIFF,
  ];
}

export function parseTiebreakerOrder(value: unknown): TiebreakerCriterion[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is TiebreakerCriterion =>
      ALL_TIEBREAKER_CRITERIA.includes(item as TiebreakerCriterion),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return parseTiebreakerOrder(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

export function validatePlaySettings(
  input: TournamentPlaySettingsInput,
): string | null {
  if (input.play_format === TournamentPlayFormat.SWISS) {
    const rounds = input.swiss_rounds;
    if (rounds == null || !Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
      return "Укажите количество туров швейцарки от 1 до 20";
    }
  }

  const order = input.tiebreaker_order ?? [];
  const unique = new Set(order);
  if (unique.size !== order.length) {
    return "Дополнительные показатели не должны повторяться";
  }

  for (const criterion of order) {
    if (!ALL_TIEBREAKER_CRITERIA.includes(criterion)) {
      return "Недопустимый дополнительный показатель";
    }
  }

  return null;
}

export type { TournamentPlaySettingsInput };
