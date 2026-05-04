import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "react-query";
import { registerTeamForTournamentPublic } from "../services/api";
import {
  PlayerSearchResult,
  RegisterTournamentSlotPayload,
  Tournament,
  TournamentType,
} from "../types";
import { getTournamentTypeText } from "../utils";
import { PlayerAutocompleteField } from "./PlayerAutocompleteField";

type SlotCfg = {
  slots: number;
  min: number;
  max: number;
  /** Фильтр поиска по полу для каждого слота; undefined — без фильтра (триплет) */
  genders: ("male" | "female" | undefined)[];
  tripletteHint?: boolean;
};

/** Подпись поля: «Игрок 1 (М)», «Игрок 2 (Ж)» и т.д. */
function buildPlayerFieldLabel(
  slotIndex: number,
  totalSlots: number,
  gender?: "male" | "female"
): string {
  const base = totalSlots > 1 ? `Игрок ${slotIndex + 1}` : "Игрок";
  if (gender === "male") {
    return `${base} (М)`;
  }
  if (gender === "female") {
    return `${base} (Ж)`;
  }
  return base;
}

function getSlotConfig(type: TournamentType): SlotCfg {
  switch (type) {
    case TournamentType.TET_A_TET_MALE:
      return { slots: 1, min: 1, max: 1, genders: ["male"] };
    case TournamentType.TET_A_TET_FEMALE:
      return { slots: 1, min: 1, max: 1, genders: ["female"] };
    case TournamentType.DOUBLETTE_MALE:
      return { slots: 2, min: 2, max: 2, genders: ["male", "male"] };
    case TournamentType.DOUBLETTE_FEMALE:
      return { slots: 2, min: 2, max: 2, genders: ["female", "female"] };
    case TournamentType.DOUBLETTE_MIXT:
      return {
        slots: 2,
        min: 2,
        max: 2,
        genders: ["male", "female"],
      };
    case TournamentType.TRIPLETTE:
      return {
        slots: 4,
        min: 3,
        max: 4,
        genders: [undefined, undefined, undefined, undefined],
        tripletteHint: true,
      };
    default:
      return { slots: 1, min: 1, max: 1, genders: [undefined] };
  }
}

type Props = {
  tournamentId: number;
  tournament: Tournament;
  onClose: () => void;
  /** По умолчанию — публичная страница регистрации */
  context?: "public" | "admin";
  /** Ключи react-query для инвалидации после успешной регистрации */
  invalidateQueryKeys?: readonly (readonly unknown[])[];
  /** Подпись основной кнопки отправки */
  submitButtonLabel?: string;
};

export const RegisterTeamModal: React.FC<Props> = ({
  tournamentId,
  tournament,
  onClose,
  context = "public",
  invalidateQueryKeys,
  submitButtonLabel,
}) => {
  const queryClient = useQueryClient();
  const cfg = useMemo(
    () => getSlotConfig(tournament.type as TournamentType),
    [tournament.type]
  );

  const [slots, setSlots] = useState<(PlayerSearchResult | null)[]>(() =>
    Array.from({ length: cfg.slots }, () => null)
  );
  const [asNew, setAsNew] = useState<boolean[]>(() =>
    Array.from({ length: cfg.slots }, () => false)
  );
  const [newNames, setNewNames] = useState<string[]>(() =>
    Array.from({ length: cfg.slots }, () => "")
  );
  const [newLicenses, setNewLicenses] = useState<string[]>(() =>
    Array.from({ length: cfg.slots }, () => "")
  );
  const [newCities, setNewCities] = useState<string[]>(() =>
    Array.from({ length: cfg.slots }, () => "")
  );
  /** Для триплета — выбор пользователя; для гендерных слотов задаётся типом турнира */
  const [newGenders, setNewGenders] = useState<("male" | "female" | null)[]>(
    () =>
      Array.from({ length: cfg.slots }, (_, j) =>
        cfg.genders[j] === "male" || cfg.genders[j] === "female"
          ? cfg.genders[j]
          : null
      )
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSlots(Array.from({ length: cfg.slots }, () => null));
    setAsNew(Array.from({ length: cfg.slots }, () => false));
    setNewNames(Array.from({ length: cfg.slots }, () => ""));
    setNewLicenses(Array.from({ length: cfg.slots }, () => ""));
    setNewCities(Array.from({ length: cfg.slots }, () => ""));
    setNewGenders(
      Array.from({ length: cfg.slots }, (_, j) =>
        cfg.genders[j] === "male" || cfg.genders[j] === "female"
          ? cfg.genders[j]
          : null
      )
    );
    setFormError("");
  }, [tournamentId, cfg.slots, cfg.genders]);

  const excludeIdsFor = (index: number) =>
    slots
      .map((s, j) =>
        j !== index && !asNew[j] ? s?.id : undefined
      )
      .filter((x): x is number => x != null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const payload: RegisterTournamentSlotPayload[] = [];
    for (let i = 0; i < cfg.slots; i++) {
      if (asNew[i]) {
        const t = newNames[i].trim();
        if (t.length < 2) {
          setFormError(
            `Укажите ФИО для «${buildPlayerFieldLabel(i, cfg.slots, cfg.genders[i])}» (не короче 2 символов).`
          );
          return;
        }
        if (t.length > 200) {
          setFormError("Слишком длинное ФИО нового игрока.");
          return;
        }
        const genderEff =
          cfg.genders[i] === "male" || cfg.genders[i] === "female"
            ? cfg.genders[i]
            : newGenders[i];
        if (genderEff !== "male" && genderEff !== "female") {
          setFormError(
            `Укажите пол для «${buildPlayerFieldLabel(i, cfg.slots, cfg.genders[i])}».`
          );
          return;
        }
        const lic = newLicenses[i].trim();
        if (lic.length > 20) {
          setFormError("Номер лицензии не длиннее 20 символов.");
          return;
        }
        const city = newCities[i].trim();
        if (city.length > 100) {
          setFormError("Название города не длиннее 100 символов.");
          return;
        }
        payload.push({
          kind: "new",
          display_name: t,
          gender: genderEff,
          ...(lic.length > 0 ? { license_number: lic } : {}),
          ...(city.length > 0 ? { city } : {}),
        });
        continue;
      }
      if (slots[i]) {
        payload.push({ kind: "player", player_id: slots[i]!.id });
        continue;
      }
      if (tournament.type === TournamentType.TRIPLETTE) {
        payload.push({ kind: "empty" });
        continue;
      }
      setFormError("Заполните все поля, выбрав игроков из списка.");
      return;
    }

    const dbIds = payload
      .filter((s): s is { kind: "player"; player_id: number } => s.kind === "player")
      .map((s) => s.player_id);
    if (new Set(dbIds).size !== dbIds.length) {
      setFormError("Один игрок не может быть выбран дважды.");
      return;
    }

    const filled = payload.filter(
      (s) => s.kind === "player" || s.kind === "new"
    ).length;
    if (tournament.type === TournamentType.TRIPLETTE) {
      if (filled < cfg.min || filled > cfg.max) {
        setFormError(
          `В триплете укажите от ${cfg.min} до ${cfg.max} игроков (включая новых).`
        );
        return;
      }
    } else {
      if (filled !== cfg.slots) {
        setFormError("Заполните все поля состава.");
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await registerTeamForTournamentPublic(tournamentId, payload);
      if (!res.data.success) {
        setFormError(String(res.data.message || "Ошибка регистрации"));
        return;
      }
      const keysToInvalidate =
        invalidateQueryKeys ??
        ([["publicTournamentRegistration", tournamentId]] as const);
      for (const key of keysToInvalidate) {
        await queryClient.invalidateQueries(key);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setFormError(
        typeof msg === "string" ? msg : "Не удалось отправить заявку"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:pt-16"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-team-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          aria-label="Закрыть"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <form onSubmit={handleSubmit} className="p-6 pt-10 space-y-4">
          <div>
            <h2
              id="register-team-title"
              className="text-lg font-semibold text-gray-900"
            >
              Зарегистрировать команду
            </h2>
            <p className="mt-1 text-sm text-gray-600">{tournament.name}</p>
            <p className="mt-1 text-sm text-gray-500">
              {getTournamentTypeText(tournament.type as TournamentType) ??
                tournament.type}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {context === "admin" ? (
                <>
                  Участника нет в базе — отметьте «Новый игрок» и введите ФИО.
                  Такую заявку можно подтвердить только когда все игроки есть в
                  базе (через «Изменить состав»). Если все выбраны из списка,
                  подтвердите заявку кнопкой «Подтвердить».
                </>
              ) : (
                <>
                  Если участника ещё нет в базе рейтинга, отметьте «Новый игрок»
                  и введите ФИО. Организатор сможет подтвердить заявку только
                  после того, как все игроки будут заведены в базу и выбраны из
                  списка.
                </>
              )}
            </p>
            {cfg.tripletteHint && (
              <p className="mt-2 text-sm text-gray-600">
                Состав триплета: от 3 до 4 игроков, пол не ограничен. Одно поле
                можно оставить пустым, если в команде три игрока.
              </p>
            )}
          </div>

          {slots.map((slot, i) => (
            <div key={i} className="space-y-2 rounded-md border border-gray-100 bg-gray-50/60 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  checked={asNew[i]}
                  disabled={submitting}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAsNew((prev) => {
                      const next = [...prev];
                      next[i] = checked;
                      return next;
                    });
                    if (checked) {
                      setSlots((prev) => {
                        const next = [...prev];
                        next[i] = null;
                        return next;
                      });
                      setNewGenders((prev) => {
                        const next = [...prev];
                        const g = cfg.genders[i];
                        next[i] =
                          g === "male" || g === "female" ? g : null;
                        return next;
                      });
                    } else {
                      setNewNames((prev) => {
                        const next = [...prev];
                        next[i] = "";
                        return next;
                      });
                      setNewLicenses((prev) => {
                        const next = [...prev];
                        next[i] = "";
                        return next;
                      });
                      setNewCities((prev) => {
                        const next = [...prev];
                        next[i] = "";
                        return next;
                      });
                      setNewGenders((prev) => {
                        const next = [...prev];
                        const g = cfg.genders[i];
                        next[i] =
                          g === "male" || g === "female" ? g : null;
                        return next;
                      });
                    }
                  }}
                />
                <span>Новый игрок</span>
              </label>
              {asNew[i] ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {buildPlayerFieldLabel(i, cfg.slots, cfg.genders[i])} — ФИО
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                      value={newNames[i]}
                      onChange={(e) =>
                        setNewNames((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      disabled={submitting}
                      placeholder="Как в заявке, например Иванов Иван"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Номер лицензии
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                      value={newLicenses[i]}
                      onChange={(e) =>
                        setNewLicenses((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      disabled={submitting}
                      autoComplete="off"
                    />
                    <p className="mt-1 text-xs text-gray-500">Необязательное поле</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Пол
                    </label>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name={`new-gender-${i}`}
                          className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={newGenders[i] === "male"}
                          disabled={
                            submitting ||
                            cfg.genders[i] === "female"
                          }
                          onChange={() =>
                            setNewGenders((prev) => {
                              const next = [...prev];
                              next[i] = "male";
                              return next;
                            })
                          }
                        />
                        Мужской
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name={`new-gender-${i}`}
                          className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={newGenders[i] === "female"}
                          disabled={
                            submitting ||
                            cfg.genders[i] === "male"
                          }
                          onChange={() =>
                            setNewGenders((prev) => {
                              const next = [...prev];
                              next[i] = "female";
                              return next;
                            })
                          }
                        />
                        Женский
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Город
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                      value={newCities[i]}
                      onChange={(e) =>
                        setNewCities((prev) => {
                          const next = [...prev];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      disabled={submitting}                    
                      autoComplete="address-level2"
                    />
                  </div>
                </div>
              ) : (
                <PlayerAutocompleteField
                  label={buildPlayerFieldLabel(i, cfg.slots, cfg.genders[i])}
                  gender={cfg.genders[i]}
                  value={slot}
                  onChange={(p) => {
                    setSlots((prev) => {
                      const next = [...prev];
                      next[i] = p;
                      return next;
                    });
                  }}
                  excludeIds={excludeIdsFor(i)}
                  disabled={submitting}
                />
              )}
            </div>
          ))}

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting
                ? "Отправка…"
                : submitButtonLabel ??
                  (context === "admin"
                    ? "Зарегистрировать команду"
                    : "Отправить заявку")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(modal, document.body);
};
