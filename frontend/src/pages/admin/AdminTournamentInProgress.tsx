import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import React, { useMemo } from "react";
import { useQuery } from "react-query";
import { Link, useParams } from "react-router-dom";
import RegulationsMarkdown from "../../components/RegulationsMarkdown";
import { adminApi, ratingApi } from "../../services/api";
import { TournamentType } from "../../types";
import {
  formatDate,
  formatDateTime,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeIcons,
  getTournamentTypeText,
  handleApiError,
} from "../../utils";
import CsvUtils from "../../utils/csv";

const AdminTournamentInProgress: React.FC = () => {
  const { tournamentId: tournamentIdParam } = useParams<{
    tournamentId: string;
  }>();
  const tournamentId = parseInt(tournamentIdParam || "", 10);

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

  const downloadTeamsCsv = () => {
    const lines = [
      "№,состав команды,рейтинг",
      ...teams.map((team, index) => {
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
        <div className="flex flex-wrap items-center gap-3">                
            <h1 className="text-3xl font-bold text-gray-900">
            {tournament.name}
            </h1>
          <PlayCircleIcon className="h-9 w-9 shrink-0 text-sky-600" />
          <p className="mt-1 text-gray-600 break-words">Турнир в процессе</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Параметры турнира</h2>
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
            <dt className="text-gray-500">Статус</dt>
            <dd className="mt-0.5">
              <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                {getTournamentStatusText(tournament.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Режим загрузки результатов</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {tournament.manual ? "Ручной" : "Автоматический"}
            </dd>
          </div>
        </dl>
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700">Регламент</p>
          <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
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

      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Список заявок
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Всего: {teams.length} • Подтверждено: {confirmedTeamsCount}
              </p>
            </div>
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
        </div>
        {teams.length === 0 ? (
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
                {teams.map((team, index) => (
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
        )}
      </div>
    </div>
  );
};

export default AdminTournamentInProgress;
