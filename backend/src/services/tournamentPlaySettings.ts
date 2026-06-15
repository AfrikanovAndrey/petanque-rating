import {
  TiebreakerCriterion,
  TournamentGroupDrawGroup,
  TournamentPlayFormat,
} from "../types";

export const DEFAULT_TIEBREAKER_ORDER: TiebreakerCriterion[] = [
  TiebreakerCriterion.BUCHHOLZ,
  TiebreakerCriterion.DOUBLE_BUCHHOLZ,
  TiebreakerCriterion.BERGER,
  TiebreakerCriterion.PROGRESS,
  TiebreakerCriterion.POINT_DIFF,
];

export const ALL_TIEBREAKER_CRITERIA = [...DEFAULT_TIEBREAKER_ORDER];

export interface TournamentPlaySettingsInput {
  play_format: TournamentPlayFormat;
  group_size?: number | null;
  swiss_rounds?: number | null;
  tiebreaker_order?: TiebreakerCriterion[] | null;
}

export function parseTiebreakerOrder(
  value: unknown,
): TiebreakerCriterion[] | null {
  if (value == null) {
    return null;
  }
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) {
    return null;
  }
  const allowed = new Set(Object.values(TiebreakerCriterion));
  const parsed = raw.filter(
    (item): item is TiebreakerCriterion =>
      typeof item === "string" && allowed.has(item as TiebreakerCriterion),
  );
  return parsed.length > 0 ? parsed : null;
}

export function parseGroupDraw(value: unknown): TournamentGroupDrawGroup[] | null {
  if (value == null) {
    return null;
  }
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) {
    return null;
  }
  const groups: TournamentGroupDrawGroup[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof item.group_number === "number" &&
      Array.isArray(item.team_ids) &&
      item.team_ids.every((id: unknown) => typeof id === "number")
    ) {
      groups.push({
        group_number: item.group_number,
        team_ids: [...item.team_ids],
      });
    }
  }
  return groups.length > 0 ? groups : null;
}

export function validatePlaySettings(
  input: TournamentPlaySettingsInput,
): string | null {
  const allowedFormats = Object.values(TournamentPlayFormat);
  if (!allowedFormats.includes(input.play_format)) {
    return "Укажите формат турнира: группы или швейцарская система";
  }

  if (input.play_format === TournamentPlayFormat.GROUPS) {
    const size = input.group_size;
    if (size == null || size < 4 || size > 6) {
      return "Для группового формата укажите размер группы от 4 до 6";
    }
    return null;
  }

  const rounds = input.swiss_rounds;
  if (rounds == null || !Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
    return "Для швейцарской системы укажите количество туров от 1 до 20";
  }

  const order = input.tiebreaker_order ?? [];
  if (order.length > ALL_TIEBREAKER_CRITERIA.length) {
    return "Слишком много дополнительных показателей";
  }
  const unique = new Set(order);
  if (unique.size !== order.length) {
    return "Каждый дополнительный показатель должен встречаться не более одного раза";
  }
  for (const criterion of order) {
    if (!ALL_TIEBREAKER_CRITERIA.includes(criterion)) {
      return "Недопустимый дополнительный показатель";
    }
  }

  return null;
}

function shuffleTeamIds(teamIds: number[]): number[] {
  const result = [...teamIds];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Случайная жеребьёвка команд по группам с ограничением размера группы.
 */
export function performGroupDraw(
  teamIds: number[],
  groupSize: number,
): TournamentGroupDrawGroup[] {
  if (teamIds.length === 0) {
    return [];
  }

  const shuffled = shuffleTeamIds(teamIds);
  const numGroups = Math.max(1, Math.ceil(shuffled.length / groupSize));
  const groups: TournamentGroupDrawGroup[] = Array.from(
    { length: numGroups },
    (_, index) => ({
      group_number: index + 1,
      team_ids: [],
    }),
  );

  let groupIndex = 0;
  for (const teamId of shuffled) {
    while (
      groups[groupIndex].team_ids.length >= groupSize &&
      groupIndex < numGroups - 1
    ) {
      groupIndex++;
    }
    groups[groupIndex].team_ids.push(teamId);
    if (
      groups[groupIndex].team_ids.length >= groupSize &&
      groupIndex < numGroups - 1
    ) {
      groupIndex++;
    }
  }

  return groups.filter((group) => group.team_ids.length > 0);
}
