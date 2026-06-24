import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import {
  SwissRoundStatus,
  TiebreakerCriterion,
  TournamentPlayFormat,
  TournamentSwissMatch,
  TournamentSwissStanding,
} from "../../types";
import { handleApiError } from "../../utils";
import {
  ALL_TIEBREAKER_CRITERIA,
  SWISS_BYE_SCORE,
  formatStandingPoints,
  getSwissRoundStatusLabel,
  getTiebreakerLabel,
  standingsTiebreakerColumns,
} from "../../utils/tournamentPlaySettings";

type AdminSwissPanelProps = {
  tournamentId: number;
};

function coerceNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function getTiebreakerValue(
  standing: TournamentSwissStanding,
  criterion: TiebreakerCriterion,
): number | null {
  switch (criterion) {
    case TiebreakerCriterion.BUCHHOLZ:
      return coerceNumber(standing.buchholz);
    case TiebreakerCriterion.DOUBLE_BUCHHOLZ:
      return coerceNumber(standing.double_buchholz);
    case TiebreakerCriterion.BERGER:
      return coerceNumber(standing.berger);
    case TiebreakerCriterion.PROGRESS:
      return coerceNumber(standing.progress);
    case TiebreakerCriterion.POINT_DIFF:
      return coerceNumber(standing.point_diff);
    default:
      return null;
  }
}

function formatTiebreakerValue(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function TeamPlayersColumn({
  players,
  align = "left",
}: {
  players?: string | null;
  align?: "left" | "right";
}) {
  const names = (players ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return (
      <div
        className={`text-sm text-gray-400 ${align === "right" ? "text-right" : "text-left"}`}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={`text-sm text-gray-900 leading-snug ${align === "right" ? "text-right" : "text-left"}`}
    >
      {names.map((name) => (
        <div key={name}>{name}</div>
      ))}
    </div>
  );
}

type SwissMatchRowProps = {
  match: TournamentSwissMatch;
  editable: boolean;
  saving: boolean;
  onSave: (scoreA: number, scoreB: number) => void;
};

function SwissMatchRow({
  match,
  editable,
  saving,
  onSave,
}: SwissMatchRowProps) {
  const displayScoreA = match.is_bye
    ? SWISS_BYE_SCORE.a
    : match.score_a;
  const displayScoreB = match.is_bye
    ? SWISS_BYE_SCORE.b
    : match.score_b;

  const [scoreA, setScoreA] = useState(
    match.score_a != null ? String(match.score_a) : "",
  );
  const [scoreB, setScoreB] = useState(
    match.score_b != null ? String(match.score_b) : "",
  );

  useEffect(() => {
    setScoreA(match.score_a != null ? String(match.score_a) : "");
    setScoreB(match.score_b != null ? String(match.score_b) : "");
  }, [match.score_a, match.score_b, match.id]);

  const handleSave = () => {
    const parsedA = Number.parseInt(scoreA, 10);
    const parsedB = Number.parseInt(scoreB, 10);
    if (
      !Number.isInteger(parsedA) ||
      !Number.isInteger(parsedB) ||
      parsedA < 0 ||
      parsedB < 0 ||
      parsedA > 13 ||
      parsedB > 13
    ) {
      toast.error("Счёт должен быть целым числом от 0 до 13");
      return;
    }
    if (parsedA === parsedB) {
      toast.error("Ничьих в пétanque нет — укажите разный счёт");
      return;
    }
    onSave(parsedA, parsedB);
  };

  const scoreCell = match.is_bye ? (
    <div className="text-center text-sm font-medium text-gray-900 tabular-nums">
      {SWISS_BYE_SCORE.a}:{SWISS_BYE_SCORE.b}      
    </div>
  ) : editable ? (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="number"
        min={0}
        max={13}
        className="input-field w-14 text-center py-1.5 px-2"
        value={scoreA}
        onChange={(event) => setScoreA(event.target.value)}
        disabled={saving}
      />
      <span className="text-gray-400">:</span>
      <input
        type="number"
        min={0}
        max={13}
        className="input-field w-14 text-center py-1.5 px-2"
        value={scoreB}
        onChange={(event) => setScoreB(event.target.value)}
        disabled={saving}
      />
    </div>
  ) : (
    <div className="text-center text-sm font-medium text-gray-900 tabular-nums">
      {displayScoreA != null && displayScoreB != null
        ? `${displayScoreA}:${displayScoreB}`
        : "—"}
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(10rem,14rem)_10.5rem_minmax(10rem,14rem)_auto] items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <TeamPlayersColumn players={match.team_a_players} align="right" />
      {scoreCell}
      <TeamPlayersColumn
        players={match.is_bye ? "Свободен" : match.team_b_players}
        align="left"
      />
      <div className="flex justify-end">
        {editable && !match.is_bye ? (
          <button
            type="button"
            className="btn-primary py-1.5 px-3 text-sm"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const DEFAULT_TIEBREAKER_ORDER: TiebreakerCriterion[] = [
  TiebreakerCriterion.BUCHHOLZ,
  TiebreakerCriterion.POINT_DIFF,
];

const AdminSwissPanel: React.FC<AdminSwissPanelProps> = ({ tournamentId }) => {
  const queryClient = useQueryClient();
  const [swissRounds, setSwissRounds] = useState("");
  const [tiebreakerOrder, setTiebreakerOrder] = useState<TiebreakerCriterion[]>(
    DEFAULT_TIEBREAKER_ORDER,
  );
  const [tiebreakerToAdd, setTiebreakerToAdd] = useState<TiebreakerCriterion | "">(
    "",
  );
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(
    null,
  );
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery(
    ["tournamentSwiss", tournamentId],
    async () => {
      const response = await adminApi.getTournamentSwissPage(tournamentId);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Не удалось загрузить данные");
      }
      return response.data.data;
    },
    {
      enabled: Number.isFinite(tournamentId) && tournamentId > 0,
      retry: false,
    },
  );

  const invalidateSwissQueries = () => {
    void queryClient.invalidateQueries(["tournamentSwiss", tournamentId]);
    void queryClient.invalidateQueries(["tournamentInProgress", tournamentId]);
  };

  const savePlaySettingsMutation = useMutation(
    () =>
      adminApi.updateTournamentSwissPlaySettings(tournamentId, {
        play_format: TournamentPlayFormat.SWISS,
        swiss_rounds: Number.parseInt(swissRounds, 10),
        tiebreaker_order: tiebreakerOrder,
      }),
    {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success("Настройки швейцарской системы сохранены");
          invalidateSwissQueries();
        } else {
          toast.error(response.data.message || "Не удалось сохранить настройки");
        }
      },
      onError: (mutationError) => {
        toast.error(handleApiError(mutationError));
      },
    },
  );

  const initializeMutation = useMutation(
    () => adminApi.initializeTournamentSwiss(tournamentId),
    {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success(
            response.data.message || "Швейцарская система инициализирована",
          );
          invalidateSwissQueries();
        } else {
          toast.error(response.data.message || "Не удалось инициализировать");
        }
      },
      onError: (mutationError) => {
        toast.error(handleApiError(mutationError));
      },
    },
  );

  const saveMatchMutation = useMutation(
    ({
      matchId,
      scoreA,
      scoreB,
    }: {
      matchId: number;
      scoreA: number;
      scoreB: number;
    }) =>
      adminApi.updateSwissMatchResult(tournamentId, matchId, {
        score_a: scoreA,
        score_b: scoreB,
      }),
    {
      onMutate: ({ matchId }) => {
        setSavingMatchId(matchId);
      },
      onSettled: () => {
        setSavingMatchId(null);
      },
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success("Результат матча сохранён");
          invalidateSwissQueries();
        } else {
          toast.error(response.data.message || "Не удалось сохранить результат");
        }
      },
      onError: (mutationError) => {
        toast.error(handleApiError(mutationError));
      },
    },
  );

  const completeRoundMutation = useMutation(
    (roundNumber: number) =>
      adminApi.completeSwissRound(tournamentId, roundNumber),
    {
      onSuccess: (response) => {
        if (response.data.success) {
          toast.success(response.data.message || "Тур завершён");
          invalidateSwissQueries();
        } else {
          toast.error(response.data.message || "Не удалось завершить тур");
        }
      },
      onError: (mutationError) => {
        toast.error(handleApiError(mutationError));
      },
    },
  );

  useEffect(() => {
    if (!data?.tournament) {
      return;
    }
    setSwissRounds(
      data.tournament.swiss_rounds != null
        ? String(data.tournament.swiss_rounds)
        : "",
    );
    setTiebreakerOrder(
      data.tournament.tiebreaker_order?.length
        ? data.tournament.tiebreaker_order
        : DEFAULT_TIEBREAKER_ORDER,
    );
  }, [data?.tournament]);

  const viewableRounds = useMemo(
    () =>
      (data?.rounds ?? []).filter(
        (round) => round.status !== SwissRoundStatus.PENDING,
      ),
    [data?.rounds],
  );

  const activeRound = useMemo(
    () =>
      (data?.rounds ?? []).find(
        (round) => round.status === SwissRoundStatus.IN_PROGRESS,
      ),
    [data?.rounds],
  );

  useEffect(() => {
    if (viewableRounds.length === 0) {
      setSelectedRoundNumber(null);
      return;
    }
    if (
      selectedRoundNumber == null ||
      !viewableRounds.some((round) => round.round_number === selectedRoundNumber)
    ) {
      setSelectedRoundNumber(
        activeRound?.round_number ??
          viewableRounds[viewableRounds.length - 1].round_number,
      );
    }
  }, [viewableRounds, activeRound, selectedRoundNumber]);

  const selectedRound = useMemo(
    () =>
      viewableRounds.find((round) => round.round_number === selectedRoundNumber) ??
      null,
    [viewableRounds, selectedRoundNumber],
  );

  const selectedRoundMatches = useMemo(
    () =>
      (data?.matches ?? []).filter(
        (match) => match.round_number === selectedRoundNumber,
      ),
    [data?.matches, selectedRoundNumber],
  );

  const tiebreakerColumns = useMemo(
    () =>
      standingsTiebreakerColumns(
        data?.tournament.tiebreaker_order,
        DEFAULT_TIEBREAKER_ORDER,
      ),
    [data?.tournament.tiebreaker_order],
  );

  const sortedStandings = useMemo(
    () =>
      [...(data?.standings ?? [])].sort((a, b) => {
        const rankA = a.rank_position ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.rank_position ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      }),
    [data?.standings],
  );

  const availableTiebreakers = ALL_TIEBREAKER_CRITERIA.filter(
    (criterion) => !tiebreakerOrder.includes(criterion),
  );

  const confirmedTeamsCount = useMemo(
    () => (data?.teams ?? []).filter((team) => team.is_confirmed).length,
    [data?.teams],
  );

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center min-h-[160px]">
          <div className="text-center">
            <div className="loading-spinner mb-4 mx-auto" />
            <p className="text-gray-600">Загрузка швейцарской системы…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {handleApiError(error)}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { tournament, initialized } = data;
  const isSwissFormat = tournament.play_format === TournamentPlayFormat.SWISS;

  if (!isSwissFormat) {
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Швейцарская система
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Настройте параметры проведения турнира по швейцарской системе.
          </p>
        </div>
        <div className="space-y-5 p-6">
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
              onChange={(event) => setSwissRounds(event.target.value)}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Дополнительные показатели при равенстве побед
            </p>
            {tiebreakerOrder.length > 0 ? (
              <ul className="space-y-2 mb-3">
                {tiebreakerOrder.map((criterion, index) => (
                  <li
                    key={criterion}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <span className="text-sm text-gray-900">
                      {index + 1}. {getTiebreakerLabel(criterion)}
                    </span>
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:text-red-800"
                      onClick={() =>
                        setTiebreakerOrder((current) =>
                          current.filter((item) => item !== criterion),
                        )
                      }
                    >
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                Показатели не выбраны — будут использованы значения по умолчанию.
              </p>
            )}
            {availableTiebreakers.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[16rem] flex-1">
                  <label
                    htmlFor="tiebreaker-add"
                    className="block text-sm text-gray-600 mb-1"
                  >
                    Добавить показатель
                  </label>
                  <select
                    id="tiebreaker-add"
                    className="input-field"
                    value={tiebreakerToAdd}
                    onChange={(event) =>
                      setTiebreakerToAdd(
                        event.target.value as TiebreakerCriterion | "",
                      )
                    }
                  >
                    <option value="">Выберите…</option>
                    {availableTiebreakers.map((criterion) => (
                      <option key={criterion} value={criterion}>
                        {getTiebreakerLabel(criterion)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!tiebreakerToAdd}
                  onClick={() => {
                    if (!tiebreakerToAdd) {
                      return;
                    }
                    setTiebreakerOrder((current) => [...current, tiebreakerToAdd]);
                    setTiebreakerToAdd("");
                  }}
                >
                  Добавить
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={savePlaySettingsMutation.isLoading}
            onClick={() => savePlaySettingsMutation.mutate()}
          >
            {savePlaySettingsMutation.isLoading
              ? "Сохранение…"
              : "Сохранить настройки"}
          </button>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Швейцарская система
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Туров: {tournament.swiss_rounds ?? "—"} • Подтверждённых команд:{" "}
            {confirmedTeamsCount}
          </p>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-gray-600">
            Настройки сохранены. Запустите первый тур, чтобы сформировать пары
            и таблицу.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={
              initializeMutation.isLoading || confirmedTeamsCount < 2
            }
            onClick={() => initializeMutation.mutate()}
          >
            {initializeMutation.isLoading
              ? "Инициализация…"
              : "Начать швейцарскую систему"}
          </button>
          {confirmedTeamsCount < 2 && (
            <p className="text-sm text-amber-700">
              Нужно минимум 2 подтверждённые команды.
            </p>
          )}
        </div>
      </div>
    );
  }

  const isSelectedRoundEditable =
    selectedRound?.status === SwissRoundStatus.IN_PROGRESS;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Туры</h2>
              <p className="mt-1 text-sm text-gray-500">
                Всего туров: {tournament.swiss_rounds ?? viewableRounds.length}
              </p>
            </div>
            {isSelectedRoundEditable && selectedRoundNumber != null && (
              <button
                type="button"
                className="btn-primary"
                disabled={completeRoundMutation.isLoading}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Завершить тур ${selectedRoundNumber}? ${
                        selectedRoundNumber >= (tournament.swiss_rounds ?? 0)
                          ? "Это финальный тур."
                          : "Будет создан следующий тур."
                      }`,
                    )
                  ) {
                    return;
                  }
                  completeRoundMutation.mutate(selectedRoundNumber);
                }}
              >
                {completeRoundMutation.isLoading
                  ? "Завершение…"
                  : `Завершить тур ${selectedRoundNumber}`}
              </button>
            )}
          </div>
        </div>

        {viewableRounds.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">
            Нет доступных туров.
          </div>
        ) : (
          <>
            <div className="border-b border-gray-200 px-6 py-3">
              <div className="flex flex-wrap gap-2">
                {viewableRounds.map((round) => {
                  const isActive = round.round_number === selectedRoundNumber;
                  return (
                    <button
                      key={round.id}
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setSelectedRoundNumber(round.round_number)}
                    >
                      Тур {round.round_number}
                      <span className="ml-1.5 text-xs opacity-80">
                        ({getSwissRoundStatusLabel(round.status)})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4">
              {selectedRoundMatches.length === 0 ? (
                <p className="text-sm text-gray-500">В этом туре нет матчей.</p>
              ) : (
                <div>
                  {selectedRoundMatches.map((match) => (
                    <SwissMatchRow
                      key={match.id}
                      match={match}
                      editable={isSelectedRoundEditable}
                      saving={savingMatchId === match.id}
                      onSave={(scoreA, scoreB) =>
                        saveMatchMutation.mutate({
                          matchId: match.id,
                          scoreA,
                          scoreB,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Турнирная таблица
          </h2>
        </div>
        {sortedStandings.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">
            Таблица пока пуста.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    №
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Команда
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Победы
                  </th>
                  {tiebreakerColumns.map((criterion) => (
                    <th
                      key={criterion}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap"
                    >
                      {getTiebreakerLabel(criterion)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Очки
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedStandings.map((standing, index) => (
                  <tr key={standing.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">
                      {standing.rank_position ?? index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-left">
                      <TeamPlayersColumn players={standing.team_players} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">
                      {standing.wins}
                    </td>
                    {tiebreakerColumns.map((criterion) => (
                      <td
                        key={criterion}
                        className="px-4 py-3 text-sm text-gray-900 text-center tabular-nums"
                      >
                        {formatTiebreakerValue(
                          getTiebreakerValue(standing, criterion),
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-gray-900 text-center tabular-nums whitespace-nowrap">
                      {formatStandingPoints(standing)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSwissPanel;
