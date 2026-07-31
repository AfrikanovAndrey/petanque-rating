import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentArrowUpIcon,
} from "@heroicons/react/24/outline";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import RegulationsMarkdown from "../../components/RegulationsMarkdown";
import TournamentGroupStageResults from "../../components/admin/TournamentGroupStageResults";
import TournamentCupStageResults from "../../components/admin/TournamentCupStageResults";
import TournamentSwissStageResults from "../../components/admin/TournamentSwissStageResults";
import CupStageStartModal from "../../components/admin/CupStageStartModal";
import TournamentResultsUploadModal from "../../components/admin/TournamentResultsUploadModal";
import { adminApi, ratingApi } from "../../services/api";
import {
  TournamentPlayFormat,
  TournamentStatus,
  TournamentType,
} from "../../types";
import {
  formatDate,
  formatDateTime,
  getTornamentCategoryText,
  getTournamentTypeIcons,
  getTournamentTypeText,
  handleApiError,
} from "../../utils";
import {
  getPlayFormatLabel,
  getTiebreakerLabel,
  isSwissFreeTeamId,
} from "../../utils/tournamentPlaySettings";
import CsvUtils from "../../utils/csv";

const AdminTournamentInProgress: React.FC = () => {
  const { tournamentId: tournamentIdParam } = useParams<{
    tournamentId: string;
  }>();
  const tournamentId = parseInt(tournamentIdParam || "", 10);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [registrationListOpen, setRegistrationListOpen] = useState(false);
  const [cupStageModalOpen, setCupStageModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery(
    ["tournamentInProgress", tournamentId],
    async () => {
      const response = await adminApi.getTournamentInProgressPage(
        tournamentId
      );
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Не удалось загрузить данные");
      }
      return response.data.data;
    },
    {
      enabled: Number.isFinite(tournamentId) && tournamentId > 0,
      retry: false,
    }
  );

  const { data: fullRating } = useQuery(
    ["inProgressPageFullRating"],
    async () => {
      const response = await ratingApi.getFullRating();
      return response.data.success && response.data.data ? response.data.data : [];
    },
    { retry: false, staleTime: 60_000 }
  );

  const revertToFinalRegistrationMutation = useMutation(
    () =>
      adminApi.updateTournament(tournamentId, {
        status: TournamentStatus.FINAL_REGISTRATION,
      }),
    {
      onSuccess: (res) => {
        if (res.data.success) {
          toast.success("Турнир возвращён в статус «Финальная регистрация»");
          void queryClient.removeQueries([
            "tournamentInProgress",
            tournamentId,
          ]);
          void queryClient.removeQueries([
            "publicTournamentInProgress",
            tournamentId,
          ]);
          void queryClient.invalidateQueries("tournaments");
          navigate(`/admin/tournaments/${tournamentId}/final-registration`);
        } else {
          toast.error(res.data.message || "Не удалось изменить статус");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const ratingByPlayerName = useMemo(
    () =>
      new Map(
        (fullRating ?? []).map((player) => [
          player.player_name,
          player.total_points,
        ])
      ),
    [fullRating]
  );

  if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Некорректный идентификатор турнира.</p>
        <Link
          to="/admin/tournaments"
          className="text-primary-600 hover:underline"
        >
          ← К списку турниров
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center">
          <div className="loading-spinner mb-4 mx-auto" />
          <p className="text-gray-600">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {handleApiError(error)}
        </div>
        <Link
          to="/admin/tournaments"
          className="inline-flex items-center text-primary-600 hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          К списку турниров
        </Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { tournament, teams } = data;
  const confirmedTeamsCount = teams.filter((t) => t.is_confirmed).length;

  const formatPlayerWithRating = (playerName: string) =>
    `${playerName} (${ratingByPlayerName.get(playerName) ?? 0})`;

  const getTeamTotalRating = (players: string[]) => {
    const sortedRatings = players
      .map((playerName) => ratingByPlayerName.get(playerName) ?? 0)
      .sort((a, b) => b - a);
    const ratingValues =
      tournament.type === TournamentType.TRIPLETTE && sortedRatings.length > 3
        ? sortedRatings.slice(0, 3)
        : sortedRatings;
    return ratingValues.reduce((sum, value) => sum + value, 0);
  };

  const teamsByRating = [...teams].sort(
    (a, b) => getTeamTotalRating(b.players) - getTeamTotalRating(a.players)
  );

  const downloadTeamsCsv = () => {
    const lines = [
      "№,состав команды,рейтинг",
      ...teamsByRating.map((team, index) => {
        const teamPlayers = team.players.map(formatPlayerWithRating).join(", ");
        return `${index + 1},${CsvUtils.escapeCsvField(teamPlayers)},${getTeamTotalRating(
          team.players
        )}`;
      }),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const fileSafeTournamentName = tournament.name
      .replace(/[<>:"/\\|?*]+/g, "-")
      .trim();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Заявки-в-процессе-${fileSafeTournamentName || "турнир"}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/tournaments"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          К списку турниров
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">
              {tournament.name}
            </h1>            
            <p className="mt-1 text-gray-600 break-words">
              Турнир в процессе
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => setCompletionModalOpen(true)}
            >
              <DocumentArrowUpIcon className="h-5 w-5 text-gray-500" />
              Загрузить результаты
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-100 disabled:opacity-50"
              disabled={revertToFinalRegistrationMutation.isLoading}
              onClick={() => {
                if (
                  !window.confirm(
                    "Вернуть турнир в статус «Финальная регистрация»? Снова откроется подтверждение явки и редактирование заявок."
                  )
                ) {
                  return;
                }
                revertToFinalRegistrationMutation.mutate();
              }}
            >
              <ArrowUturnLeftIcon className="h-5 w-5" />
              {revertToFinalRegistrationMutation.isLoading
                ? "Сохранение…"
                : "Вернуть в финальную регистрацию"}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50"
          aria-expanded={paramsOpen}
          onClick={() => setParamsOpen((open) => !open)}
        >
          <h2 className="text-lg font-semibold text-gray-900">
            Параметры турнира
          </h2>
          {paramsOpen ? (
            <ChevronUpIcon className="h-5 w-5 shrink-0 text-gray-500" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 shrink-0 text-gray-500" />
          )}
        </button>
        {paramsOpen && (
          <div className="space-y-4 border-t border-gray-200 px-6 py-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Дата проведения</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {formatDate(tournament.date)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Тип</dt>
                <dd className="mt-0.5 font-medium text-gray-900 flex items-center flex-wrap gap-1">
                  {getTournamentTypeText(tournament.type as TournamentType)}
                  {getTournamentTypeIcons(tournament.type)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Категория</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {getTornamentCategoryText(tournament.category)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Режим загрузки результатов</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {tournament.manual ? "Ручной" : "Автоматический"}
                </dd>
              </div>
              {tournament.play_format && (
                <div>
                  <dt className="text-gray-500">Формат квалификации</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    {getPlayFormatLabel(tournament.play_format)}
                  </dd>
                </div>
              )}
              {tournament.play_format === TournamentPlayFormat.GROUPS &&
                tournament.group_size != null && (
                  <div>
                    <dt className="text-gray-500">Размер группы</dt>
                    <dd className="mt-0.5 font-medium text-gray-900">
                      {tournament.group_size}
                    </dd>
                  </div>
                )}
              {tournament.play_format === TournamentPlayFormat.SWISS &&
                tournament.swiss_rounds != null && (
                  <div>
                    <dt className="text-gray-500">Количество туров</dt>
                    <dd className="mt-0.5 font-medium text-gray-900">
                      {tournament.swiss_rounds}
                    </dd>
                  </div>
                )}
            </dl>
            {tournament.play_format === TournamentPlayFormat.SWISS &&
              tournament.tiebreaker_order &&
              tournament.tiebreaker_order.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">
                    Порядок дополнительных показателей
                  </p>
                  <ol className="mt-2 list-decimal list-inside text-sm text-gray-700 space-y-1">
                    {tournament.tiebreaker_order.map((criterion) => (
                      <li key={criterion}>{getTiebreakerLabel(criterion)}</li>
                    ))}
                  </ol>
                </div>
              )}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700">Описание</p>
              <div className="mt-2 min-w-0 rounded-lg border border-gray-100 bg-gray-50 p-4">
                {tournament.regulations?.trim() ? (
                  <RegulationsMarkdown
                    source={tournament.regulations}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-500">Не указан</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-expanded={registrationListOpen}
            onClick={() => setRegistrationListOpen((open) => !open)}
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Список регистрации
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Всего: {teams.length} • Подтверждено: {confirmedTeamsCount}
              </p>
            </div>
            {registrationListOpen ? (
              <ChevronUpIcon className="h-5 w-5 shrink-0 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 shrink-0 text-gray-500" />
            )}
          </button>
          {teams.length > 0 && (
            <button
              type="button"
              onClick={downloadTeamsCsv}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5 text-gray-500" />
              Скачать CSV
            </button>
          )}
        </div>
        {registrationListOpen &&
          (teams.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Нет зарегистрированных команд.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      №
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Состав команды
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Рейтинг команды
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Обновлено
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Статус заявки
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {teamsByRating.map((team, index) => (
                    <tr key={team.team_id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {team.players.map(formatPlayerWithRating).join(", ")}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                        {getTeamTotalRating(team.players)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(team.updated_at)}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {team.is_confirmed ? (
                          <span className="inline-flex w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Подтверждена
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Ожидает подтверждения
                            </span>
                            {!!team.has_pending_new_players && (
                              <span className="text-xs text-amber-900">
                                Есть игрок не из базы
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      {data.groups && data.groups.length > 0 && (
        <TournamentGroupStageResults
          tournamentId={tournamentId}
          groups={data.groups}
          readOnly={Boolean(data.cups && data.cups.length > 0)}
        />
      )}

      {data.swiss && (
        <TournamentSwissStageResults
          tournamentId={tournamentId}
          swiss={data.swiss}
          readOnly={Boolean(data.cups && data.cups.length > 0)}
          defaultCollapsed={Boolean(data.cups && data.cups.length > 0)}
          tournamentName={tournament.name}
          showPrint
        />
      )}

      {((tournament.play_format === TournamentPlayFormat.GROUPS &&
        data.groups &&
        data.groups.length > 0) ||
        (tournament.play_format === TournamentPlayFormat.SWISS &&
          data.swiss)) && (
          <div className="flex flex-wrap items-center gap-2">
            {!(data.cups && data.cups.length > 0) ? (
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                disabled={
                  tournament.play_format === TournamentPlayFormat.GROUPS
                    ? !data.groups!.every(
                        (g) =>
                          g.matches.length > 0 &&
                          g.matches.every(
                            (m) => m.score_a != null && m.score_b != null
                          )
                      )
                    : !(
                        data.swiss &&
                        data.swiss.swiss_rounds > 0 &&
                        data.swiss.completed_rounds >= data.swiss.swiss_rounds
                      )
                }
                onClick={() => setCupStageModalOpen(true)}
              >
                Начать финальную часть
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Сбросить финальную часть? Все счета кубков будут удалены."
                    )
                  ) {
                    return;
                  }
                  void adminApi.resetCupStage(tournamentId).then((res) => {
                    if (res.data.success) {
                      toast.success("Финал сброшен");
                      void queryClient.invalidateQueries([
                        "tournamentInProgress",
                        tournamentId,
                      ]);
                    } else {
                      toast.error(res.data.message || "Не удалось сбросить");
                    }
                  });
                }}
              >
                Сбросить финал
              </button>
            )}
          </div>
        )}

      {data.cups && data.cups.length > 0 && (
        <TournamentCupStageResults
          tournamentId={tournamentId}
          cups={data.cups}
          showPrint
          tournamentName={tournament.name}
        />
      )}

      <CupStageStartModal
        open={cupStageModalOpen}
        onClose={() => setCupStageModalOpen(false)}
        tournamentId={tournamentId}
        availableTeams={
          tournament.play_format === TournamentPlayFormat.SWISS
            ? data.swiss?.standings.filter((s) => !isSwissFreeTeamId(s.team_id))
                .length ?? 0
            : data.groups?.reduce(
                (sum, g) => sum + g.teams.filter((t) => t.place > 0).length,
                0
              ) ?? 0
        }
        allowManual={tournament.play_format === TournamentPlayFormat.GROUPS}
        candidates={
          tournament.play_format === TournamentPlayFormat.GROUPS
            ? (data.groups ?? []).flatMap((g) =>
                g.teams
                  .filter((t) => t.place > 0)
                  .map((t) => ({
                    team_id: t.team_id,
                    players: t.players,
                    group_number: g.group_number,
                    place: t.place,
                    wins: t.wins,
                    point_diff: t.point_diff,
                    points_for: t.points_for ?? 0,
                  }))
              )
            : (data.swiss?.standings ?? [])
                .filter((s) => !isSwissFreeTeamId(s.team_id) && s.place > 0)
                .map((s) => ({
                  team_id: s.team_id,
                  players: s.players,
                  group_number: 0,
                  place: s.place,
                  wins: s.wins,
                  point_diff: s.point_diff,
                  points_for: s.points_for,
                }))
        }
        onSuccess={() => {
          void queryClient.invalidateQueries([
            "tournamentInProgress",
            tournamentId,
          ]);
        }}
      />

      <TournamentResultsUploadModal
        variant="complete-in-progress"
        open={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        tournament={{
          id: tournamentId,
          name: tournament.name,
          date: tournament.date as string,
          type: tournament.type as TournamentType,
          category: tournament.category,
        }}
        onAfterSuccess={() => navigate("/admin/tournaments")}
      />
    </div>
  );
};

export default AdminTournamentInProgress;
