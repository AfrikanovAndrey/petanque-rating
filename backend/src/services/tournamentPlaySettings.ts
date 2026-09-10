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
  french_system?: boolean | null;
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
    if (input.french_system && size !== 4) {
      return "Французская система доступна только при размере группы 4";
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
 * Равномерные размеры групп при ограничении maxGroupSize.
 * Пример: 6 команд, max 4 → [3, 3], а не [4, 2].
 */
export function getEvenGroupSizes(
  teamCount: number,
  maxGroupSize: number,
): number[] {
  if (teamCount <= 0 || maxGroupSize <= 0) {
    return [];
  }
  const numGroups = Math.max(1, Math.ceil(teamCount / maxGroupSize));
  const base = Math.floor(teamCount / numGroups);
  const remainder = teamCount % numGroups;
  return Array.from(
    { length: numGroups },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

/**
 * Случайная жеребьёвка команд по группам: размеры групп выравниваются
 * (разница не больше 1), при этом не превышая maxGroupSize.
 */
export function performGroupDraw(
  teamIds: number[],
  groupSize: number,
): TournamentGroupDrawGroup[] {
  if (teamIds.length === 0) {
    return [];
  }

  const shuffled = shuffleTeamIds(teamIds);
  const sizes = getEvenGroupSizes(shuffled.length, groupSize);
  const groups: TournamentGroupDrawGroup[] = sizes.map((size, index) => ({
    group_number: index + 1,
    team_ids: [],
  }));

  let offset = 0;
  for (let i = 0; i < sizes.length; i++) {
    groups[i].team_ids = shuffled.slice(offset, offset + sizes[i]);
    offset += sizes[i];
  }

  return groups;
}

/**
 * Проверка ручной жеребьёвки: все подтверждённые команды ровно один раз,
 * размеры групп — равномерные и не больше groupSize.
 */
export function validateManualGroupDraw(
  groupDraw: TournamentGroupDrawGroup[],
  confirmedTeamIds: number[],
  groupSize: number,
): string | null {
  if (!Array.isArray(groupDraw) || groupDraw.length === 0) {
    return "Укажите распределение команд по группам";
  }

  const confirmedSet = new Set(confirmedTeamIds);
  if (confirmedSet.size === 0) {
    return "Нет подтверждённых заявок для жеребьёвки";
  }

  const expectedSizes = getEvenGroupSizes(confirmedTeamIds.length, groupSize);
  if (groupDraw.length !== expectedSizes.length) {
    return `Ожидается ${expectedSizes.length} групп(ы) при размере группы до ${groupSize}`;
  }

  const seen = new Set<number>();
  for (let i = 0; i < groupDraw.length; i++) {
    const group = groupDraw[i];
    if (!group || group.group_number !== i + 1) {
      return "Номера групп должны идти подряд, начиная с 1";
    }
    if (!Array.isArray(group.team_ids) || group.team_ids.length === 0) {
      return `Группа ${i + 1} пуста`;
    }
    if (group.team_ids.length !== expectedSizes[i]) {
      return `В группе ${i + 1} должно быть ${expectedSizes[i]} команд(ы) (равномерное распределение)`;
    }
    if (group.team_ids.length > groupSize) {
      return `В группе ${i + 1} больше ${groupSize} команд`;
    }
    for (const teamId of group.team_ids) {
      if (!Number.isInteger(teamId) || teamId <= 0) {
        return "Некорректный идентификатор команды в жеребьёвке";
      }
      if (!confirmedSet.has(teamId)) {
        return `Команда #${teamId} не входит в подтверждённые заявки`;
      }
      if (seen.has(teamId)) {
        return "Одна и та же команда указана в нескольких группах";
      }
      seen.add(teamId);
    }
  }

  if (seen.size !== confirmedSet.size) {
    const missing = confirmedTeamIds.filter((id) => !seen.has(id));
    return `Не все подтверждённые команды распределены (осталось: ${missing.length})`;
  }

  return null;
}
