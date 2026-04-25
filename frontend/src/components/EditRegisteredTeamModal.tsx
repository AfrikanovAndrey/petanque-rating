import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "react-query";
import { adminApi } from "../services/api";
import {
  PlayerSearchResult,
  Tournament,
  TournamentRegisteredTeam,
  TournamentType,
} from "../types";
import { getTournamentTypeText } from "../utils";
import { PlayerAutocompleteField } from "./PlayerAutocompleteField";

type SlotCfg = {
  slots: number;
  min: number;
  max: number;
  genders: ("male" | "female" | undefined)[];
  tripletteHint?: boolean;
};

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
  team: TournamentRegisteredTeam;
  onClose: () => void;
};

export const EditRegisteredTeamModal: React.FC<Props> = ({
  tournamentId,
  tournament,
  team,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const cfg = useMemo(
    () => getSlotConfig(tournament.type as TournamentType),
    [tournament.type]
  );

  const buildInitialSlots = (): (PlayerSearchResult | null)[] => {
    const size = cfg.slots;
    const base = Array.from({ length: size }, () => null) as (
      | PlayerSearchResult
      | null
    )[];
    const maxIndex = Math.min(size, team.player_ids.length, team.players.length);
    for (let i = 0; i < maxIndex; i++) {
      base[i] = {
        id: team.player_ids[i],
        name: team.players[i],
        gender: null,
      };
    }
    return base;
  };

  const [slots, setSlots] = useState<(PlayerSearchResult | null)[]>(() =>
    buildInitialSlots()
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSlots(buildInitialSlots());
    setFormError("");
  }, [team.team_id, cfg.slots]);

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
        setFormError(`В триплете укажите от ${cfg.min} до ${cfg.max} игроков.`);
        return;
      }
    } else if (filled.length !== cfg.slots) {
      setFormError("Заполните все поля, выбрав игроков из списка.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminApi.updateTournamentRegistrationTeam(
        tournamentId,
        team.team_id,
        ids
      );
      if (!res.data.success) {
        setFormError(String(res.data.message || "Ошибка изменения состава"));
        return;
      }
      await queryClient.invalidateQueries(["tournamentRegistration", tournamentId]);
      onClose();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      setFormError(
        typeof msg === "string" ? msg : "Не удалось изменить состав команды"
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
        aria-labelledby="edit-team-title"
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
            <h2 id="edit-team-title" className="text-lg font-semibold text-gray-900">
              Изменить состав команды
            </h2>
            <p className="mt-1 text-sm text-gray-600">{tournament.name}</p>
            <p className="mt-1 text-sm text-gray-500">
              {getTournamentTypeText(tournament.type as TournamentType) ??
                tournament.type}
            </p>
            {cfg.tripletteHint && (
              <p className="mt-2 text-sm text-gray-600">
                Состав триплета: от 3 до 4 игроков. Одно поле можно оставить
                пустым, если в команде три игрока.
              </p>
            )}
          </div>

          {slots.map((slot, i) => (
            <PlayerAutocompleteField
              key={i}
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
              {submitting ? "Сохранение…" : "Сохранить состав"}
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
