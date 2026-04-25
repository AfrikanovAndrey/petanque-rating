import { TournamentType } from "../types";

export const REGISTRATION_ROSTER_VERSION = 1 as const;

/** Слот в JSON в БД (имена игроков из базы денормализованы при сохранении). */
export type RegistrationRosterStoredSlot =
  | { kind: "player"; player_id: number; display_name: string }
  | { kind: "new"; display_name: string }
  | { kind: "empty" };

export type RegistrationRosterStored = {
  version: typeof REGISTRATION_ROSTER_VERSION;
  slots: RegistrationRosterStoredSlot[];
};

/** Тело POST регистрации: слоты заявки. */
export type RegistrationRosterRequestSlot =
  | { kind: "player"; player_id: number }
  | { kind: "new"; display_name: string }
  | { kind: "empty" };

export function registrationRosterHasNewPlayer(
  roster: RegistrationRosterStored | null,
): boolean {
  if (!roster?.slots?.length) {
    return false;
  }
  return roster.slots.some((s) => s.kind === "new");
}

export function parseRegistrationRosterJson(
  raw: unknown,
): RegistrationRosterStored | null {
  if (raw == null) {
    return null;
  }
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== REGISTRATION_ROSTER_VERSION) {
    return null;
  }
  if (!Array.isArray(obj.slots)) {
    return null;
  }
  const slots: RegistrationRosterStoredSlot[] = [];
  for (const item of obj.slots) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const s = item as Record<string, unknown>;
    if (s.kind === "empty") {
      slots.push({ kind: "empty" });
      continue;
    }
    if (s.kind === "new") {
      const name =
        typeof s.display_name === "string" ? s.display_name.trim() : "";
      if (name.length < 2) {
        return null;
      }
      slots.push({ kind: "new", display_name: name });
      continue;
    }
    if (s.kind === "player") {
      const id = Number(s.player_id);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }
      const dn =
        typeof s.display_name === "string" ? s.display_name.trim() : "";
      if (dn.length < 1) {
        return null;
      }
      slots.push({
        kind: "player",
        player_id: id,
        display_name: dn,
      });
      continue;
    }
    return null;
  }
  return { version: REGISTRATION_ROSTER_VERSION, slots };
}

export function getExpectedSlotCount(type: TournamentType): number {
  switch (type) {
    case TournamentType.TRIPLETTE:
      return 4;
    case TournamentType.DOUBLETTE_MALE:
    case TournamentType.DOUBLETTE_FEMALE:
    case TournamentType.DOUBLETTE_MIXT:
      return 2;
    case TournamentType.TET_A_TET_MALE:
    case TournamentType.TET_A_TET_FEMALE:
      return 1;
    default:
      return 1;
  }
}

function countFilledSlots(slots: RegistrationRosterRequestSlot[]): number {
  let n = 0;
  for (const s of slots) {
    if (s.kind === "empty") {
      continue;
    }
    if (s.kind === "new") {
      if (s.display_name.trim().length >= 2) {
        n += 1;
      }
      continue;
    }
    n += 1;
  }
  return n;
}

/** Проверка слотов из запроса до загрузки игроков из БД. */
export function parseRegistrationRosterRequestSlots(
  raw: unknown,
): RegistrationRosterRequestSlot[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: RegistrationRosterRequestSlot[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") {
      return null;
    }
    const o = x as Record<string, unknown>;
    if (o.kind === "empty") {
      out.push({ kind: "empty" });
      continue;
    }
    if (o.kind === "new") {
      const dn =
        typeof o.display_name === "string" ? o.display_name : String(o.display_name ?? "");
      out.push({ kind: "new", display_name: dn });
      continue;
    }
    if (o.kind === "player") {
      const idRaw = o.player_id;
      const id =
        typeof idRaw === "number" && Number.isInteger(idRaw)
          ? idRaw
          : parseInt(String(idRaw), 10);
      out.push({ kind: "player", player_id: id });
      continue;
    }
    return null;
  }
  return out;
}

/** Преобразование старого формата { player_ids } в слоты. */
export function buildStoredRosterFromRequestSlots(
  requestSlots: RegistrationRosterRequestSlot[],
  idToDisplayName: Map<number, string>,
): RegistrationRosterStored | null {
  const slots: RegistrationRosterStoredSlot[] = [];
  for (const s of requestSlots) {
    if (s.kind === "empty") {
      slots.push({ kind: "empty" });
      continue;
    }
    if (s.kind === "new") {
      slots.push({
        kind: "new",
        display_name: s.display_name.trim(),
      });
      continue;
    }
    const nm = idToDisplayName.get(s.player_id);
    if (!nm?.trim()) {
      return null;
    }
    slots.push({
      kind: "player",
      player_id: s.player_id,
      display_name: nm.trim(),
    });
  }
  return { version: REGISTRATION_ROSTER_VERSION, slots };
}

export function legacyPlayerIdsToRequestSlots(
  type: TournamentType,
  playerIds: number[],
): RegistrationRosterRequestSlot[] | null {
  const expected = getExpectedSlotCount(type);
  const slots: RegistrationRosterRequestSlot[] = [];
  for (const id of playerIds) {
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    slots.push({ kind: "player", player_id: id });
  }
  while (slots.length < expected) {
    if (type === TournamentType.TRIPLETTE) {
      slots.push({ kind: "empty" });
    } else {
      return null;
    }
  }
  if (slots.length !== expected) {
    return null;
  }
  return slots;
}

export function validateRegistrationRequestSlotsShape(
  type: TournamentType,
  slots: RegistrationRosterRequestSlot[],
): string | null {
  const expected = getExpectedSlotCount(type);
  if (slots.length !== expected) {
    return `Ожидается ${expected} слот(а) состава, получено ${slots.length}.`;
  }
  for (const s of slots) {
    if (s.kind === "new") {
      const t = s.display_name.trim();
      if (t.length < 2) {
        return "Для нового игрока укажите ФИО не короче 2 символов.";
      }
      if (t.length > 200) {
        return "Слишком длинное ФИО нового игрока.";
      }
    }
    if (s.kind === "player") {
      const id = Number(s.player_id);
      if (!Number.isInteger(id) || id <= 0) {
        return "Некорректный идентификатор игрока.";
      }
    }
  }

  if (type === TournamentType.TRIPLETTE) {
    const emptyCount = slots.filter((x) => x.kind === "empty").length;
    if (emptyCount > 1) {
      return "В триплете не более одного пустого слота.";
    }
    const filled = countFilledSlots(slots);
    if (filled < 3 || filled > 4) {
      return "В триплете укажите от 3 до 4 игроков.";
    }
    return null;
  }

  if (slots.some((s) => s.kind === "empty")) {
    return "Пустые слоты допустимы только для триплета.";
  }

  if (countFilledSlots(slots) !== expected) {
    return "Заполните все поля состава.";
  }

  return null;
}
