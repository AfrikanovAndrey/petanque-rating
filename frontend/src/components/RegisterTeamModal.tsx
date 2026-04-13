import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "react-query";
import { registerTeamForTournamentPublic } from "../services/api";
import { PlayerSearchResult, Tournament, TournamentType } from "../types";
import { getTournamentTypeText } from "../utils";
import { PlayerAutocompleteField } from "./PlayerAutocompleteField";

type SlotCfg = {
  slots: number;
  min: number;
  max: number;
  genders: ("male" | "female" | undefined)[];
  tripletteHint?: boolean;
};

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
        genders: [undefined, undefined],
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
};

export const RegisterTeamModal: React.FC<Props> = ({
  tournamentId,
  tournament,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const cfg = useMemo(
    () => getSlotConfig(tournament.type as TournamentType),
    [tournament.type]
  );

  const [slots, setSlots] = useState<(PlayerSearchResult | null)[]>(() =>
    Array.from({ length: cfg.slots }, () => null)
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSlots(Array.from({ length: cfg.slots }, () => null));
    setFormError("");
  }, [tournamentId, cfg.slots]);

  const excludeIdsFor = (index: number) =>
    slots
      .map((s, j) => (j !== index ? s?.id : undefined))
      .filter((x): x is number => x != null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const filled = slots.filter((s): s is PlayerSearchResult => s !== null);
    const ids = filled.map((p) => p.id);

    if (new Set(ids).size !== ids.length) {
      setFormError("Один игрок не может быть выбран дважды.");
      return;
    }

    if (tournament.type === TournamentType.TRIPLETTE) {
      if (filled.length < cfg.min || filled.length > cfg.max) {
        setFormError(
          `В триплете укажите от ${cfg.min} до ${cfg.max} игроков (выбор только из базы).`
        );
        return;
      }
    } else {
      if (filled.length !== cfg.slots) {
        setFormError("Заполните все поля, выбрав игроков из списка.");
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await registerTeamForTournamentPublic(tournamentId, ids);
      if (!res.data.success) {
        setFormError(String(res.data.message || "Ошибка регистрации"));
        return;
      }
      await queryClient.invalidateQueries([
        "publicTournamentRegistration",
        tournamentId,
      ]);
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
            {cfg.tripletteHint && (
              <p className="mt-2 text-sm text-gray-600">
                Состав триплета: от 3 до 4 игроков, пол не ограничен. Одно поле
                можно оставить пустым, если в команде три игрока.
              </p>
            )}
          </div>

          {slots.map((slot, i) => (
            <PlayerAutocompleteField
              key={i}
              label={
                cfg.slots > 1 ? `Игрок ${i + 1}` : "Игрок"
              }
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
              {submitting ? "Отправка…" : "Отправить заявку"}
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
