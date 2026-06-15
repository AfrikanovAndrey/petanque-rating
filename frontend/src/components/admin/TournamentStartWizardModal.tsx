import { TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useMutation } from "react-query";
import { adminApi } from "../../services/api";
import {
  TiebreakerCriterion,
  Tournament,
  TournamentGroupDrawGroup,
  TournamentPlayFormat,
  TournamentRegisteredTeam,
} from "../../types";
import { handleApiError } from "../../utils";
import {
  ALL_TIEBREAKER_CRITERIA,
  getGroupLetter,
  getPlayFormatLabel,
  getTiebreakerLabel,
} from "../../utils/tournamentPlaySettings";

type WizardStep = 1 | 2 | 3;

type Props = {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
  tournament: Tournament;
  teams: TournamentRegisteredTeam[];
  confirmedTeamsCount: number;
  onSuccess: () => void;
};

const TournamentStartWizardModal: React.FC<Props> = ({
  open,
  onClose,
  tournamentId,
  tournament,
  teams,
  confirmedTeamsCount,
  onSuccess,
}) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [playFormat, setPlayFormat] = useState<TournamentPlayFormat | null>(
    tournament.play_format ?? null
  );
  const [groupSize, setGroupSize] = useState<number>(
    tournament.group_size ?? 4
  );
  const [swissRounds, setSwissRounds] = useState<number>(
    tournament.swiss_rounds ?? 5
  );
  const [tiebreakerOrder, setTiebreakerOrder] = useState<TiebreakerCriterion[]>(
    tournament.tiebreaker_order ?? []
  );
  const [pendingTiebreaker, setPendingTiebreaker] = useState<
    TiebreakerCriterion | ""
  >("");
  const [groupDraw, setGroupDraw] = useState<TournamentGroupDrawGroup[] | null>(
    tournament.group_draw ?? null
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setPlayFormat(tournament.play_format ?? null);
    setGroupSize(tournament.group_size ?? 4);
    setSwissRounds(tournament.swiss_rounds ?? 5);
    setTiebreakerOrder(tournament.tiebreaker_order ?? []);
    setPendingTiebreaker("");
    setGroupDraw(tournament.group_draw ?? null);
  }, [open, tournament]);

  const availableTiebreakers = useMemo(
    () =>
      ALL_TIEBREAKER_CRITERIA.filter(
        (criterion) => !tiebreakerOrder.includes(criterion)
      ),
    [tiebreakerOrder]
  );

  useEffect(() => {
    if (
      pendingTiebreaker &&
      !availableTiebreakers.includes(pendingTiebreaker)
    ) {
      setPendingTiebreaker("");
    }
  }, [availableTiebreakers, pendingTiebreaker]);

  const teamNameById = useMemo(
    () =>
      new Map(
        teams.map((team) => [
          team.team_id,
          team.players.join(", "),
        ])
      ),
    [teams]
  );

  const totalSteps = playFormat === TournamentPlayFormat.GROUPS ? 3 : 2;

  const saveSettingsMutation = useMutation(
    async () => {
      if (!playFormat) {
        throw new Error("Выберите формат турнира");
      }
      const response = await adminApi.updateTournamentPlaySettings(
        tournamentId,
        {
          play_format: playFormat,
          group_size:
            playFormat === TournamentPlayFormat.GROUPS ? groupSize : null,
          swiss_rounds:
            playFormat === TournamentPlayFormat.SWISS ? swissRounds : null,
          tiebreaker_order:
            playFormat === TournamentPlayFormat.SWISS
              ? tiebreakerOrder
              : null,
        }
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Не удалось сохранить настройки");
      }
      return response.data.data;
    },
    {
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const drawMutation = useMutation(
    async () => {
      const response = await adminApi.performTournamentGroupDraw(tournamentId);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Не удалось провести жеребьёвку");
      }
      return response.data.data.group_draw;
    },
    {
      onSuccess: (draw) => {
        setGroupDraw(draw);
        toast.success("Жеребьёвка выполнена");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const startMutation = useMutation(
    async () => {
      const response = await adminApi.startTournament(tournamentId);
      if (!response.data.success) {
        throw new Error(response.data.message || "Не удалось начать турнир");
      }
    },
    {
      onSuccess: () => {
        toast.success("Турнир переведён в статус «В процессе»");
        onSuccess();
        onClose();
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const addTiebreaker = () => {
    if (!pendingTiebreaker) {
      toast.error("Выберите показатель из списка");
      return;
    }
    setTiebreakerOrder((prev) => [...prev, pendingTiebreaker]);
    setPendingTiebreaker("");
  };

  const removeTiebreaker = (index: number) => {
    setTiebreakerOrder((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNextFromStep1 = () => {
    if (!playFormat) {
      toast.error("Выберите формат турнира");
      return;
    }
    setStep(2);
  };

  const handleNextFromStep2 = async () => {
    try {
      await saveSettingsMutation.mutateAsync();
      if (playFormat === TournamentPlayFormat.GROUPS) {
        setGroupDraw(null);
        setStep(3);
      } else {
        await startMutation.mutateAsync();
      }
    } catch {
      // toast already shown
    }
  };

  const handleStartWithGroups = async () => {
    if (!groupDraw || groupDraw.length === 0) {
      toast.error("Сначала проведите жеребьёвку");
      return;
    }
    try {
      await startMutation.mutateAsync();
    } catch {
      // toast already shown
    }
  };

  const isBusy =
    saveSettingsMutation.isLoading ||
    drawMutation.isLoading ||
    startMutation.isLoading;

  if (!open) {
    return null;
  }

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:pt-16"
      role="presentation"
      onClick={(e) => {
        if (!isBusy && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-start-wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          aria-label="Закрыть"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="border-b border-gray-200 px-6 py-4">
          <h2
            id="tournament-start-wizard-title"
            className="text-lg font-semibold text-gray-900 pr-8"
          >
            Начать турнир
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Шаг {step} из {totalSteps}
          </p>
          <div className="mt-3 flex gap-2">
            {Array.from({ length: totalSteps }, (_, index) => {
              const stepNumber = (index + 1) as WizardStep;
              const isActive = step === stepNumber;
              const isDone = step > stepNumber;
              return (
                <div
                  key={stepNumber}
                  className={`h-1.5 flex-1 rounded-full ${
                    isActive
                      ? "bg-primary-600"
                      : isDone
                        ? "bg-primary-300"
                        : "bg-gray-200"
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Выберите формат квалификационного этапа турнира.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[TournamentPlayFormat.GROUPS, TournamentPlayFormat.SWISS].map(
                  (format) => (
                    <label
                      key={format}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        playFormat === format
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="play-format"
                        className="mt-1 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={playFormat === format}
                        onChange={() => setPlayFormat(format)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          {getPlayFormatLabel(format)}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {format === TournamentPlayFormat.GROUPS
                            ? "Команды распределяются по группам с жеребьёвкой"
                            : "Паринг по швейцарской системе с настраиваемыми турами"}
                        </span>
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          )}

          {step === 2 && playFormat === TournamentPlayFormat.GROUPS && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Укажите максимальное количество участников в одной группе.
              </p>
              <div>
                <label
                  htmlFor="group-size"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Участников в группе
                </label>
                <select
                  id="group-size"
                  className="input-field max-w-xs"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                >
                  {[4, 5, 6].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-500">
                Подтверждённых заявок: {confirmedTeamsCount}
              </p>
            </div>
          )}

          {step === 2 && playFormat === TournamentPlayFormat.SWISS && (
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="swiss-rounds"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Количество туров
                </label>
                <input
                  id="swiss-rounds"
                  type="number"
                  min={1}
                  max={20}
                  className="input-field max-w-xs"
                  value={swissRounds}
                  onChange={(e) =>
                    setSwissRounds(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Порядок дополнительных показателей
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  При необходимости добавляйте показатели по одному: первый в списке
                  имеет наивысший приоритет при равенстве очков. Можно указать не все.
                </p>

                {tiebreakerOrder.length > 0 && (
                  <ul className="mb-4 space-y-2">
                    {tiebreakerOrder.map((criterion, index) => (
                      <li
                        key={`${criterion}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <span className="text-sm text-gray-900">
                          <span className="mr-2 text-gray-400">{index + 1}.</span>
                          {getTiebreakerLabel(criterion)}
                        </span>
                        <button
                          type="button"
                          className="rounded border border-gray-300 bg-white p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                          onClick={() => removeTiebreaker(index)}
                          aria-label="Удалить показатель"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {availableTiebreakers.length > 0 ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[220px] flex-1">
                      <label
                        htmlFor="tiebreaker-select"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {tiebreakerOrder.length === 0
                          ? "Первый показатель"
                          : `Показатель ${tiebreakerOrder.length + 1}`}
                      </label>
                      <select
                        id="tiebreaker-select"
                        className="input-field"
                        value={pendingTiebreaker}
                        onChange={(e) =>
                          setPendingTiebreaker(
                            e.target.value as TiebreakerCriterion | ""
                          )
                        }
                      >
                        <option value="">Выберите показатель…</option>
                        {availableTiebreakers.map((criterion) => (
                          <option key={criterion} value={criterion}>
                            {getTiebreakerLabel(criterion)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={addTiebreaker}
                    >
                      Добавить
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-green-700">
                    Все показатели добавлены ({ALL_TIEBREAKER_CRITERIA.length} из{" "}
                    {ALL_TIEBREAKER_CRITERIA.length}).
                  </p>
                )}

                {tiebreakerOrder.length > 0 &&
                  tiebreakerOrder.length < ALL_TIEBREAKER_CRITERIA.length && (
                    <p className="mt-2 text-xs text-gray-500">
                      Добавлено {tiebreakerOrder.length} из{" "}
                      {ALL_TIEBREAKER_CRITERIA.length}
                    </p>
                  )}
              </div>
            </div>
          )}

          {step === 3 && playFormat === TournamentPlayFormat.GROUPS && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Проведите жеребьёвку подтверждённых команд по группам (размер группы:{" "}
                {groupSize}).
              </p>
              {confirmedTeamsCount === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Нет подтверждённых заявок. Подтвердите заявки перед жеребьёвкой.
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={drawMutation.isLoading}
                  onClick={() => drawMutation.mutate()}
                >
                  {drawMutation.isLoading
                    ? "Жеребьёвка…"
                    : groupDraw
                      ? "Повторить жеребьёвку"
                      : "Провести жеребьёвку"}
                </button>
              )}

              {groupDraw && groupDraw.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupDraw.map((group) => (
                    <div
                      key={group.group_number}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Группа {getGroupLetter(group.group_number)}
                      </h3>
                      <ol className="space-y-1 text-sm text-gray-700 list-decimal list-inside">
                        {group.team_ids.map((teamId) => (
                          <li key={teamId}>
                            {teamNameById.get(teamId) ?? `Команда #${teamId}`}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isBusy}
            onClick={() => {
              if (step === 1) {
                onClose();
                return;
              }
              setStep((prev) => (prev - 1) as WizardStep);
            }}
          >
            {step === 1 ? "Отмена" : "Назад"}
          </button>

          <div className="flex gap-2">
            {step === 1 && (
              <button
                type="button"
                className="btn-primary"
                disabled={!playFormat}
                onClick={handleNextFromStep1}
              >
                Далее
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                className="btn-primary"
                disabled={isBusy}
                onClick={() => void handleNextFromStep2()}
              >
                {saveSettingsMutation.isLoading || startMutation.isLoading
                  ? "Сохранение…"
                  : playFormat === TournamentPlayFormat.GROUPS
                    ? "Далее"
                    : "Начать турнир"}
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className="btn-primary"
                disabled={
                  isBusy ||
                  confirmedTeamsCount === 0 ||
                  !groupDraw ||
                  groupDraw.length === 0
                }
                onClick={() => void handleStartWithGroups()}
              >
                {startMutation.isLoading ? "Запуск…" : "Начать турнир"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(modal, document.body);
};

export default TournamentStartWizardModal;
