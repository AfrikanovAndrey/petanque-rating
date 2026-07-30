import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import {
  TiebreakerCriterion,
  TournamentSwissMatchView,
  TournamentSwissStageView,
} from "../../types";
import { handleApiError } from "../../utils";
import {
  compareSwissStandings,
  getTiebreakerLabel,
  getTiebreakerShortLabel,
  isSwissFreeTeamId,
} from "../../utils/tournamentPlaySettings";

type Props = {
  tournamentId?: number;
  swiss: TournamentSwissStageView;
  readOnly?: boolean;
  /** Свернуть блок по умолчанию (например, после начала финала) */
  defaultCollapsed?: boolean;
};

type TabId = "standings" | number;

function teamLabel(players: string[]): string {
  return players.join(", ") || "Команда";
}

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

const SwissMatchScoreInputs: React.FC<{
  tournamentId?: number;
  match: TournamentSwissMatchView;
  teamAName: string;
  teamBName: string;
  readOnly?: boolean;
}> = ({ tournamentId, match, teamAName, teamBName, readOnly }) => {
  const queryClient = useQueryClient();
  const hasSavedScore = match.score_a != null && match.score_b != null;
  const [locked, setLocked] = useState(hasSavedScore);
  const [scoreA, setScoreA] = useState(
    match.score_a != null ? String(match.score_a) : ""
  );
  const [scoreB, setScoreB] = useState(
    match.score_b != null ? String(match.score_b) : ""
  );
  const [court, setCourt] = useState(
    match.court != null ? String(match.court) : ""
  );

  React.useEffect(() => {
    setScoreA(match.score_a != null ? String(match.score_a) : "");
    setScoreB(match.score_b != null ? String(match.score_b) : "");
    setCourt(match.court != null ? String(match.court) : "");
    setLocked(match.score_a != null && match.score_b != null);
  }, [match.score_a, match.score_b, match.court, match.id]);

  const mutation = useMutation(
    async (
      payload:
        | { score_a: number; score_b: number }
        | { clear: true }
        | { court: number | null }
    ) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.updateTournamentSwissMatch(
        tournamentId,
        match.id,
        payload
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Не удалось сохранить");
      }
      return response.data.data?.swiss;
    },
    {
      onSuccess: (swiss, variables) => {
        if (tournamentId == null) {
          return;
        }
        if (swiss) {
          queryClient.setQueryData(
            ["tournamentInProgress", tournamentId],
            (old: unknown) => {
              if (!old || typeof old !== "object") {
                return old;
              }
              return { ...(old as object), swiss };
            }
          );
        }
        void queryClient.invalidateQueries([
          "tournamentInProgress",
          tournamentId,
        ]);
        if ("clear" in variables) {
          setLocked(false);
          setScoreA("");
          setScoreB("");
        } else if ("score_a" in variables) {
          setLocked(true);
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
        setScoreA(match.score_a != null ? String(match.score_a) : "");
        setScoreB(match.score_b != null ? String(match.score_b) : "");
        setCourt(match.court != null ? String(match.court) : "");
        setLocked(match.score_a != null && match.score_b != null);
      },
    }
  );

  const lockScore = () => {
    const aRaw = scoreA.trim();
    const bRaw = scoreB.trim();
    if (aRaw === "" && bRaw === "") {
      if (hasSavedScore) {
        mutation.mutate({ clear: true });
      } else {
        toast.error("Введите счёт обеих команд");
      }
      return;
    }
    if (aRaw === "" || bRaw === "") {
      toast.error("Введите счёт обеих команд");
      return;
    }
    const a = parseInt(aRaw, 10);
    const b = parseInt(bRaw, 10);
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a > 13 ||
      b > 13
    ) {
      toast.error("Счёт должен быть от 0 до 13");
      return;
    }
    if (a === b) {
      toast.error("Партия не может закончиться ничьей");
      return;
    }
    if (a === match.score_a && b === match.score_b) {
      setLocked(true);
      return;
    }
    mutation.mutate({ score_a: a, score_b: b });
  };

  const saveCourt = () => {
    const raw = court.trim();
    if (raw === "") {
      if (match.court == null) {
        return;
      }
      mutation.mutate({ court: null });
      return;
    }
    const c = parseInt(raw, 10);
    if (!Number.isInteger(c) || c < 1 || c > 99) {
      toast.error("Номер дорожки должен быть от 1 до 99");
      setCourt(match.court != null ? String(match.court) : "");
      return;
    }
    if (c === match.court) {
      return;
    }
    mutation.mutate({ court: c });
  };

  if (match.is_bye) {
    const scoreBoxClass = readOnly
      ? "inline-flex w-10 justify-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-center font-medium text-gray-900"
      : "inline-flex w-14 justify-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-center text-sm font-medium text-gray-900";
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="min-w-0 flex-1 text-right text-gray-800 truncate font-medium"
          title={teamAName}
        >
          {teamAName}
        </span>
        <span className={scoreBoxClass}>13</span>
        <span className="text-gray-400">:</span>
        <span className={scoreBoxClass}>7</span>
        <span
          className="min-w-0 flex-1 text-left font-medium text-amber-900 truncate"
          title="Свободен · автопобеда"
        >
          Свободен
        </span>
        {!readOnly && (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-[10px] font-medium leading-none text-amber-900"
            title="Автопобеда"
          >
            авто
          </span>
        )}
        <span className="shrink-0 text-sm font-medium text-gray-600">
          дорожка
        </span>
        <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-md border-2 border-amber-400 bg-amber-50 text-base font-bold text-amber-950">
          —
        </span>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="min-w-0 flex-1 text-right text-gray-800 truncate"
          title={teamAName}
        >
          {teamAName}
        </span>
        <span
          className={`inline-flex w-10 justify-center rounded border px-1.5 py-1 text-center font-medium ${
            hasSavedScore
              ? "border-emerald-300 bg-emerald-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {match.score_a != null ? match.score_a : "—"}
        </span>
        <span className="text-gray-400">:</span>
        <span
          className={`inline-flex w-10 justify-center rounded border px-1.5 py-1 text-center font-medium ${
            hasSavedScore
              ? "border-emerald-300 bg-emerald-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {match.score_b != null ? match.score_b : "—"}
        </span>
        <span
          className="min-w-0 flex-1 text-left text-gray-800 truncate"
          title={teamBName}
        >
          {teamBName}
        </span>
        <span className="shrink-0 text-sm font-medium text-gray-600">
          дорожка
        </span>
        <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-md border-2 border-amber-400 bg-amber-50 text-base font-bold text-amber-950">
          {match.court != null ? match.court : "—"}
        </span>
      </div>
    );
  }

  const inputsDisabled = mutation.isLoading || locked;
  const scoreInputClass = `w-14 rounded border px-1.5 py-1 text-center text-sm ${
    locked
      ? "border-emerald-300 bg-emerald-50 text-gray-900"
      : "border-gray-300 disabled:bg-gray-100"
  }`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className="min-w-0 flex-1 text-right text-gray-800 truncate"
        title={teamAName}
      >
        {teamAName}
      </span>
      <input
        type="number"
        min={0}
        max={13}
        className={scoreInputClass}
        value={scoreA}
        disabled={inputsDisabled}
        onChange={(e) => setScoreA(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !locked) {
            lockScore();
          }
        }}
        aria-label={`Счёт ${teamAName}`}
      />
      <span className="text-gray-400">:</span>
      <input
        type="number"
        min={0}
        max={13}
        className={scoreInputClass}
        value={scoreB}
        disabled={inputsDisabled}
        onChange={(e) => setScoreB(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !locked) {
            lockScore();
          }
        }}
        aria-label={`Счёт ${teamBName}`}
      />
      <span
        className="min-w-0 flex-1 text-left text-gray-800 truncate"
        title={teamBName}
      >
        {teamBName}
      </span>
      {locked ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          onClick={() => setLocked(false)}
          title="Изменить счёт"
          aria-label="Изменить счёт"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          onClick={lockScore}
          disabled={mutation.isLoading}
          title="Сохранить счёт"
          aria-label="Сохранить счёт"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      )}
      <span className="shrink-0 text-sm font-medium text-gray-600">дорожка</span>
      <input
        type="number"
        min={1}
        max={99}
        className="h-9 w-12 rounded-md border-2 border-amber-400 bg-amber-50 px-1 text-center text-base font-bold text-amber-950"
        value={court}
        disabled={mutation.isLoading}
        onChange={(e) => setCourt(e.target.value)}
        onBlur={saveCourt}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Номер дорожки"
      />
    </div>
  );
};

export const TournamentSwissStageResults: React.FC<Props> = ({
  tournamentId,
  swiss,
  readOnly = false,
  defaultCollapsed = false,
}) => {
  const rounds = useMemo(() => {
    const byRound = new Map<number, TournamentSwissMatchView[]>();
    for (const m of swiss.matches) {
      if (!byRound.has(m.round_number)) {
        byRound.set(m.round_number, []);
      }
      byRound.get(m.round_number)!.push(m);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round_number, matches]) => ({ round_number, matches }));
  }, [swiss.matches]);

  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of swiss.standings) {
      map.set(row.team_id, teamLabel(row.players));
    }
    return map;
  }, [swiss.standings]);

  const [activeTab, setActiveTab] = useState<TabId>("standings");
  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);

  useEffect(() => {
    if (defaultCollapsed) {
      setSectionOpen(false);
    }
  }, [defaultCollapsed]);

  const selectedTab: TabId =
    activeTab === "standings" ||
    rounds.some((r) => r.round_number === activeTab)
      ? activeTab
      : "standings";

  const activeRound =
    typeof selectedTab === "number"
      ? rounds.find((r) => r.round_number === selectedTab)
      : null;

  const standingsTitle =
    swiss.completed_rounds > 0
      ? `Итоги швейцарки (после ${swiss.completed_rounds} туров)`
      : "Итоги швейцарки";

  const tiebreakerOrder = swiss.tiebreaker_order ?? [];

  // Победы → коэффициенты из настроек турнира → сид (как на бэкенде).
  // «Свободен» в итогах не показываем.
  const sortedStandings = useMemo(() => {
    const order = swiss.tiebreaker_order ?? [];
    return swiss.standings
      .filter((row) => !isSwissFreeTeamId(row.team_id))
      .slice()
      .sort((a, b) => compareSwissStandings(a, b, order))
      .map((row, index) => ({
        ...row,
        place: index + 1,
      }));
  }, [swiss.standings, swiss.tiebreaker_order]);

  const sortLegend = [
    "Победы",
    ...tiebreakerOrder.map((c) => getTiebreakerShortLabel(c)),
    "сид",
  ].join(" → ");

  const queryClient = useQueryClient();

  const applySwissUpdate = (
    nextSwiss: TournamentSwissStageView,
    options?: { goToRound?: number; successMessage?: string }
  ) => {
    if (tournamentId == null) {
      return;
    }
    queryClient.setQueryData(
      ["tournamentInProgress", tournamentId],
      (old: unknown) => {
        if (!old || typeof old !== "object") {
          return old;
        }
        return { ...(old as object), swiss: nextSwiss };
      }
    );
    void queryClient.invalidateQueries([
      "tournamentInProgress",
      tournamentId,
    ]);
    if (options?.goToRound != null) {
      setActiveTab(options.goToRound);
    }
    if (options?.successMessage) {
      toast.success(options.successMessage);
    }
  };

  const rollbackMutation = useMutation(
    async (fromRound: number) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.rollbackSwissRound(
        tournamentId,
        fromRound
      );
      if (!response.data.success || !response.data.data?.swiss) {
        throw new Error(response.data.message || "Не удалось откатить тур");
      }
      return { swiss: response.data.data.swiss, fromRound };
    },
    {
      onSuccess: ({ swiss: nextSwiss, fromRound }) => {
        applySwissUpdate(nextSwiss, {
          goToRound: fromRound - 1,
          successMessage: `Тур ${fromRound} удалён. Можно править тур ${fromRound - 1}.`,
        });
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const advanceMutation = useMutation(
    async (fromRound: number) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.advanceSwissRound(
        tournamentId,
        fromRound
      );
      if (!response.data.success || !response.data.data?.swiss) {
        throw new Error(
          response.data.message || "Не удалось сформировать следующий тур"
        );
      }
      return { swiss: response.data.data.swiss, nextRound: fromRound + 1 };
    },
    {
      onSuccess: ({ swiss: nextSwiss, nextRound }) => {
        applySwissUpdate(nextSwiss, {
          goToRound: nextRound,
          successMessage: `Сформирован тур ${nextRound}`,
        });
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const canRollbackRound =
    !readOnly &&
    tournamentId != null &&
    typeof selectedTab === "number" &&
    selectedTab >= 2;

  const currentRoundComplete =
    typeof selectedTab === "number" &&
    activeRound != null &&
    activeRound.matches.length > 0 &&
    activeRound.matches.every(
      (m) => m.is_bye || (m.score_a != null && m.score_b != null)
    );

  const nextRoundExists =
    typeof selectedTab === "number" &&
    rounds.some((r) => r.round_number === selectedTab + 1);

  // Кнопка «К следующему туру»: туры 1 … N−1, когда тур сыгран, а следующего ещё нет
  // (в т.ч. после отката к предыдущему).
  const canAdvanceRound =
    !readOnly &&
    tournamentId != null &&
    typeof selectedTab === "number" &&
    selectedTab >= 1 &&
    selectedTab < swiss.swiss_rounds &&
    currentRoundComplete &&
    !nextRoundExists;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50"
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((open) => !open)}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Швейцарская система
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {swiss.completed_rounds === swiss.swiss_rounds ? `Завершена` : `Проведено туров: ${swiss.completed_rounds}`}
          </p>
        </div>
        {sectionOpen ? (
          <ChevronUpIcon className="h-5 w-5 shrink-0 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 shrink-0 text-gray-500" />
        )}
      </button>

      {sectionOpen && (
        <div className="space-y-4 border-t border-gray-200 px-6 py-4">
          <div
            className="flex flex-wrap gap-1 border-b border-gray-200"
            role="tablist"
            aria-label="Туры швейцарки"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedTab === "standings"}
              className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                selectedTab === "standings"
                  ? "border border-b-white border-gray-200 bg-white text-primary-700 -mb-px"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={() => setActiveTab("standings")}
            >
              {standingsTitle}
            </button>
            {rounds.map(({ round_number }) => (
              <button
                key={round_number}
                type="button"
                role="tab"
                aria-selected={selectedTab === round_number}
                className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                  selectedTab === round_number
                    ? "border border-b-white border-gray-200 bg-white text-primary-700 -mb-px"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab(round_number)}
              >
                Тур {round_number}
              </button>
            ))}
          </div>

          {selectedTab === "standings" ? (
            <div className="space-y-2">
              {swiss.completed_rounds > 0 && tiebreakerOrder.length > 0 && (
                <p className="text-xs text-gray-500">
                  Сортировка мест: {sortLegend}
                </p>
              )}
              <div className="flex justify-center overflow-x-auto">
                <table className="w-auto border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                        Место
                      </th>
                      <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">
                        Команда
                      </th>
                      <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                        Победы
                      </th>
                      {tiebreakerOrder.map((criterion) => (
                        <th
                          key={criterion}
                          className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600"
                          title={getTiebreakerLabel(criterion)}
                        >
                          {getTiebreakerShortLabel(criterion)}
                        </th>
                      ))}
                      <th
                        className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-500"
                        title="Стартовый номер посева"
                      >
                        Сид
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStandings.map((row) => {
                      const name = teamLabel(row.players);
                      return (
                        <tr key={row.team_id} className="bg-white">
                          <td className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center font-semibold text-gray-900">
                            {swiss.completed_rounds > 0 ? row.place : "—"}
                          </td>
                          <td className="whitespace-nowrap border border-gray-200 px-2 py-1 font-medium text-gray-900">
                            {name}
                          </td>
                          <td className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center font-semibold text-gray-900">
                            {row.wins}
                          </td>
                          {tiebreakerOrder.map((criterion) => {
                            const value = row.tiebreakers?.[criterion];
                            const display =
                              value == null
                                ? "—"
                                : criterion === TiebreakerCriterion.POINT_DIFF
                                  ? formatDiff(value)
                                  : String(value);
                            return (
                              <td
                                key={criterion}
                                className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center text-gray-700"
                              >
                                {display}
                              </td>
                            );
                          })}
                          <td
                            className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center text-gray-500"
                            title={`Рейтинг: ${row.rating}, random: ${row.random_tie}`}
                          >
                            {row.seed}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeRound ? (
            <div className="space-y-3">
              {(canRollbackRound || canAdvanceRound) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {canAdvanceRound
                      ? `Тур ${selectedTab} завершён. Сформируйте следующий, чтобы продолжить.`
                      : `Чтобы исправить счета тура ${selectedTab - 1}, удалите текущий тур и все последующие.`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {canRollbackRound && (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        disabled={
                          rollbackMutation.isLoading ||
                          advanceMutation.isLoading
                        }
                        onClick={() => {
                          const fromRound = selectedTab as number;
                          if (
                            !window.confirm(
                              `Удалить тур ${fromRound}${
                                swiss.matches.some(
                                  (m) => m.round_number > fromRound
                                )
                                  ? " и все последующие"
                                  : ""
                              }? Счета тура ${fromRound - 1} останутся — их можно будет изменить.`
                            )
                          ) {
                            return;
                          }
                          rollbackMutation.mutate(fromRound);
                        }}
                      >
                        Вернуться к туру {selectedTab - 1}
                      </button>
                    )}
                    {canAdvanceRound && (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                        disabled={
                          advanceMutation.isLoading ||
                          rollbackMutation.isLoading
                        }
                        onClick={() => {
                          advanceMutation.mutate(selectedTab as number);
                        }}
                      >
                        {advanceMutation.isLoading
                          ? "Формирование…"
                          : `К следующему туру (${(selectedTab as number) + 1})`}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <ul className="mx-auto w-full max-w-2xl space-y-2">
                {activeRound.matches.map((m) => {
                  const aName =
                    nameById.get(m.team_a_id) ?? `Команда #${m.team_a_id}`;
                  const bName =
                    m.team_b_id != null
                      ? nameById.get(m.team_b_id) ?? `Команда #${m.team_b_id}`
                      : "";
                  return (
                    <li
                      key={m.id}
                      className="rounded-md border border-gray-200 bg-white px-3 py-2"
                    >
                      <SwissMatchScoreInputs
                        tournamentId={tournamentId}
                        match={m}
                        teamAName={aName}
                        teamBName={bName}
                        readOnly={readOnly}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TournamentSwissStageResults;
